-- Deleting your account, from inside the app
--
-- Apple requires any app that lets you make an account to let you delete it from inside
-- the app (guideline 5.1.1(v)). Until now Hits had Sign out and nothing else, which is a
-- rejection on submission and, for an app aimed at minors, the wrong default anyway: a
-- fourteen-year-old who wants out should not have to email anybody.
--
-- Three things make this harder than `delete from profiles`.
--
-- 1. A confirmed hit is a time and a place that somebody else -- and possibly a parent who
--    approved it -- has written down. Vanishing silently leaves them standing at a court.
-- 2. Safety reports must outlive the account they are about. A cascade delete means the
--    fastest way to erase a report against you is to make a new account, which is the
--    exact opposite of what a report is for.
-- 3. A guardian is load-bearing for somebody else. If a parent deletes their account, the
--    child does not become unsupervised; they go back to needing a guardian, and their
--    pending hits come off the board.

-- 1. Reports have to outlive the profile ------------------------------------------------
--
-- `reported_profile_id` cascaded, so deleting the account deleted the reports about it.
-- The fix is a plain uuid alongside the foreign key: the link goes soft, the identity
-- stays. A moderator can still group every report about one person after they leave.
--
-- Also fixes a latent bug: `reporter_profile_id` was `not null` AND `on delete set null`,
-- a pair that can only ever raise. No reporter had been deleted yet, so nothing had hit it.
alter table app.reports add column if not exists reported_ref uuid;
alter table app.reports add column if not exists reporter_ref uuid;
update app.reports set reported_ref = coalesce(reported_ref, reported_profile_id),
                       reporter_ref = coalesce(reporter_ref, reporter_profile_id);

alter table app.reports drop constraint if exists reports_reported_profile_id_fkey;
alter table app.reports drop constraint if exists reports_reporter_profile_id_fkey;
alter table app.reports alter column reported_profile_id drop not null;
alter table app.reports alter column reporter_profile_id drop not null;
alter table app.reports
  add constraint reports_reported_profile_id_fkey
  foreign key (reported_profile_id) references app.profiles(id) on delete set null;
alter table app.reports
  add constraint reports_reporter_profile_id_fkey
  foreign key (reporter_profile_id) references app.profiles(id) on delete set null;

create index if not exists reports_reported_ref_idx on app.reports (reported_ref);

create or replace function app.stamp_report_refs()
returns trigger language plpgsql as $$
begin
  new.reported_ref := coalesce(new.reported_ref, new.reported_profile_id);
  new.reporter_ref := coalesce(new.reporter_ref, new.reporter_profile_id);
  return new;
end; $$;

-- Default EXECUTE in Postgres is to PUBLIC, and anon inherits PUBLIC, so a trigger
-- function that nobody should ever call directly still has to be locked down by hand.
-- `17_execute_surface` caught this one the same day it was written, which is the whole
-- reason that test asks the question from the role's side.
revoke execute on function app.stamp_report_refs() from public, anon, authenticated;

drop trigger if exists reports_stamp_refs on app.reports;
create trigger reports_stamp_refs before insert on app.reports
  for each row execute function app.stamp_report_refs();

-- 2. A tombstone, carrying no personal data ---------------------------------------------
--
-- Enough to answer "did this account exist, and was it deleted or did we lose it", and to
-- notice if one person deletes and re-creates repeatedly to escape a report. The id is
-- already in the reports; keeping it here adds nothing that was not retained anyway.
-- No name, no phone, no email, no date of birth, no location.
create table if not exists app.deleted_accounts (
  profile_id    uuid primary key,
  deleted_at    timestamptz not null default now(),
  was_minor     boolean not null,
  market_id     uuid,
  reports_about int not null default 0,
  hits_cancelled int not null default 0
);
revoke all on app.deleted_accounts from public;
comment on table app.deleted_accounts is
  'Tombstones. No personal data: existence, age band, market and counts only.';

-- 3. The call ----------------------------------------------------------------------------
create or replace function app.delete_account()
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_me   uuid := app.uid();
  v_prof app.profiles%rowtype;
  k      record;
  v_cancelled int := 0;
  v_reports   int := 0;
begin
  if v_me is null then raise exception 'not signed in'; end if;

  select * into v_prof from app.profiles where id = v_me;

  -- A guardian leaving is somebody else's problem, so deal with it first. Revoking the
  -- link rather than deleting it keeps the audit trail: a parent who was here, and left.
  -- The child's pending hits come off the board in the same pass, because
  -- `all_guardian_approvals_present` is about to start returning false for them.
  for k in
    with dropped as (
      update app.guardian_links
         set revoked_at = now()
       where guardian_user_id = v_me and revoked_at is null
      returning minor_profile_id
    )
    select distinct minor_profile_id from dropped
  loop
    update app.hit_requests
       set state = 'cancelled'
     where (from_profile_id = k.minor_profile_id or to_profile_id = k.minor_profile_id)
       and state in ('pending', 'countered', 'accepted', 'confirmed');
    perform app.enqueue(k.minor_profile_id, 'guardian_left', 'Your parent removed their account',
      'Ask them to set it up again, or add someone else. Your hits are paused until then.',
      '{}'::jsonb);
  end loop;

  -- Then their own live hits. Told from the rows the UPDATE actually touched, the same
  -- way suspension does it, so a hit somebody else cancelled in the same second is not
  -- counted here or announced twice.
  if v_prof.id is not null then
    for k in
      with killed as (
        update app.hit_requests
           set state = 'cancelled'
         where (from_profile_id = v_me or to_profile_id = v_me)
           and state in ('pending', 'countered', 'accepted', 'confirmed')
        returning id, from_profile_id, to_profile_id
      )
      select * from killed
    loop
      v_cancelled := v_cancelled + 1;
      -- Not "they deleted their account". The counterparty is owed the fact that the hit
      -- is off, not a note about somebody else's decision to leave.
      perform app.enqueue(
        case when k.from_profile_id = v_me then k.to_profile_id else k.from_profile_id end,
        'hit_cancelled', 'That hit is off',
        'It is no longer happening. Nothing you did -- you can find someone else this week.',
        jsonb_build_object('hit', k.id));
    end loop;

    select count(*) into v_reports from app.reports where reported_ref = v_me;

    insert into app.deleted_accounts (profile_id, was_minor, market_id, reports_about, hits_cancelled)
    values (v_me, v_prof.adult_at > current_date, v_prof.market_id, v_reports, v_cancelled)
    on conflict (profile_id) do nothing;
  end if;

  -- The photo. A public-read bucket means the URL works for anyone holding it, so the
  -- object has to go, not just the row that points at it.
  if to_regclass('storage.objects') is not null then
    execute 'delete from storage.objects where bucket_id = ''avatars''
               and (storage.foldername(name))[1] = $1' using v_me::text;
  end if;

  -- Everything hanging off the profile cascades: private row, messages, blocks, phone
  -- shares, approvals, push tokens, invites issued, roster membership.
  delete from app.profiles where id = v_me;

  -- And the login itself, or the account is not deleted, it is emptied. The caller's JWT
  -- stays valid until it expires, which is why the client signs out immediately after.
  if to_regclass('auth.users') is not null then
    execute 'delete from auth.users where id = $1' using v_me;
  end if;
end;
$$;

revoke execute on function app.delete_account() from public, anon;
grant execute on function app.delete_account() to authenticated;

comment on function app.delete_account() is
  'Irreversible. Cancels live hits, revokes guardianships, removes the photo object, '
  'deletes the profile and the auth user. Safety reports survive via reports.reported_ref.';

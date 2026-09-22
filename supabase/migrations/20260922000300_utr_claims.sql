-- Verified levels without the Engage API.
--
-- The partner credential is a paid application with a waiting period, and the badge is
-- the most valuable thing in the product, so it cannot wait for it. This is the bridge: a
-- player states their UTR and hands over enough to check it -- their UTR profile link and
-- the name on that profile -- and a human confirms it against utrsports.net before the
-- badge is granted.
--
-- The rule the whole product rests on is unchanged: a player can never award themselves
-- the badge. submit_utr_claim only files a claim. review_utr_claim is service-role only,
-- exactly like apply_utr. When the Engage API does land, that flow writes the same
-- columns and this one keeps working for anyone it cannot reach.

create type app.utr_claim_state as enum ('pending', 'approved', 'rejected', 'withdrawn');

create table app.utr_claims (
  id            uuid primary key default uuid_generate_v4(),
  profile_id    uuid not null references app.profiles(id) on delete cascade,
  claimed_rating numeric(4,2) not null check (claimed_rating between 1 and 16.5),
  profile_url   text not null,                  -- their utrsports.net profile
  full_name     text not null,                  -- the name on that profile
  note          text,                           -- anything they want to add
  state         app.utr_claim_state not null default 'pending',
  decided_rating numeric(4,2),                  -- what the reviewer actually saw
  reviewer_note text,                           -- shown to the player on a rejection
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

create index utr_claims_queue_idx on app.utr_claims (created_at) where state = 'pending';
create unique index utr_claims_one_open_idx on app.utr_claims (profile_id) where state = 'pending';

alter table app.utr_claims enable row level security;
grant select on app.utr_claims to authenticated;

-- You can read your own claim and nobody else's. Reviewers work through service_role.
create policy utr_claims_select_own on app.utr_claims
  for select to authenticated
  using (profile_id = app.uid());

-- Where the badge came from. The enum stays as it is -- 'utr_verified' is the badge
-- either way -- but a claim reviewed by a person is not the same provenance as one
-- confirmed by UTR's own API, and that distinction matters to a partner later.
alter table app.profiles add column utr_verified_by text
  check (utr_verified_by in ('api', 'review'));
comment on column app.profiles.utr_verified_by is
  'How the UTR badge was granted: ''api'' (Engage OAuth) or ''review'' (a person checked utrsports.net).';

-- Filing a claim ------------------------------------------------------------------------
create or replace function app.submit_utr_claim(
  p_rating numeric, p_profile_url text, p_full_name text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare v_id uuid;
begin
  if app.uid() is null then raise exception 'sign in first'; end if;
  if p_rating is null or p_rating < 1 or p_rating > 16.5 then
    raise exception 'That is not a UTR.';
  end if;
  if coalesce(trim(p_profile_url), '') = '' or p_profile_url !~* '^https?://' then
    raise exception 'We need the link to your UTR profile so we can check it.';
  end if;
  if length(coalesce(trim(p_full_name), '')) < 2 then
    raise exception 'We need the name on your UTR profile.';
  end if;

  -- One open claim at a time. Re-submitting replaces the one that is still waiting.
  delete from app.utr_claims where profile_id = app.uid() and state = 'pending';

  insert into app.utr_claims (profile_id, claimed_rating, profile_url, full_name, note)
  values (app.uid(), p_rating, trim(p_profile_url), trim(p_full_name), nullif(trim(p_note), ''))
  returning id into v_id;

  -- A claim is a self-report until someone checks it, so the number goes in as one.
  update app.profiles
     set level_value = p_rating,
         level_source = case when level_source = 'utr_verified' then level_source else 'utr_self'::app.level_source end
   where id = app.uid();

  return v_id;
end;
$$;

grant execute on function app.submit_utr_claim(numeric, text, text, text) to authenticated;

-- Withdrawing is the player's own call.
create or replace function app.withdraw_utr_claim()
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if app.uid() is null then raise exception 'sign in first'; end if;
  update app.utr_claims set state = 'withdrawn', decided_at = now()
   where profile_id = app.uid() and state = 'pending';
end;
$$;

grant execute on function app.withdraw_utr_claim() to authenticated;

-- What the player is shown about their own claim.
create or replace function app.my_utr_claim()
returns table (
  id uuid, claimed_rating numeric, profile_url text, full_name text,
  state app.utr_claim_state, decided_rating numeric, reviewer_note text,
  decided_at timestamptz, created_at timestamptz
)
language sql
stable
security definer
set search_path = app, public
as $$
  select c.id, c.claimed_rating, c.profile_url, c.full_name, c.state, c.decided_rating,
         c.reviewer_note, c.decided_at, c.created_at
    from app.utr_claims c
   where c.profile_id = app.uid()
     and c.state <> 'withdrawn'
   order by c.created_at desc
   limit 1;
$$;

grant execute on function app.my_utr_claim() to authenticated;

-- Reviewing -------------------------------------------------------------------------------
--
-- Service role only. This is the line that keeps the badge worth something: no client
-- role can reach it, exactly as with apply_utr.
create or replace function app.review_utr_claim(
  p_claim uuid, p_approve boolean, p_rating numeric default null, p_note text default null)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare c app.utr_claims;
begin
  select * into c from app.utr_claims where id = p_claim and state = 'pending';
  if not found then raise exception 'no open claim %', p_claim; end if;

  update app.utr_claims
     set state = case when p_approve then 'approved' else 'rejected' end::app.utr_claim_state,
         decided_rating = case when p_approve then coalesce(p_rating, c.claimed_rating) else null end,
         reviewer_note = p_note,
         decided_at = now()
   where id = p_claim;

  if p_approve then
    update app.profiles
       set level_value = coalesce(p_rating, c.claimed_rating),
           level_source = 'utr_verified'::app.level_source,
           utr_verified_at = now(),
           utr_verified_by = 'review'
     where id = c.profile_id;
    perform app.enqueue(c.profile_id, 'utr_verified', 'Your UTR is verified',
      'Your level now carries the verified badge.', jsonb_build_object('claim', p_claim));
  else
    perform app.enqueue(c.profile_id, 'utr_rejected', 'We could not verify that UTR',
      coalesce(p_note, 'Check the link and the name on your UTR profile, then try again.'),
      jsonb_build_object('claim', p_claim));
  end if;
end;
$$;

revoke execute on function app.review_utr_claim(uuid, boolean, numeric, text) from public, anon, authenticated;

-- The review queue, as a view the SQL editor can just select from.
create or replace view app.utr_review_queue as
  select c.id            as claim_id,
         p.display_name  as player,
         p.last_initial,
         case when p.adult_at > current_date then 'under 18' else 'adult' end as band,
         c.claimed_rating,
         p.level_value   as current_level,
         c.full_name     as name_on_utr,
         c.profile_url,
         c.note,
         c.created_at
    from app.utr_claims c
    join app.profiles p on p.id = c.profile_id
   where c.state = 'pending'
   order by c.created_at;

revoke all on app.utr_review_queue from public, anon, authenticated;

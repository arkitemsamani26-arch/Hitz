-- Who decided this?
--
-- Both review paths were written to record the reviewer as `app.uid()`, which reads the
-- JWT claim. The reviewer works in the SQL editor, where there is no JWT, so app.uid() is
-- null -- and `supabase/moderation.sql` is the file that tells them to work there. Every
-- decision has therefore been recording its author as nothing at all, in the one table
-- whose entire job is to say what was done about a person and why. review_utr_claim never
-- had a reviewer column in the first place.
--
-- The fix is the same posture as requiring a resolution: you cannot make one of these
-- decisions anonymously. A text label rather than a uuid, because the reviewer is a person
-- at a keyboard with no row in app.profiles, and inventing one for them would be worse
-- than writing down their name. `reviewed_by` stays for the day there is a real reviewer
-- identity to put in it.

alter table app.reports     add column if not exists reviewed_by_label text;
alter table app.utr_claims  add column if not exists decided_by        text;

comment on column app.reports.reviewed_by_label is
  'Who made this call, as they typed it. Required by review_report(); app.uid() is null in the SQL editor.';
comment on column app.utr_claims.decided_by is
  'Who checked this UTR against utrsports.net, as they typed it. Required by review_utr_claim().';

-- Both functions gain a required reviewer, which changes their signatures. The old ones
-- have to go rather than linger as overloads: an overload that still records nobody is
-- worse than no fix, because it stays callable and looks right.
drop function if exists app.review_report(uuid, text, text, boolean);
drop function if exists app.review_utr_claim(uuid, boolean, numeric, text);

create or replace function app.review_report(
  p_report     uuid,
  p_action     text,                       -- 'suspend' | 'dismiss'
  p_resolution text,
  p_reviewer   text,                       -- you, by name. Not optional.
  p_reinstate  boolean default false
)
-- Returns how many live hits the decision cancelled, so the reviewer sees the blast
-- radius of what they just did rather than guessing at it.
returns int
language plpgsql
security definer
set search_path = app, public
as $$
declare r app.reports; v_cancelled int := 0;
begin
  if p_action not in ('suspend', 'dismiss') then
    raise exception 'action must be suspend or dismiss, not %', p_action;
  end if;
  if coalesce(btrim(p_resolution), '') = '' then
    raise exception 'every decision leaves a resolution';
  end if;
  if coalesce(btrim(p_reviewer), '') = '' then
    raise exception 'every decision leaves a reviewer';
  end if;

  select * into r from app.reports where id = p_report and state in ('open', 'reviewing');
  if not found then raise exception 'no open report %', p_report; end if;

  if p_action = 'suspend' then
    v_cancelled := app.suspend_profile(r.reported_profile_id);
  elsif p_reinstate then
    perform app.reinstate_profile(r.reported_profile_id);
  end if;

  update app.reports
     set state = case when p_action = 'suspend' then 'actioned' else 'dismissed' end::app.report_state,
         resolution = p_resolution,
         reviewed_by = app.uid(),           -- null from the SQL editor; the label is the record
         reviewed_by_label = btrim(p_reviewer),
         reviewed_at = now()
   where id = p_report;

  -- Close the loop. "Goes to a person, same day" is a promise the interface makes on the
  -- reviewer's behalf, and a reporter who never hears anything learns not to bother.
  -- What happened to the other account is not the reporter's to know, and neither is who
  -- handled it.
  perform app.enqueue(r.reporter_profile_id, 'report_reviewed', 'We read your report',
    case when p_action = 'suspend' then 'Thank you. We acted on it.'
         else 'Thank you. We looked into it and took no action this time.' end,
    jsonb_build_object('report', p_report));

  return v_cancelled;
end;
$$;

revoke execute on function app.review_report(uuid, text, text, text, boolean) from public, anon, authenticated;
grant  execute on function app.review_report(uuid, text, text, text, boolean) to service_role;

create or replace function app.review_utr_claim(
  p_claim    uuid,
  p_approve  boolean,
  p_reviewer text,                          -- you, by name. Not optional.
  p_rating   numeric default null,
  p_note     text default null)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare c app.utr_claims;
begin
  if coalesce(btrim(p_reviewer), '') = '' then
    raise exception 'every decision leaves a reviewer';
  end if;

  select * into c from app.utr_claims where id = p_claim and state = 'pending';
  if not found then raise exception 'no open claim %', p_claim; end if;

  update app.utr_claims
     set state = case when p_approve then 'approved' else 'rejected' end::app.utr_claim_state,
         decided_rating = case when p_approve then coalesce(p_rating, c.claimed_rating) else null end,
         reviewer_note = p_note,
         decided_by = btrim(p_reviewer),
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

revoke execute on function app.review_utr_claim(uuid, boolean, text, numeric, text) from public, anon, authenticated;
grant  execute on function app.review_utr_claim(uuid, boolean, text, numeric, text) to service_role;

-- What was decided, by whom. The thing the reports table was supposed to be able to answer
-- all along, and the first place to look when somebody asks why an account is suspended.
create or replace view app.moderation_log as
  select r.reviewed_at,
         r.reviewed_by_label as reviewer,
         r.state,
         r.reason,
         r.resolution,
         p.display_name || ' ' || coalesce(p.last_initial, '') as reported,
         p.status            as reported_status_now,
         r.involves_minor,
         r.id                as report_id
    from app.reports r
    join app.profiles p on p.id = r.reported_profile_id
   where r.reviewed_at is not null
   order by r.reviewed_at desc;

revoke all on app.moderation_log from public, anon, authenticated;
grant select on app.moderation_log to service_role;

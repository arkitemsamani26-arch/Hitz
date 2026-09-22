-- The report button says "goes to a person, same day". This is that person's tooling.
--
-- Until now the only way to act on a report was three hand-typed UPDATEs against three
-- tables, in the right order, with the right ids pasted twice. That is not a moderation
-- surface, it is a way to half-suspend somebody at one in the morning: update the profile,
-- get distracted, and the report stays open with no record of who did what. And two things
-- the manual path never did at all -- a suspended player's already-accepted hits stayed on
-- the other person's calendar, and the reporter was never told anything, which is the
-- promise the button actually makes.
--
-- One call. Service-role only, exactly like the UTR review path: moderation is not a
-- client feature and there is no code path from a signed-in user to any of this.

-- Suspending is not only a flag ---------------------------------------------------------
--
-- A suspended profile drops out of discovery and cannot act, but a hit that was already
-- confirmed is a time and a place that two people -- and possibly a parent who approved
-- it -- still have written down. Pulling the profile has to pull those with it.
create or replace function app.suspend_profile(p_profile uuid)
returns int
language plpgsql
security definer
set search_path = app, public
as $$
declare k record; v_cancelled int := 0;
begin
  update app.profiles set status = 'suspended'
   where id = p_profile and status <> 'deleted';

  -- Told from the rows the UPDATE actually touched, rather than re-reading cancelled
  -- hits afterwards: any "and updated recently" filter would also sweep up hits somebody
  -- else cancelled in the same breath.
  for k in
    with killed as (
      update app.hit_requests
         set state = 'cancelled'
       where (from_profile_id = p_profile or to_profile_id = p_profile)
         and state in ('pending', 'countered', 'accepted', 'confirmed')
      returning id, from_profile_id, to_profile_id
    )
    select * from killed
  loop
    v_cancelled := v_cancelled + 1;
    -- The other side is told their hit is off. Not why, and not by whom: a report is
    -- confidential to the person who made it, and "we cancelled this" is the whole of
    -- what the counterparty is owed.
    perform app.enqueue(
      case when k.from_profile_id = p_profile then k.to_profile_id else k.from_profile_id end,
      'hit_cancelled', 'That hit is off',
      'We cancelled it. Nothing you did -- you can find someone else this week.',
      jsonb_build_object('hit', k.id));
  end loop;

  return v_cancelled;
end;
$$;

revoke execute on function app.suspend_profile(uuid) from public, anon, authenticated;

create or replace function app.reinstate_profile(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  update app.profiles set status = 'active' where id = p_profile and status = 'suspended';
  perform app.enqueue(p_profile, 'reinstated', 'You are back on',
    'We reviewed your account and reopened it. Sorry for the interruption.', '{}'::jsonb);
end;
$$;

revoke execute on function app.reinstate_profile(uuid) from public, anon, authenticated;

-- One call per decision -------------------------------------------------------------------
--
-- p_reinstate exists because of a trap in the auto-hide rule: three distinct reporters in
-- thirty days hides a profile automatically, which is the right default, but if a reviewer
-- then dismisses all three as bogus the profile stays hidden forever unless somebody
-- remembers a fourth statement. Dismissing the last open report against a suspended
-- player asks about it rather than leaving them hidden by inertia.
create or replace function app.review_report(
  p_report     uuid,
  p_action     text,                       -- 'suspend' | 'dismiss'
  p_resolution text,
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
         reviewed_by = app.uid(),
         reviewed_at = now()
   where id = p_report;

  -- Close the loop. "Goes to a person, same day" is a promise the interface makes on the
  -- reviewer's behalf, and a reporter who never hears anything learns not to bother.
  -- What happened to the other account is not the reporter's to know.
  perform app.enqueue(r.reporter_profile_id, 'report_reviewed', 'We read your report',
    case when p_action = 'suspend' then 'Thank you. We acted on it.'
         else 'Thank you. We looked into it and took no action this time.' end,
    jsonb_build_object('report', p_report));

  return v_cancelled;
end;
$$;

revoke execute on function app.review_report(uuid, text, text, boolean) from public, anon, authenticated;

-- The queue, as a view the SQL editor can just select from. Minors first, oldest first:
-- a report touching a minor's thread is the one that cannot wait for tomorrow.
create or replace view app.moderation_queue as
  select r.id                                         as report_id,
         r.created_at,
         r.involves_minor,
         r.reason,
         r.body,
         rp.display_name || ' ' || coalesce(rp.last_initial, '') as reported,
         rp.status                                    as reported_status,
         case when rp.adult_at > current_date then 'under 18' else 'adult' end as reported_band,
         (select count(distinct x.reporter_profile_id)
            from app.reports x
           where x.reported_profile_id = r.reported_profile_id
             and x.created_at > now() - interval '30 days')      as reporters_30d,
         r.reported_profile_id,
         r.hit_request_id
    from app.reports r
    join app.profiles rp on rp.id = r.reported_profile_id
   where r.state in ('open', 'reviewing')
   order by r.involves_minor desc, r.created_at;

revoke all on app.moderation_queue from public, anon, authenticated;

-- Profiles the auto-hide rule took down that no human has ruled on yet. This is the list
-- that must reach zero every day: each row is somebody locked out by a machine.
create or replace view app.moderation_auto_hidden as
  select p.id as profile_id,
         p.display_name || ' ' || coalesce(p.last_initial, '') as player,
         count(distinct r.reporter_profile_id) as reporters_30d,
         count(*) filter (where r.state in ('open', 'reviewing')) as still_open,
         min(r.created_at) as first_report
    from app.profiles p
    join app.reports r on r.reported_profile_id = p.id
   where p.status = 'suspended'
     and r.created_at > now() - interval '30 days'
   group by p.id, p.display_name, p.last_initial
  having count(*) filter (where r.state in ('open', 'reviewing')) > 0
   order by 3 desc;

revoke all on app.moderation_auto_hidden from public, anon, authenticated;

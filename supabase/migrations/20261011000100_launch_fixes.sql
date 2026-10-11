-- Launch fixes found walking the app end to end (docs/16-launch-audit.md).
--
-- 1. Changing the plan without changing the state.
--    The update policy lets either participant write the row, and guard_hit_state already
--    clears every guardian approval when the court or the window changes. But the state
--    was left as the client sent it, so a confirmed hit could be moved to a new time or
--    court and stay 'confirmed', with the other player never asked. Any change to the
--    court or the window is now a counterproposal, whatever the client sent: it is the
--    other player's turn, and the expiry is reset so a hit arranged weeks ago does not
--    expire the minute it is rescheduled. A hit that has already happened cannot be moved.
--
-- 2. Push text in UTC.
--    to_char(window_start, ...) ran in the database's zone, so a 6pm Palo Alto hit was
--    announced as "Tue 01am". Times are now formatted in the market's own zone.
--
-- 3. Silent counters, passes and cancellations.
--    Only 'accepted' and 'confirmed' sent a push. Someone suggesting another time, passing
--    or cancelling now tells the person it affects.
--
-- 4. A playing preference ("Practice sets", "Rally & drills"), shown under a player's
--    name, chosen from the app. Optional, short, and returned by discover.
--
-- 5. Court addresses at city level, so "Directions" finds the right park. The stored
--    points are still approximate (see seed.sql); a city is honest where a pin is not.

-- 4 -------------------------------------------------------------------------------------
alter table app.profiles
  add column if not exists prefers text
  check (prefers is null or char_length(btrim(prefers)) between 1 and 40);

comment on column app.profiles.prefers is
  'What kind of hit the player is usually after, in a few words. Chosen in the app; optional.';

-- 2 and 3 ---------------------------------------------------------------------------
-- "Tue 6pm", "Tue 6:30pm", in the zone of the market the hit's court belongs to.
create or replace function app.hit_when(p_ts timestamptz, p_court uuid, p_day boolean default true)
returns text
language sql
stable
set search_path = app, public
as $$
  with z as (
    select p_ts at time zone coalesce(
      (select m.timezone from app.courts c join app.markets m on m.id = c.market_id where c.id = p_court),
      'America/Los_Angeles') as lt
  )
  select case when p_day then to_char(lt, 'Dy ') else '' end
      || case when extract(minute from lt) = 0 then to_char(lt, 'FMHH12am') else to_char(lt, 'FMHH12:MIam') end
    from z;
$$;

-- Only the definer-run notify functions call this.
revoke execute on function app.hit_when(timestamptz, uuid, boolean) from public, anon, authenticated;

create or replace function app.notify_on_request()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare who text; court text;
begin
  select display_name into who from app.profiles where id = new.from_profile_id;
  select name into court from app.courts where id = new.court_id;
  perform app.enqueue(new.to_profile_id, 'request_received', who || ' wants to hit',
    app.hit_when(new.window_start, new.court_id) || ' · ' || court, jsonb_build_object('hit', new.id));
  return null;
end; $$;

create or replace function app.notify_on_state()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare who text; court text; a record; actor uuid; other uuid; actor_name text; whenx text;
begin
  select name into court from app.courts where id = new.court_id;
  whenx := app.hit_when(new.window_start, new.court_id);
  actor := app.uid();
  if new.state = 'accepted' and old.state is distinct from 'accepted' then
    select display_name into who from app.profiles where id = new.to_profile_id;
    perform app.enqueue(new.from_profile_id, 'request_accepted', who || '''s in', 'Waiting on a parent to lock it in.', jsonb_build_object('hit', new.id));
    for a in select ga.guardian_user_id, p.display_name from app.hit_guardian_approvals ga join app.profiles p on p.id = ga.minor_profile_id where ga.hit_request_id = new.id loop
      perform app.enqueue(a.guardian_user_id, 'approval_needed', a.display_name || ' has a hit to approve', court || ' · ' || whenx, jsonb_build_object('hit', new.id));
    end loop;
  elsif new.state = 'confirmed' and old.state is distinct from 'confirmed' then
    perform app.enqueue(new.from_profile_id, 'confirmed', 'It''s on.', court || ' · ' || whenx, jsonb_build_object('hit', new.id));
    perform app.enqueue(new.to_profile_id, 'confirmed', 'It''s on.', court || ' · ' || whenx, jsonb_build_object('hit', new.id));
  elsif new.state = 'countered' and new.awaiting_profile_id is not null
        and (old.state is distinct from 'countered' or old.window_start is distinct from new.window_start or old.court_id is distinct from new.court_id) then
    other := new.awaiting_profile_id;
    select display_name into actor_name from app.profiles
     where id = case when other = new.from_profile_id then new.to_profile_id else new.from_profile_id end;
    perform app.enqueue(other, 'countered', actor_name || ' suggested another time', whenx || ' · ' || court, jsonb_build_object('hit', new.id));
  elsif new.state = 'declined' and old.state is distinct from 'declined' and old.state in ('pending', 'countered') then
    -- The person who did not pass hears it, with the reason they were given.
    other := case when old.awaiting_profile_id = new.from_profile_id then new.to_profile_id else new.from_profile_id end;
    select display_name into actor_name from app.profiles where id = old.awaiting_profile_id;
    if other is not null and actor_name is not null then
      perform app.enqueue(other, 'declined', actor_name || ' passed', coalesce(new.decline_reason, 'Not this time.'), jsonb_build_object('hit', new.id));
    end if;
  elsif new.state = 'cancelled' and old.state is distinct from 'cancelled' and old.state in ('pending', 'countered', 'accepted', 'confirmed') then
    if actor is not null then
      other := case when actor = new.from_profile_id then new.to_profile_id else new.from_profile_id end;
      select display_name into actor_name from app.profiles where id = actor;
      if other is not null and actor_name is not null then
        perform app.enqueue(other, 'cancelled', actor_name || ' cancelled', whenx || ' · ' || court, jsonb_build_object('hit', new.id));
      end if;
    end if;
  end if;
  return null;
end; $$;

create or replace function app.enqueue_tomorrow_reminders()
returns int language plpgsql security definer set search_path = app, public as $$
declare n int := 0; h record;
begin
  for h in select r.*, c.name as court from app.hit_requests r join app.courts c on c.id = r.court_id
            where r.state = 'confirmed' and r.window_start between now() + interval '20 hours' and now() + interval '28 hours'
              and not exists (select 1 from app.notifications n where n.kind = 'hit_tomorrow' and (n.data->>'hit')::uuid = r.id) loop
    perform app.enqueue(h.from_profile_id, 'hit_tomorrow', 'Hit tomorrow', app.hit_when(h.window_start, h.court_id, false) || ' · ' || h.court, jsonb_build_object('hit', h.id));
    perform app.enqueue(h.to_profile_id, 'hit_tomorrow', 'Hit tomorrow', app.hit_when(h.window_start, h.court_id, false) || ' · ' || h.court, jsonb_build_object('hit', h.id));
    n := n + 1;
  end loop;
  return n;
end; $$;

-- The notify trigger now has to see more than the state column change.
drop trigger if exists hit_requests_notify_state on app.hit_requests;
create trigger hit_requests_notify_state
  after update of state, window_start, court_id on app.hit_requests
  for each row execute function app.notify_on_state();

-- 1 --------------------------------------------------------------------------------
create or replace function app.guard_hit_plan_change()
returns trigger
language plpgsql
set search_path = app, public
as $$
declare me uuid := app.uid();
begin
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'hit_requests') then
    return new;
  end if;
  if new.court_id is not distinct from old.court_id
     and new.window_start is not distinct from old.window_start
     and new.window_end is not distinct from old.window_end then
    return new;
  end if;
  if old.state not in ('pending', 'countered', 'accepted', 'confirmed') then
    raise exception 'This hit is closed. Start a new invitation instead.';
  end if;
  if old.window_end < now() then
    raise exception 'This hit has already happened.';
  end if;
  if new.window_start < now() then
    raise exception 'Pick a time that has not passed.';
  end if;
  -- A change of time or place is always a new proposal, and it is always the other
  -- player's turn.
  new.state := 'countered';
  new.awaiting_profile_id := case when me = old.from_profile_id then old.to_profile_id else old.from_profile_id end;
  new.expires_at := least(new.window_start, now() + interval '72 hours');
  new.confirmed_at := null;
  return new;
end;
$$;

drop trigger if exists hit_requests_plan_change on app.hit_requests;
create trigger hit_requests_plan_change
  before update of court_id, window_start, window_end on app.hit_requests
  for each row execute function app.guard_hit_plan_change();

revoke execute on function app.guard_hit_plan_change() from public, anon, authenticated;

-- 4, continued: discover returns the preference --------------------------------------------
drop function if exists app.discover(int, numeric, numeric, int, boolean, interval, int, int);

create function app.discover(
  p_radius_m      int default 40234,
  p_level_lo      numeric default null,
  p_level_hi      numeric default null,
  p_availability  int default 0,
  p_only_looking  boolean default false,
  p_active_within interval default interval '30 days',
  p_limit         int default 50,
  p_offset        int default 0
)
returns table (
  profile_id        uuid,
  display_name      text,
  last_initial      text,
  photo_url         text,
  level_value       numeric,
  level_source      app.level_source,
  level_verified    boolean,
  level_delta       numeric,
  distance_bucket   text,
  home_court_id     uuid,
  availability_mask int,
  looking_to_hit    boolean,
  last_active_at    timestamptz,
  response_rate     numeric,
  accept_rate       numeric,
  hits_confirmed    int,
  prefers           text
)
language sql
stable
security invoker
set search_path = app, public
as $$
  with me as (
    select id, level_value, snapped_point
      from app.profiles where id = app.uid()
  )
  select
    p.id,
    p.display_name,
    p.last_initial,
    p.photo_url,
    p.level_value,
    p.level_source,
    p.level_source = 'utr_verified',
    abs(p.level_value - me.level_value) as level_delta,
    app.distance_bucket_m(ST_Distance(p.snapped_point, me.snapped_point)),
    p.home_court_id,
    p.availability_mask,
    (p.looking_to_hit_until is not null and p.looking_to_hit_until > now()),
    p.last_active_at,
    case when p.requests_received = 0 then null
         else round(p.requests_responded::numeric / p.requests_received, 2) end,
    case when p.requests_responded = 0 then null
         else round(p.requests_accepted::numeric / p.requests_responded, 2) end,
    p.hits_confirmed,
    p.prefers
  from app.profiles p
  cross join me
  where p.id <> me.id
    and app.cohort_discovery_open(me.id)
    and p.snapped_point is not null
    and me.snapped_point is not null
    and ST_DWithin(p.snapped_point, me.snapped_point, p_radius_m)
    and (p_level_lo is null or p.level_value >= p_level_lo)
    and (p_level_hi is null or p.level_value <= p_level_hi)
    and (p_availability = 0 or (p.availability_mask & p_availability) > 0)
    and (not p_only_looking or (p.looking_to_hit_until is not null and p.looking_to_hit_until > now()))
    and p.last_active_at > now() - p_active_within
  order by
    abs(p.level_value - me.level_value) asc,
    ST_Distance(p.snapped_point, me.snapped_point) asc
  limit p_limit offset p_offset;
$$;

revoke execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int) from public, anon;
grant execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int) to authenticated;

-- 5 -------------------------------------------------------------------------------------
update app.courts set address = v.addr
  from (values
    ('Rinconada Park', 'Rinconada Park, Palo Alto, CA'),
    ('Mitchell Park', 'Mitchell Park, Palo Alto, CA'),
    ('Cubberley Courts', 'Cubberley Community Center, Palo Alto, CA'),
    ('Burgess Park', 'Burgess Park, Menlo Park, CA'),
    ('Nealon Park', 'Nealon Park, Menlo Park, CA'),
    ('Stanford Taube Courts', 'Taube Family Tennis Center, Stanford, CA'),
    ('Cuesta Park', 'Cuesta Park, Mountain View, CA'),
    ('Sunnyvale Tennis Center', 'Sunnyvale Tennis Center, Sunnyvale, CA'),
    ('Los Altos Hills Courts', 'Los Altos Hills, CA'),
    ('Cupertino Tennis Center', 'Cupertino Sports Center, Cupertino, CA')
  ) as v(name, addr)
 where app.courts.name = v.name and app.courts.address is null;

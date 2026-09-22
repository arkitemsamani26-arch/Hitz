-- Fixes found by pointing the app at the live project instead of the demo backend.
--
-- The headline one is discovery: nothing ever wrote app.profiles.snapped_point, and
-- app.discover hard-requires it on both sides, so a real signup saw an empty feed
-- forever. The product already asks for the one piece of location it needs -- a home
-- court -- so that is what seeds the point.

-- 1. A home court IS your location on Hits ---------------------------------------------
--
-- Snapped to the same coarse grid as a device fix, so the privacy story does not change:
-- ~2km, enough to say "around here", never enough to say "lives there". A real device
-- location still wins when the player grants it, because profiles_private's trigger
-- overwrites this afterwards.
create or replace function app.sync_home_court_point()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare v_point geography;
begin
  if new.home_court_id is null then
    return new;
  end if;
  -- A device fix, once given, outranks the court.
  if exists (select 1 from app.profiles_private pp
              where pp.profile_id = new.id and pp.exact_point is not null) then
    return new;
  end if;
  select c.point into v_point from app.courts c where c.id = new.home_court_id;
  new.snapped_point := app.snap_point(v_point);
  return new;
end;
$$;

create trigger profiles_home_court_point
  before insert or update of home_court_id on app.profiles
  for each row execute function app.sync_home_court_point();

-- Backfill anyone who signed up before this existed.
update app.profiles p
   set snapped_point = app.snap_point(c.point)
  from app.courts c
 where c.id = p.home_court_id
   and p.snapped_point is null;

-- 2. Whose move it is is a rule, not a hint --------------------------------------------
--
-- hit_requests_update_participant lets either side write the row, which is right for
-- countering and planning but wrong for the decision itself: the sender could accept
-- their own request. The demo backend enforced this and the live one did not.
--
-- First, an open request always knows whose move it is. The client sets it; this makes
-- it true of every row, so the guard below never has a null to reason about.
create or replace function app.default_hit_turn()
returns trigger
language plpgsql
as $$
begin
  if new.awaiting_profile_id is null and new.state in ('pending', 'countered') then
    new.awaiting_profile_id := new.to_profile_id;
  end if;
  return new;
end;
$$;

create trigger hit_requests_default_turn
  before insert on app.hit_requests
  for each row execute function app.default_hit_turn();

update app.hit_requests
   set awaiting_profile_id = to_profile_id
 where awaiting_profile_id is null
   and state in ('pending', 'countered');

create or replace function app.guard_hit_turn()
returns trigger
language plpgsql
as $$
begin
  -- Server-owned paths (definer functions, service_role) are not playing a turn.
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'hit_requests') then
    return new;
  end if;
  if old.state in ('pending', 'countered')
     and new.state in ('accepted', 'declined')
     and new.state is distinct from old.state
     and old.awaiting_profile_id is not null
     and old.awaiting_profile_id is distinct from app.uid() then
    raise exception 'It is not your move.';
  end if;
  return new;
end;
$$;

create trigger hit_requests_turn_order
  before update on app.hit_requests
  for each row execute function app.guard_hit_turn();

-- 3. "Did you hit?" is answerable twice ------------------------------------------------
--
-- The client inserts a confirmation; tapping again, or changing your mind, hit a
-- duplicate-key error surfaced as a raw Postgres message. An upsert needs update.
grant update on app.hit_confirmations to authenticated;

create policy hit_confirmations_update_own on app.hit_confirmations
  for update to authenticated
  using (profile_id = app.uid() and app.is_hit_participant(hit_request_id))
  with check (profile_id = app.uid());

-- 4. Execute privileges say what the foundation always claimed -------------------------
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, so two housekeeping
-- functions meant for the cron job were callable by any signed-in user: one could
-- expire every open request in the database.
revoke execute on function app.expire_requests() from public, anon, authenticated;
revoke execute on function app.enqueue_tomorrow_reminders() from public, anon, authenticated;
revoke execute on function app.enqueue(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function app.snap_point(geography) from public, anon, authenticated;
revoke execute on function app.sync_snapped_point() from public, anon, authenticated;
revoke execute on function app.sync_home_court_point() from public, anon, authenticated;
revoke execute on function app.guard_hit_turn() from public, anon, authenticated;

-- And stop the next one from happening by default.
alter default privileges in schema app revoke execute on functions from public;

-- 5. The peek screen shows a real number -----------------------------------------------
--
-- It runs before a profile exists, so my_market_status() returns nothing and the screen
-- read "0 juniors around your level near Palo Alto" -- the opposite of the point. This
-- counts the cohort without needing a row, and returns no identities.
create or replace function app.peek_cohort(p_dob date, p_level numeric, p_market text default 'palo-alto')
returns table (players bigint, open boolean)
language sql
stable
security definer
set search_path = app, public
as $$
  with m as (select id from app.markets where slug = p_market),
  band as (
    select case when p_dob + interval '18 years' > now() then 'minor' else 'adult' end::app.age_band as b
  )
  select
    count(*) filter (
      where p.status = 'active'
        and p.last_active_at > now() - interval '30 days'
        and (p_level is null or p.level_value is null or abs(p.level_value - p_level) <= 1.5)
    ),
    coalesce(bool_or(c.discovery_open), false)
  from m
  cross join band
  left join app.profiles p
    on p.market_id = m.id
   and (case when p.adult_at > current_date then 'minor' else 'adult' end)::app.age_band = band.b
  left join app.market_cohorts c
    on c.market_id = m.id and c.age_band = band.b;
$$;

grant execute on function app.peek_cohort(date, numeric, text) to anon, authenticated;

-- 6. A roster's size is not a peer lookup ----------------------------------------------
--
-- The client counted members through an embedded select, which runs under profiles RLS
-- and so reported roughly zero. The count is not private; the members are.
create or replace function app.roster_counts()
returns table (roster_id uuid, joined bigint)
language sql
stable
security definer
set search_path = app, public
as $$
  select r.id, count(p.id)
    from app.rosters r
    left join app.profiles p on p.roster_id = r.id
   where r.created_by = app.uid()
      or r.id = (select roster_id from app.profiles where id = app.uid())
   group by r.id;
$$;

grant execute on function app.roster_counts() to authenticated;

-- 7. A parent can see who their kid would be meeting ------------------------------------
--
-- The approval screen is the whole safety promise, and it was rendering "undefined hits
-- played" against the live backend: a guardian has no profile row, so the peer policy
-- denied the counterparty. This is exactly the person the parent is being asked to judge.
-- Scope is tight: only the other participant, only on a hit their own child is in, and
-- only while that hit is still live.
create or replace function app.is_hit_counterparty_for_my_child(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1
      from app.hit_requests h
      join app.guardian_links g
        on g.guardian_user_id = app.uid()
       and g.verified_at is not null
       and g.revoked_at is null
       and g.minor_profile_id in (h.from_profile_id, h.to_profile_id)
     where p_profile in (h.from_profile_id, h.to_profile_id)
       and p_profile <> g.minor_profile_id
       and h.state in ('pending', 'countered', 'accepted', 'confirmed', 'completed')
  );
$$;

revoke execute on function app.is_hit_counterparty_for_my_child(uuid) from public, anon;
grant execute on function app.is_hit_counterparty_for_my_child(uuid) to authenticated;

create policy profiles_select_guardian_counterparty on app.profiles
  for select to authenticated
  using (app.is_hit_counterparty_for_my_child(id));

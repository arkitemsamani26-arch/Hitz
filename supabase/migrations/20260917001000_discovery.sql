-- Discovery.
--
-- Skill proximity first, distance second. The best player nearby is the WRONG
-- recommendation; the closest player at your level is the right one. In v1 this default
-- sort IS the recommendation -- "Recommended For You" needs responsiveness data that
-- only exists once the product has run.
--
-- SECURITY INVOKER on purpose: every row this returns passes through the RLS policies on
-- app.profiles, so the separation rule, blocks and participation checks apply here for
-- free and cannot be bypassed by a bug in this function.

create or replace function app.distance_bucket_m(m double precision)
returns text
language sql immutable as $$
  select case
    when m is null then null
    when m < 1609 then 'under 1 mi'
    when m < 16093 then '~' || round((m / 1609.34)::numeric)::text || ' mi'
    else '~' || (round((m / 1609.34)::numeric / 5) * 5)::text || ' mi'
  end;
$$;

create or replace function app.discover(
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
  hits_confirmed    int
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
    -- Ghost suppression, visible by default and free. Competitors put response-rate
    -- filtering behind a paywall; it is a trust feature, so it is not a paid one.
    case when p.requests_received = 0 then null
         else round(p.requests_responded::numeric / p.requests_received, 2) end,
    case when p.requests_responded = 0 then null
         else round(p.requests_accepted::numeric / p.requests_responded, 2) end,
    p.hits_confirmed
  from app.profiles p
  cross join me
  where p.id <> me.id
    -- Cohort gating: until a market's cohort clears its own density threshold, a member
    -- gets an honest waiting state rather than a thin feed. A thin feed spends a first
    -- impression you only get once.
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

grant execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int)
  to authenticated;

-- Honest waiting state for a cohort that has not opened yet: "142 of 200 juniors in
-- Boston". A countdown costs nothing and can even build anticipation.
create or replace function app.my_market_status()
returns table (
  market_slug        text,
  age_band           app.age_band,
  active_players     bigint,
  min_active_players int,
  discovery_open     boolean
)
language sql stable security definer set search_path = app, public
as $$
  select d.market_slug::text, d.age_band, d.active_players, d.min_active_players, d.discovery_open
    from app.market_cohort_density d
    join app.profiles p on p.market_id = d.market_id
   where p.id = app.uid()
     and d.age_band = app.profile_band(p.id);
$$;

grant execute on function app.my_market_status() to authenticated;

-- Location is written through a definer function and never read back. The client hands
-- over a point; it cannot ask for one. The app asks for a home COURT, not an address,
-- so in normal operation this holds a device location used once to seed the radius.
create or replace function app.set_my_location(p_lat double precision, p_lon double precision)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if app.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into app.profiles_private (profile_id, exact_point)
  values (app.uid(), ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography)
  on conflict (profile_id) do update
    set exact_point = excluded.exact_point, updated_at = now();
end;
$$;

grant execute on function app.set_my_location(double precision, double precision) to authenticated;

create or replace function app.touch_me()
returns void
language plpgsql security definer set search_path = app, public
as $$
begin
  update app.profiles set last_active_at = now() where id = app.uid();
end;
$$;

grant execute on function app.touch_me() to authenticated;

grant execute on function app.uid(), app.profile_band(uuid), app.can_view_profile(uuid),
  app.can_request_hit(uuid, uuid), app.is_hit_participant(uuid), app.is_hit_guardian(uuid),
  app.is_guardian_of(uuid), app.is_participating(uuid), app.blocked_between(uuid, uuid),
  app.same_band(uuid, uuid), app.has_verified_guardian(uuid), app.cohort_discovery_open(uuid),
  app.all_guardian_approvals_present(uuid), app.band_of(date), app.snap_point(geography),
  app.distance_bucket_m(double precision)
  to authenticated;

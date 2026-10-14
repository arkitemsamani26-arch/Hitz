-- Fixes from review (migration 20261013000300).
--
-- 1. Discovery now runs as the owner, so it is the only thing between a caller and the
--    rounded location cells. Its radius snaps to the four distances the app offers (5, 10,
--    15, 25 miles), and the page size is capped at 1000.
-- 2. Court counts come from discovery itself, so a court never claims more players than its
--    own list shows: same radius, same visibility, same closed-cohort rule, same parent's
--    age rule.

create or replace function app.discover(
  p_radius_m      int default 40234,
  p_level_lo      numeric default null,
  p_level_hi      numeric default null,
  p_availability  int default 0,
  p_only_looking  boolean default false,
  p_active_within interval default interval '30 days',
  p_limit         int default 50,
  p_offset        int default 0,
  p_age_gap       int default null
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
  prefers           text,
  age               int
)
language sql
stable
security definer
set search_path = app, public
as $$
  with me as (
    select id, level_value, snapped_point, date_of_birth, adult_at
      from app.profiles where id = app.uid()
  ),
  -- Only the distances the app offers. A free-form radius could be stepped a metre at a
  -- time to measure exactly how far away someone's rounded cell is.
  lim as (
    select (case when p_radius_m <= 8047 then 8047 when p_radius_m <= 16093 then 16093
                 when p_radius_m <= 24140 then 24140 else 40234 end) as radius_m,
           least(greatest(coalesce(p_limit, 50), 1), 1000) as n
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
    p.prefers,
    case when p.adult_at > current_date and me.adult_at > current_date
         then app.age_years(p.date_of_birth) end
  from app.profiles p
  cross join me
  cross join lim
  where p.id <> me.id
    and app.can_view_profile(p.id)
    and app.age_gap_ok(me.id, p.id)
    and app.cohort_discovery_open(me.id)
    and p.snapped_point is not null
    and me.snapped_point is not null
    and ST_DWithin(p.snapped_point, me.snapped_point, lim.radius_m)
    and (p_level_lo is null or p.level_value >= p_level_lo)
    and (p_level_hi is null or p.level_value <= p_level_hi)
    and (p_availability = 0 or (p.availability_mask & p_availability) > 0)
    and (not p_only_looking or (p.looking_to_hit_until is not null and p.looking_to_hit_until > now()))
    and p.last_active_at > now() - p_active_within
    -- "Around my age", a junior's own filter. A parent's rule is the floor under it.
    and (p_age_gap is null or me.adult_at <= current_date
         or abs(app.age_years(p.date_of_birth) - app.age_years(me.date_of_birth)) <= p_age_gap)
  order by
    abs(p.level_value - me.level_value) asc,
    ST_Distance(p.snapped_point, me.snapped_point) asc
  limit (select n from lim) offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function app.court_players()
returns table (court_id uuid, players int, looking int)
language sql
stable
security definer
set search_path = app, public
as $$
  select d.home_court_id, count(*)::int, count(*) filter (where d.looking_to_hit)::int
    from app.discover(p_radius_m => 40234, p_limit => 1000) d
   where d.home_court_id is not null
   group by d.home_court_id;
$$;

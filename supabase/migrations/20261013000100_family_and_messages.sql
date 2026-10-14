-- Family, age, messages, courts (migration 20261013000100).
--
-- 1. Whoever sends the invitation brings the balls, unless the two of them change it.
-- 2. Other players read the profile columns the app shows, not the whole row. Until now a
--    signed-in player could read a peer's exact date of birth, the photo a parent had not
--    approved yet, and the grid cell their location was rounded to. RLS chose the rows;
--    nothing chose the columns.
-- 3. Juniors see each other's age in years, so two 13-year-olds can find each other.
-- 4. A parent can set how far apart in age their child's partners may be. Enforced on
--    discovery and on sending an invitation, not just hidden in the app.
-- 5. Unread messages: a read marker per player per hit, and the inbox in one call.
-- 6. Courts: how many players call each court home. Counted, never named.

-- 1 -------------------------------------------------------------------------------------
create or replace function app.default_hit_plan()
returns trigger
language plpgsql
set search_path = app, public
as $$
begin
  -- The person asking brings the balls. Said once, here, so every client agrees.
  if coalesce(new.plan->>'ballsById', '') = '' then
    new.plan := coalesce(new.plan, '{}'::jsonb) || jsonb_build_object('ballsById', new.from_profile_id::text);
  end if;
  return new;
end;
$$;

create trigger hit_requests_default_plan
  before insert on app.hit_requests
  for each row execute function app.default_hit_plan();

revoke execute on function app.default_hit_plan() from public, anon, authenticated;

-- Open hits made before this rule get it too, so nobody's plan is blank.
update app.hit_requests
   set plan = plan || jsonb_build_object('ballsById', from_profile_id::text)
 where coalesce(plan->>'ballsById', '') = ''
   and state in ('pending', 'countered', 'accepted', 'confirmed')
   and window_end > now();

-- 2 -------------------------------------------------------------------------------------
-- The parent's age rule lives on the profile (column added here so the grant below can
-- name it) and only a parent can set it.
alter table app.profiles
  add column max_partner_age_gap smallint check (max_partner_age_gap between 1 and 5);

comment on column app.profiles.max_partner_age_gap is
  'Juniors only. Set by a verified parent through set_child_age_gap. Null means any junior.';

revoke select on app.profiles from authenticated;
grant select (
  id, market_id, display_name, last_initial, photo_url,
  level_value, level_source, home_court_id, availability_mask, prefers,
  last_active_at, looking_to_hit_until,
  requests_received, requests_responded, requests_accepted, hits_confirmed, median_response_minutes,
  status, roster_id, created_at, updated_at
) on app.profiles to authenticated;

-- Your own row, whole. The app needs your birthday (for your band) and your pending photo.
create or replace function app.my_profile()
returns setof app.profiles
language sql
stable
security definer
set search_path = app, public
as $$
  select * from app.profiles where id = app.uid();
$$;

-- Each child a parent is verified for, whole. A parent sees everything about their own kid.
create or replace function app.my_children()
returns setof app.profiles
language sql
stable
security definer
set search_path = app, public
as $$
  select p.* from app.profiles p
   where app.is_guardian_of(p.id)
   order by p.date_of_birth desc;
$$;

revoke execute on function app.my_profile() from public, anon;
revoke execute on function app.my_children() from public, anon;
grant execute on function app.my_profile() to authenticated;
grant execute on function app.my_children() to authenticated;

-- 3 -------------------------------------------------------------------------------------
create or replace function app.age_years(dob date)
returns int
language sql
stable
set search_path = app, public
as $$
  select date_part('year', age(current_date, dob))::int;
$$;

revoke execute on function app.age_years(date) from public, anon, authenticated;

-- A junior's age, for the people who may see it: another junior who can see the profile,
-- a parent of that junior, or a parent whose child has a hit with them. Adults' ages are
-- not shown to anyone; nobody needs them to find a partner.
create or replace function app.ages(p_ids uuid[])
returns table (profile_id uuid, age int)
language sql
stable
security definer
set search_path = app, public
as $$
  select p.id, app.age_years(p.date_of_birth)
    from app.profiles p
   where p.id = any(p_ids)
     and p.adult_at > current_date
     and (
       app.is_guardian_of(p.id)
       or app.is_hit_counterparty_for_my_child(p.id)
       or (app.profile_band(app.uid()) = 'minor' and (p.id = app.uid() or app.can_view_profile(p.id)))
     );
$$;

revoke execute on function app.ages(uuid[]) from public, anon;
grant execute on function app.ages(uuid[]) to authenticated;

-- 4 -------------------------------------------------------------------------------------
-- Only a parent changes the rule. The kid's own profile update cannot touch it.
create or replace function app.guard_parent_owned()
returns trigger
language plpgsql
set search_path = app, public
as $$
begin
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'profiles') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.max_partner_age_gap := null;
  elsif new.max_partner_age_gap is distinct from old.max_partner_age_gap then
    raise exception 'a parent sets who their child can hit with';
  end if;
  return new;
end;
$$;

create trigger profiles_parent_owned
  before insert or update on app.profiles
  for each row execute function app.guard_parent_owned();

revoke execute on function app.guard_parent_owned() from public, anon, authenticated;

create or replace function app.set_child_age_gap(p_child uuid, p_gap int)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not app.is_guardian_of(p_child) then
    raise exception 'only a linked parent can set this';
  end if;
  if p_gap is not null and (p_gap < 1 or p_gap > 5) then
    raise exception 'pick between one and five years, or anyone under 18';
  end if;
  update app.profiles set max_partner_age_gap = p_gap where id = p_child;
end;
$$;

revoke execute on function app.set_child_age_gap(uuid, int) from public, anon;
grant execute on function app.set_child_age_gap(uuid, int) to authenticated;

-- True when the two may find and invite each other on age. Adults are never limited by it;
-- between juniors, the stricter of the two parents' rules wins.
create or replace function app.age_gap_ok(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select coalesce((
    select case
      when pa.adult_at <= current_date or pb.adult_at <= current_date then true
      else abs(app.age_years(pa.date_of_birth) - app.age_years(pb.date_of_birth))
           <= least(coalesce(pa.max_partner_age_gap, 99), coalesce(pb.max_partner_age_gap, 99))
    end
      from app.profiles pa, app.profiles pb
     where pa.id = a and pb.id = b
  ), false);
$$;

revoke execute on function app.age_gap_ok(uuid, uuid) from public, anon, authenticated;

-- Sending a request requires everything viewing requires, and the parents' age rule.
create or replace function app.can_request_hit(from_profile uuid, to_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select
    from_profile = app.uid()
    and from_profile <> to_profile
    and app.is_participating(from_profile)
    and app.is_participating(to_profile)
    and app.same_band(from_profile, to_profile)
    and not app.blocked_between(from_profile, to_profile)
    and app.age_gap_ok(from_profile, to_profile);
$$;

-- Discovery reads columns other players can no longer select (the rounded location, the
-- birthday it computes ages from), so it runs as the owner and applies the visibility rule
-- itself, row by row, instead of leaning on RLS it now bypasses.
--
-- The eight-argument version is renamed and closed to every client rather than dropped:
-- the hosted project's SQL tool holds any DROP for a person to approve, and this way the
-- migration applies unattended. It can no longer run anyway (it reads the location column
-- as the caller). Drop it by hand whenever convenient.
alter function app.discover(int, numeric, numeric, int, boolean, interval, int, int) rename to discover_v1;
revoke execute on function app.discover_v1(int, numeric, numeric, int, boolean, interval, int, int) from public, anon, authenticated;

create function app.discover(
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
  where p.id <> me.id
    and app.can_view_profile(p.id)
    and app.age_gap_ok(me.id, p.id)
    and app.cohort_discovery_open(me.id)
    and p.snapped_point is not null
    and me.snapped_point is not null
    and ST_DWithin(p.snapped_point, me.snapped_point, p_radius_m)
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
  limit p_limit offset p_offset;
$$;

revoke execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int, int) from public, anon;
grant execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int, int) to authenticated;

-- 5 -------------------------------------------------------------------------------------
create table app.hit_reads (
  hit_request_id uuid not null references app.hit_requests(id) on delete cascade,
  profile_id     uuid not null references app.profiles(id) on delete cascade,
  read_at        timestamptz not null default now(),
  primary key (hit_request_id, profile_id)
);

-- Reached only through the two functions below.
alter table app.hit_reads enable row level security;
revoke all on app.hit_reads from public, anon, authenticated;

create or replace function app.mark_hit_read(p_hit uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not app.is_hit_participant(p_hit) then
    raise exception 'not your hit';
  end if;
  insert into app.hit_reads (hit_request_id, profile_id, read_at)
  values (p_hit, app.uid(), now())
  on conflict (hit_request_id, profile_id) do update set read_at = excluded.read_at;
end;
$$;

-- One row per hit you are in: the last message, and how many from the other player you
-- have not opened.
create or replace function app.inbox()
returns table (
  hit_id      uuid,
  last_body   text,
  last_sender uuid,
  last_at     timestamptz,
  unread      int
)
language sql
stable
security definer
set search_path = app, public
as $$
  select h.id, lm.body, lm.sender_profile_id, lm.created_at,
         (select count(*)::int from app.hit_messages m
           where m.hit_request_id = h.id
             and m.sender_profile_id <> app.uid()
             and m.created_at > coalesce(r.read_at, '-infinity'::timestamptz))
    from app.hit_requests h
    left join lateral (
      select m.body, m.sender_profile_id, m.created_at
        from app.hit_messages m
       where m.hit_request_id = h.id
       order by m.created_at desc
       limit 1
    ) lm on true
    left join app.hit_reads r on r.hit_request_id = h.id and r.profile_id = app.uid()
   where app.uid() in (h.from_profile_id, h.to_profile_id);
$$;

revoke execute on function app.mark_hit_read(uuid) from public, anon;
revoke execute on function app.inbox() from public, anon;
grant execute on function app.mark_hit_read(uuid) to authenticated;
grant execute on function app.inbox() to authenticated;

-- 6 -------------------------------------------------------------------------------------
create or replace function app.court_players()
returns table (court_id uuid, players int, looking int)
language sql
stable
security definer
set search_path = app, public
as $$
  select p.home_court_id,
         count(*)::int,
         count(*) filter (where p.looking_to_hit_until > now())::int
    from app.profiles p
   where p.home_court_id is not null
     and p.id <> app.uid()
     and p.last_active_at > now() - interval '30 days'
     and app.can_view_profile(p.id)
     and app.age_gap_ok(app.uid(), p.id)
   group by p.home_court_id;
$$;

revoke execute on function app.court_players() from public, anon;
grant execute on function app.court_players() to authenticated;

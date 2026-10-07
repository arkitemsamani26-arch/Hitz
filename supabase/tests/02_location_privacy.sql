-- Location privacy.
--
-- Exact coordinates are not "protected by a policy" -- the privilege to read them was
-- never granted to any client role. This suite verifies that, and verifies that the
-- approximate point a client CAN see is genuinely coarse.

begin;
select plan(8);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'

select ok(not has_table_privilege('authenticated', 'app.profiles_private', 'SELECT'),
  'authenticated has no SELECT privilege on profiles_private');
select ok(not has_table_privilege('anon', 'app.profiles_private', 'SELECT'),
  'anon has no SELECT privilege on profiles_private');
select ok(not has_table_privilege('authenticated', 'app.profiles_private', 'UPDATE'),
  'authenticated cannot write profiles_private directly either');

-- The precise point is not protected, it is absent. Coordinates are rounded by
-- `set_my_location` as they arrive and the exact ones are never written down.
select ok(
  not exists (select 1 from information_schema.columns
               where table_schema = 'app' and table_name = 'profiles_private'
                 and column_name = 'exact_point'),
  'there is nowhere to store a precise location, so none is stored');

-- Snapped to a ~0.02 degree grid: roughly 2.2km of latitude, ~1.6km of longitude at
-- Boston. Enough to say "around here", not enough to say "lives there".
select ok(
  (select (ST_X(snapped_point::geometry) * 50) = round(ST_X(snapped_point::geometry) * 50)
     from app.profiles where id = :'junior_a'::uuid),
  'snapped longitude lands on the 0.02 degree grid');

-- Round-trip a real coordinate through the function a client actually calls, and check
-- what lands is the grid point rather than what was sent.
select auth.login_as(:'junior_a'::uuid);
select app.set_my_location(42.2961, -71.2923);
select auth.logout();
reset role;

select is(
  (select array[round(ST_X(snapped_point::geometry)::numeric, 2),
                round(ST_Y(snapped_point::geometry)::numeric, 2)]
     from app.profiles where id = :'junior_a'::uuid),
  array[(-71.30)::numeric, (42.30)::numeric],
  'a precise coordinate is rounded to the grid before it is ever stored');

-- Distance is bucketed, never precise.
select is(app.distance_bucket_m(800), 'under 1 mi', 'sub-mile distances are not enumerated');
select is(app.distance_bucket_m(48280), '~30 mi', 'far distances round to 5 mile buckets');

select * from finish();
rollback;

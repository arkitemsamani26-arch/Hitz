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

-- The exposed column is derived, not the real one.
select isnt(
  (select ST_AsText(snapped_point::geometry) from app.profiles where id = :'junior_a'::uuid),
  (select ST_AsText(exact_point::geometry) from app.profiles_private where profile_id = :'junior_a'::uuid),
  'snapped_point is not the exact point');

-- Snapped to a ~0.02 degree grid: roughly 2.2km of latitude, ~1.6km of longitude at
-- Boston. Enough to say "around here", not enough to say "lives there".
select ok(
  (select (ST_X(snapped_point::geometry) * 50) = round(ST_X(snapped_point::geometry) * 50)
     from app.profiles where id = :'junior_a'::uuid),
  'snapped longitude lands on the 0.02 degree grid');

select cmp_ok(
  (select ST_Distance(p.snapped_point, pv.exact_point)
     from app.profiles p join app.profiles_private pv on pv.profile_id = p.id
    where p.id = :'junior_a'::uuid),
  '>', 0::double precision,
  'the snapped point has actually moved off the real one');

-- Distance is bucketed, never precise.
select is(app.distance_bucket_m(800), 'under 1 mi', 'sub-mile distances are not enumerated');
select is(app.distance_bucket_m(48280), '~30 mi', 'far distances round to 5 mile buckets');

select * from finish();
rollback;

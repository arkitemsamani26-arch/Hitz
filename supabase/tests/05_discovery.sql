-- Discovery: skill proximity first, distance second, and cohort gating.

begin;
select plan(9);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set junior_d '00000000-0000-0000-0000-0000000000a4'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'

-- Junior A is 8.50. Junior B is 8.70 (delta 0.20). Junior C is 5.00 (delta 3.50) but has
-- no verified guardian, so they should not appear at all.
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

select is(
  (select count(*) from app.discover()),
  1::bigint,
  'discovery returns only participating peers in the same band');

select is(
  (select profile_id from app.discover() limit 1),
  :'junior_b'::uuid,
  'the closest player by SKILL is first -- not the best player nearby');

select is(
  (select level_delta from app.discover() limit 1),
  0.20::numeric,
  'level delta is computed and exposed for sorting');

select ok(
  (select distance_bucket from app.discover() limit 1) is not null,
  'distance comes back as a bucket, never a precise figure');

select ok(
  (select looking_to_hit from app.discover() limit 1),
  'the expiring "looking to hit" status is surfaced in the feed');

-- Ghost suppression: a player inactive beyond the window drops out of the feed.
reset role;
update app.profiles set last_active_at = now() - interval '90 days' where id = :'junior_b'::uuid;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

select is(
  (select count(*) from app.discover()),
  0::bigint,
  'a player who has not opened the app in 90 days is suppressed from the feed');

select is(
  (select count(*) from app.discover(p_active_within => interval '180 days')),
  1::bigint,
  'the activity window is a parameter, not a hardcoded rule');

-- Cohort gating: Junior D is in a market whose junior cohort has not cleared its
-- density threshold. Adult signups in that market must not open discovery for juniors.
reset role;
select set_config('request.jwt.claim.sub', :'junior_d', true);
set local role authenticated;

select is(
  (select count(*) from app.discover()),
  0::bigint,
  'discovery stays shut until the user''s own cohort clears its threshold');

select is(
  (select discovery_open from app.my_market_status()),
  false,
  'the user gets an honest waiting state with a real number behind it');

select * from finish();
rollback;

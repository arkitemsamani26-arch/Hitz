-- The fixes found by running against the live project: discovery seeded from a home
-- court, turn order enforced, housekeeping functions out of reach, a parent able to see
-- who their kid would be meeting.
begin;
select plan(14);
set search_path = app, public;

\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set minor_a  '00000000-0000-0000-0000-0000000000a1'
\set minor_b  '00000000-0000-0000-0000-0000000000a2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-0000000000fa'

-- 1. A home court is a location -------------------------------------------------------
--
-- A fresh signup: a home court and nothing else. Before this migration their
-- snapped_point stayed null and app.discover skipped them forever.
\set fresh '00000000-0000-0000-0000-0000000000b9'
insert into auth.users (id, email) values (:'fresh'::uuid, 'fresh@example.test');
insert into app.profiles (id, market_id, display_name, last_initial, date_of_birth,
                          level_value, level_source, home_court_id, availability_mask, phone_verified_at)
values (:'fresh'::uuid, :'market'::uuid, 'Fresh', 'S', current_date - interval '25 years',
        8.60, 'estimated', :'court'::uuid, 8, now());

select isnt(
  (select snapped_point from app.profiles where id = :'fresh'::uuid), null,
  'picking a home court gives you a place on the map');

select is(
  (select p.snapped_point from app.profiles p where p.id = :'fresh'::uuid),
  (select app.snap_point(c.point) from app.courts c where c.id = :'court'::uuid),
  'and it is the court, snapped to the same coarse grid as a device fix');

-- Changing your home court moves you.
update app.profiles set home_court_id = '00000000-0000-0000-0000-0000000000e2'::uuid
 where id = :'fresh'::uuid;
select is(
  (select p.snapped_point from app.profiles p where p.id = :'fresh'::uuid),
  (select app.snap_point(c.point) from app.courts c where c.id = '00000000-0000-0000-0000-0000000000e2'::uuid),
  'and moving court moves the point');

-- Which is what discovery needed. A peer at the same court can now see them.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select ok(
  (select count(*) from app.discover(40000, null, null, 0, false, interval '30 days', 50, 0)
    where profile_id = :'fresh'::uuid) = 1,
  'and that is what puts them in another player''s feed');
reset role;

-- 2. Turn order ------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end)
values (:'hit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() + interval '1 day', now() + interval '1 day 2 hours');

select is((select awaiting_profile_id from app.hit_requests where id = :'hit'::uuid), :'adult_b'::uuid,
  'a new request is the other side''s move');

select throws_ok(
  format($$ update app.hit_requests set state = 'accepted' where id = %L $$, :'hit'),
  'It is not your move.',
  'the sender cannot accept their own request');

reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select lives_ok(
  format($$ update app.hit_requests set state = 'accepted', awaiting_profile_id = null where id = %L $$, :'hit'),
  'the side whose move it is can accept');

-- 3. Confirmations are answerable twice -------------------------------------------------
reset role;
update app.hit_requests set state = 'confirmed' where id = :'hit'::uuid;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
insert into app.hit_confirmations (hit_request_id, profile_id, did_play) values (:'hit'::uuid, :'adult_b'::uuid, false);
select lives_ok(
  format($$ update app.hit_confirmations set did_play = true where hit_request_id = %L and profile_id = %L $$,
         :'hit', :'adult_b'),
  'you can change your mind about whether you played');

-- 4. Housekeeping functions are not client-callable --------------------------------------
select ok(not has_function_privilege('authenticated', 'app.expire_requests()', 'EXECUTE'),
  'a signed-in user cannot expire everyone''s requests');
select ok(not has_function_privilege('authenticated', 'app.enqueue_tomorrow_reminders()', 'EXECUTE'),
  'nor drive the reminder outbox');

-- 5. The peek is a real number -----------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select ok((select players from app.peek_cohort('1995-01-01'::date, 8.5, 'boston')) > 0,
  'peek counts a cohort before you have a profile');

-- 6. A parent sees the counterparty -------------------------------------------------------
reset role;
insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, state)
values (:'market'::uuid, :'minor_a'::uuid, :'minor_b'::uuid, :'court'::uuid,
        now() + interval '1 day', now() + interval '1 day 2 hours', 'accepted');

select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select is((select display_name from app.profiles where id = :'minor_b'::uuid),
  (select display_name from app.profiles p where p.id = :'minor_b'::uuid),
  'the parent can read the other player on their child''s hit');
select isnt((select count(*) from app.profiles where id = :'minor_b'::uuid), 0::bigint,
  'so the approval screen has something true to show');

-- ...and no further. An unrelated player stays invisible.
select is((select count(*) from app.profiles where id = :'adult_b'::uuid), 0::bigint,
  'but not a player their child has no hit with');

select * from finish();
rollback;

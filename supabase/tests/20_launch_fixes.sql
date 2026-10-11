-- Launch fixes (migration 20261011000100).
--
-- Moving a confirmed hit is a new proposal the other player has to accept; a hit that has
-- happened cannot be moved; push text uses the court's own time zone; counters, passes and
-- cancellations reach the person they affect; the playing preference saves and comes back
-- from discover.

begin;
select plan(13);
set search_path = app, public;

\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-00000000f201'
\set oldhit   '00000000-0000-0000-0000-00000000f202'

-- An adult hit, confirmed on accept.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
values (:'hit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 90 minutes', :'adult_b'::uuid);
reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.hit_requests set state = 'accepted' where id = :'hit'::uuid;
reset role;
select is((select state from app.hit_requests where id = :'hit'::uuid), 'confirmed'::app.hit_state, 'setup: the adult hit is confirmed');

-- Adult A moves it a day later and tries to keep it confirmed.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select lives_ok($$
  update app.hit_requests
     set window_start = now() + interval '3 days', window_end = now() + interval '3 days 90 minutes'
   where id = '00000000-0000-0000-0000-00000000f202'::uuid or id = '00000000-0000-0000-0000-00000000f201'::uuid
$$, 'a participant can propose a new time for a confirmed hit');
reset role;

select is((select state from app.hit_requests where id = :'hit'::uuid), 'countered'::app.hit_state,
  'moving a confirmed hit makes it a counterproposal, whatever the client sent');
select is((select awaiting_profile_id from app.hit_requests where id = :'hit'::uuid), :'adult_b'::uuid,
  'and it is the other player''s turn');
select ok((select expires_at > now() from app.hit_requests where id = :'hit'::uuid),
  'the counter has a live expiry, so it does not expire the moment it is made');
select ok((select confirmed_at is null from app.hit_requests where id = :'hit'::uuid),
  'it is no longer stamped as confirmed');
select is((select count(*) from app.notifications where user_id = :'adult_b'::uuid and kind = 'countered' and (data->>'hit')::uuid = :'hit'::uuid), 1::bigint,
  'the other player is told a new time was suggested');

-- Adult B accepts the new time: it confirms again.
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.hit_requests set state = 'accepted' where id = :'hit'::uuid;
reset role;
select is((select state from app.hit_requests where id = :'hit'::uuid), 'confirmed'::app.hit_state,
  'accepting the new time confirms it again');

-- Push text is in the court's zone, not the database's.
update app.markets set timezone = 'America/Los_Angeles' where id = :'market'::uuid;
select is(app.hit_when('2026-10-13 01:00:00+00'::timestamptz, :'court'::uuid), 'Mon 6pm',
  'a 01:00 UTC start reads as Monday 6pm in Pacific time');
select is(app.hit_when('2026-10-13 01:30:00+00'::timestamptz, :'court'::uuid, false), '6:30pm',
  'minutes appear only when there are some, and the day can be left off');

-- A hit that already happened cannot be moved.
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, state, created_at)
values (:'oldhit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'confirmed', now() - interval '5 days');
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select throws_ok($$
  update app.hit_requests set window_start = now() + interval '1 day', window_end = now() + interval '1 day 1 hour'
   where id = '00000000-0000-0000-0000-00000000f202'::uuid
$$, 'This hit has already happened.', 'a past hit cannot be rescheduled');

-- The playing preference saves, and a too-long one does not.
select lives_ok($$ update app.profiles set prefers = 'Practice sets' where id = '00000000-0000-0000-0000-0000000000b1'::uuid $$,
  'a player can set what kind of hit they are after');
select throws_ok($$ update app.profiles set prefers = repeat('x', 41) where id = '00000000-0000-0000-0000-0000000000b1'::uuid $$,
  '23514', null, 'a preference is a few words, not a bio');
reset role;

select * from finish();
rollback;

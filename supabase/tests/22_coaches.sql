-- Coaches (migration 20261014000100).
--
-- A coach pairs two players on their roster; either player turns it into an invitation.
-- An adult coach sees a junior only after the junior joined with the code, their parent
-- approved that coach, and Hits verified the coach. Juniors are only paired with juniors.

begin;
select plan(30);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'

-- Who can coach --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select throws_ok($$select * from app.become_coach('Junior Academy')$$, 'P0001', 'coaches are adults', 'a junior cannot become a coach');
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select academy from app.become_coach('Wellesley Tennis Academy')), 'Wellesley Tennis Academy', 'an adult turns on coach tools');
select ok((select length(code) >= 6 from app.my_coaching()), 'and gets a join code');
select ok((select not juniors_verified from app.my_coaching()), 'not yet verified to coach juniors');
select throws_ok($$select * from app.coaches$$, '42501', null, 'the coaches table is not readable directly');
reset role;
select set_config('test.code', (select code::text from app.coaches where profile_id = :'adult_a'::uuid), true);

-- Joining -----------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select is((select academy from app.check_coach_code(current_setting('test.code'))), 'Wellesley Tennis Academy', 'a code says whose academy it is');
select is((select needs_parent from app.join_coach(current_setting('test.code'))), false, 'an adult joins with no parent step');
select is((select status from app.my_coaches()), 'active', 'and is on the roster straight away');
reset role;

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select needs_parent from app.join_coach(current_setting('test.code'))), true, 'a junior joins, and their parent decides');
select is((select status from app.my_coaches()), 'parent', 'and is waiting on that parent');
reset role;
select ok((select count(*) = 1 from app.notifications where user_id = :'guardian'::uuid and kind = 'coach_approval'), 'the parent is asked');

-- What the coach sees ------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select status from app.coach_roster() where player_id = :'junior_a'::uuid), 'parent', 'the coach sees the junior is waiting on a parent');
select ok((select level_value is null and last_initial is null and age is null and availability_mask = 0 from app.coach_roster() where player_id = :'junior_a'::uuid),
  'and sees nothing but a first name until then');
select is((select status from app.coach_roster() where player_id = :'adult_b'::uuid), 'active', 'the adult member is active');
reset role;

select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select is((select approved from app.guardian_coach_links() where child_id = :'junior_a'::uuid), false, 'the parent sees the request');
select lives_ok($$select app.guardian_decide_coach('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', true)$$, 'and approves that coach');
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select status from app.coach_roster() where player_id = :'junior_a'::uuid), 'verify', 'still hidden until Hits verifies the coach');
reset role;

-- A person at Hits verifies the coach (the server, not a client).
update app.coaches set juniors_verified_at = now() where profile_id = :'adult_a'::uuid;

select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select app.join_coach(current_setting('test.code'));
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select app.guardian_decide_coach(:'junior_b'::uuid, :'adult_a'::uuid, true);
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select status from app.coach_roster() where player_id = :'junior_a'::uuid), 'active', 'with all three, the junior is on the roster');
select is((select age from app.coach_roster() where player_id = :'junior_a'::uuid), 16, 'with their age, for pairing');

-- Pairing -----------------------------------------------------------------------------------
select throws_ok($$select app.coach_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b2', null, null, null, null)$$,
  'P0001', 'juniors are only paired with juniors', 'a coach cannot pair a junior with an adult');
select throws_ok($$select app.coach_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', null, now() - interval '1 day', now() - interval '23 hours', null)$$,
  'P0001', 'pick a time that has not passed', 'or for a time that has passed');
select lives_ok($$select app.coach_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000e1', now() + interval '3 days', now() + interval '3 days 90 minutes', 'Work on returns')$$,
  'a coach pairs two juniors on the roster');
reset role;
select is((select count(*)::int from app.notifications where kind = 'pairing' and user_id in (:'junior_a'::uuid, :'junior_b'::uuid)), 2, 'both players are told');

select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select throws_ok($$select app.coach_pair('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', null, null, null, null)$$,
  'P0001', 'turn on coach tools first', 'someone who is not a coach cannot pair anyone');
select is((select count(*)::int from app.coach_roster()), 0, 'and has no roster');
reset role;

-- The player's side --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select other_id from app.my_pairings()), :'junior_b'::uuid, 'the junior sees who they were paired with');
select is((select note from app.my_pairings()), 'Work on returns', 'and the coach''s note');
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
values ('00000000-0000-0000-0000-00000000f401', :'market'::uuid, :'junior_a'::uuid, :'junior_b'::uuid, :'court'::uuid,
        now() + interval '3 days', now() + interval '3 days 90 minutes', :'junior_b'::uuid);
select lives_ok($$select app.pairing_sent((select id from app.my_pairings()), '00000000-0000-0000-0000-00000000f401')$$, 'and turns it into an invitation');
select is((select count(*)::int from app.my_pairings()), 0, 'which takes it off their list');
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select hit_state from app.coach_pairings() limit 1), 'pending'::app.hit_state, 'the coach can follow the hit it became, but not what was said');
reset role;

-- A parent can take it back --------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select app.guardian_decide_coach(:'junior_b'::uuid, :'adult_a'::uuid, false);
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select count(*)::int from app.coach_roster() where player_id = :'junior_b'::uuid), 0, 'a parent removing the coach takes their child off the roster');
reset role;

select * from finish();
rollback;

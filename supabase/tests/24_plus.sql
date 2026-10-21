-- Hits Plus (migration 20261021000100).
--
-- Free players get a hit every week; Plus gets more at once. The limits live in the
-- database: three open invitations, three days of "I'm free", the plain filters, the top
-- five of the looking list, no stats, no notes, no saved searches, no auto-match. A junior
-- never buys; a parent's Plus covers their children. Only the server writes a subscription.

begin;
select plan(42);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set junior_c '00000000-0000-0000-0000-0000000000a3'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set adult_c  '00000000-0000-0000-0000-0000000000b3'
\set adult_d  '00000000-0000-0000-0000-0000000000b4'
\set adult_e  '00000000-0000-0000-0000-0000000000b5'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set indoor   '00000000-0000-0000-0000-0000000000e2'
\set market   '00000000-0000-0000-0000-0000000000d1'

-- Three more adults nearby, so there is someone to invite and someone to find.
insert into auth.users (id, email) values
  (:'adult_c'::uuid, 'adultc@example.test'), (:'adult_d'::uuid, 'adultd@example.test'), (:'adult_e'::uuid, 'adulte@example.test');
insert into app.profiles (id, market_id, display_name, last_initial, date_of_birth, level_value, level_source,
                          home_court_id, availability_mask, phone_verified_at, snapped_point, looking_to_hit_until)
values
  (:'adult_c'::uuid, :'market'::uuid, 'Adult', 'C', current_date - interval '28 years', 8.90, 'utr_self',
   :'court'::uuid, 63, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2800, 42.2990), 4326)::geography), now() + interval '2 days'),
  (:'adult_d'::uuid, :'market'::uuid, 'Adult', 'D', current_date - interval '31 years', 9.10, 'utr_self',
   :'indoor'::uuid, 63, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2810, 42.2980), 4326)::geography), now() + interval '2 days'),
  (:'adult_e'::uuid, :'market'::uuid, 'Adult', 'E', current_date - interval '35 years', 8.80, 'utr_self',
   :'court'::uuid, 63, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2820, 42.2970), 4326)::geography), now() + interval '2 days');
insert into app.profiles_private (profile_id) values (:'adult_c'::uuid), (:'adult_d'::uuid), (:'adult_e'::uuid);
update app.courts set indoor = true where id = :'indoor'::uuid;
update app.profiles set looking_to_hit_until = now() + interval '2 days' where id in (:'adult_b'::uuid, :'junior_a'::uuid, :'junior_b'::uuid);

-- 1. Nobody has Plus to start, and nobody can read or write the table ----------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select plus from app.my_plus()), false, 'a new player is on the free plan');
select throws_ok($$select * from app.subscriptions$$, '42501', null, 'subscriptions are not readable by a client');
select throws_ok($$select app.apply_subscription('00000000-0000-0000-0000-0000000000b1', 'active', now() + interval '30 days', 'apple', 'tx1')$$,
  '42501', null, 'nor writable through the server''s function');
reset role;

-- 2. The invitation cap ----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
select :'market'::uuid, :'adult_a'::uuid, x, :'court'::uuid, now() + interval '2 days', now() + interval '2 days 1 hour', x
  from unnest(array[:'adult_b'::uuid, :'adult_c'::uuid, :'adult_d'::uuid]) x;
select is((select count(*) from app.hit_requests where from_profile_id = :'adult_a'::uuid and state = 'pending'), 3::bigint, 'three invitations go out');
select throws_like($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000e1',
          now() + interval '3 days', now() + interval '3 days 1 hour', '00000000-0000-0000-0000-0000000000b5')$$,
  'plus_required:invites%', 'the fourth waits for Plus, and the error says so');
-- One answered, one more goes out.
reset role;
update app.hit_requests set state = 'declined', awaiting_profile_id = null where from_profile_id = :'adult_a'::uuid and to_profile_id = :'adult_d'::uuid;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select lives_ok($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b5', '00000000-0000-0000-0000-0000000000e1',
          now() + interval '3 days', now() + interval '3 days 1 hour', '00000000-0000-0000-0000-0000000000b5')$$,
  'once one is answered, the next goes out');
reset role;

-- 3. The server grants Plus, and the cap lifts -----------------------------------------------------
set local role service_role;
select lives_ok($$select app.apply_subscription('00000000-0000-0000-0000-0000000000b1', 'active', now() + interval '30 days', 'apple', 'tx1')$$,
  'the webhook (service role) records a purchase');
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select plus from app.my_plus()), true, 'and the player has Plus');
select is((select source from app.my_plus()), 'apple', 'from the store that sold it');
select lives_ok($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b4', '00000000-0000-0000-0000-0000000000e1',
          now() + interval '4 days', now() + interval '4 days 1 hour', '00000000-0000-0000-0000-0000000000b4')$$,
  'Plus sends a fourth open invitation');
reset role;
-- An expiry the webhook reports takes it away again.
set local role service_role;
select app.apply_subscription(:'adult_a'::uuid, 'expired', now() - interval '1 hour', 'apple', 'tx1');
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select plus from app.my_plus()), false, 'an expiry from the webhook ends it');
reset role;

-- 4. "I'm free" lasts three days free, seven on Plus --------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.profiles set looking_to_hit_until = now() + interval '7 days' where id = :'adult_b'::uuid;
select ok((select looking_to_hit_until < now() + interval '3 days 10 minutes' from app.profiles where id = :'adult_b'::uuid),
  'free: seven days asked for, three given');
reset role;
set local role service_role;
select app.grant_plus_promo(:'adult_b'::uuid, 30);
reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.profiles set looking_to_hit_until = now() + interval '7 days' where id = :'adult_b'::uuid;
select ok((select looking_to_hit_until > now() + interval '6 days 23 hours' from app.profiles where id = :'adult_b'::uuid),
  'Plus: seven days given');
select is((select source from app.my_plus()), 'promo', 'a promo grant says it is one');
select is((select array_agg(x) from app.plus_of(array[:'adult_a'::uuid, :'adult_b'::uuid]) x), array[:'adult_b'::uuid], 'the badge says who has Plus, and nothing else');
reset role;

-- 5. The advanced filters, the looking list, and the card ------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select lives_ok($$select * from app.discover(p_radius_m => 16093)$$, 'free: the plain filters work');
select throws_like($$select * from app.discover(p_radius_m => 16093, p_handedness => 'left')$$, 'plus_required:filters%', 'free: a Plus filter is refused');
select throws_like($$select * from app.discover(p_radius_m => 16093, p_indoor_only => true)$$, 'plus_required:filters%', 'indoor only too');
select ok((select count(*) <= 5 from app.discover(p_radius_m => 40234, p_only_looking => true, p_limit => 1000)), 'free: the looking list is the top five');
select throws_like($$update app.profiles set handedness = 'left' where id = '00000000-0000-0000-0000-0000000000b1'$$, 'plus_required:card%', 'free: the fuller card is refused');
select throws_like($$select app.my_stats()$$, 'plus_required:stats%', 'free: stats are refused');
select throws_like($$select app.set_partner_note('00000000-0000-0000-0000-0000000000b2', 'Big forehand')$$, 'plus_required:notes%', 'free: notes are refused');
select throws_like($$select app.save_search('Lefties', '{"handedness":"left"}')$$, 'plus_required:searches%', 'free: saved searches are refused');
select throws_like($$select app.auto_match(now() + interval '2 days', now() + interval '2 days 90 minutes', 8, 10)$$, 'plus_required:automatch%', 'free: auto-match is refused');
reset role;

select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.profiles set handedness = 'left', play_style = 'baseliner', bio = 'Big forehand, likes long sets.' where id = :'adult_b'::uuid;
select is((select handedness from app.profiles where id = :'adult_b'::uuid), 'left', 'Plus: the fuller card saves');
reset role;
-- A fits B's new filters; the free player D (no handedness) does not.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
reset role;
set local role service_role;
select app.grant_plus_promo(:'adult_a'::uuid, 30);
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select array_agg(profile_id) from app.discover(p_radius_m => 40234, p_handedness => 'left')), array[:'adult_b'::uuid], 'Plus: handedness filters to the one lefty');
select is((select array_agg(profile_id) from app.discover(p_radius_m => 40234, p_indoor_only => true)), array[:'adult_d'::uuid], 'Plus: indoor only finds the one at an indoor court');
select ok((select count(*) > 0 from app.discover(p_radius_m => 40234, p_only_looking => true, p_limit => 1000)), 'Plus: the whole looking list');
select lives_ok($$select app.set_partner_note('00000000-0000-0000-0000-0000000000b2', 'Big forehand')$$, 'Plus: a private note saves');
select is(app.get_partner_note(:'adult_b'::uuid), 'Big forehand', 'and reads back');
select ok((select (app.my_stats())->'months' is not null), 'Plus: stats come back');
select app.save_search('S1', '{}'); select app.save_search('S2', '{}'); select app.save_search('S3', '{}'); select app.save_search('S4', '{}'); select app.save_search('S5', '{}');
select throws_like($$select app.save_search('S6', '{}')$$, '%five saved searches%', 'five saved searches is the most');
reset role;

-- 6. Auto-match ------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select set_config('test.am', (select app.auto_match(now() + interval '2 days', now() + interval '2 days 90 minutes', 8, 10, 40234, 'singles')::text), true);
select is((select state from app.my_auto_match()), 'active', 'Plus: an auto-match starts');
select is((select state from app.hit_requests where id = (select current_request_id from app.my_auto_match())), 'pending', 'and the first invitation is out');
reset role;
-- They pass; the job moves to the next.
update app.hit_requests set state = 'declined', awaiting_profile_id = null where id = (select current_request_id from app.auto_matches where id = current_setting('test.am')::uuid);
select set_config('test.first', (select current_request_id::text from app.auto_matches where id = current_setting('test.am')::uuid), true);
select app.advance_auto_matches();
select ok((select current_request_id::text <> current_setting('test.first') from app.auto_matches where id = current_setting('test.am')::uuid), 'a pass moves it to the next player');
-- The next says yes; it is done.
update app.hit_requests set state = 'confirmed', awaiting_profile_id = null where id = (select current_request_id from app.auto_matches where id = current_setting('test.am')::uuid);
select app.advance_auto_matches();
select is((select state from app.auto_matches where id = current_setting('test.am')::uuid), 'done', 'a yes finishes it');

-- 7. Juniors ----------------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select throws_like($$select app.begin_purchase()$$, '%parent%', 'a junior cannot start a purchase');
select is((select plus from app.my_plus()), false, 'a child of a free parent is free');
select lives_ok($$select app.request_plus_from_parent()$$, 'and can ask their parent');
reset role;
select ok((select count(*) = 1 from app.notifications where user_id = :'guardian'::uuid and kind = 'plus_request'), 'the parent is asked');
set local role service_role;
select app.grant_plus_promo(:'guardian'::uuid, 30);
reset role;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select plus and via_parent from app.my_plus()), true, 'a child of a Plus parent has Plus, through the parent');
reset role;
select set_config('request.jwt.claim.sub', :'junior_c', true);
set local role authenticated;
select is((select plus from app.my_plus()), false, 'a junior with no verified parent does not');
reset role;

select * from finish();
rollback;

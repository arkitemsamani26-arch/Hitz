-- Family, age, messages, courts (migration 20261013000100).
--
-- The person who asks brings the balls; a peer's birthday, unapproved photo and location
-- cell are not readable; juniors see each other's age; a parent's age rule holds on
-- discovery and on invitations, and only a parent can set it; unread counts are per
-- player; court counts never name anyone.

begin;
select plan(36);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set junior_e '00000000-0000-0000-0000-0000000000a5'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-00000000f301'
\set hit2     '00000000-0000-0000-0000-00000000f302'

-- A 13-year-old, linked to the same parent as A and B, a short drive away.
insert into auth.users (id, email) values (:'junior_e'::uuid, 'juniore@example.test');
insert into app.profiles (id, market_id, display_name, last_initial, date_of_birth, level_value, level_source,
                          home_court_id, availability_mask, phone_verified_at, snapped_point)
values (:'junior_e'::uuid, :'market'::uuid, 'Junior', 'E', current_date - interval '13 years 2 months', 8.40, 'utr_self',
        :'court'::uuid, 8, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2800, 42.2990), 4326)::geography));
insert into app.profiles_private (profile_id) values (:'junior_e'::uuid);
insert into app.guardian_links (minor_profile_id, guardian_user_id, guardian_email, relationship, verified_at)
values (:'junior_e'::uuid, :'guardian'::uuid, 'guardian@example.test', 'parent', now());

-- 1. Balls ---------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
values (:'hit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 90 minutes', :'adult_b'::uuid);
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, plan)
values (:'hit2'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() + interval '4 days', now() + interval '4 days 90 minutes', :'adult_b'::uuid,
        jsonb_build_object('ballsById', :'adult_b'::text));
reset role;
select is((select plan->>'ballsById' from app.hit_requests where id = :'hit'::uuid), :'adult_a'::text,
  'whoever sends the invitation brings the balls');
select is((select plan->>'ballsById' from app.hit_requests where id = :'hit2'::uuid), :'adult_b'::text,
  'unless the invitation already says who does');

-- 2. What peers can read ---------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select throws_ok($$select date_of_birth from app.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'a junior cannot read another junior''s birthday');
select throws_ok($$select photo_pending_url from app.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'nor the photo their parent has not approved');
select throws_ok($$select snapped_point from app.profiles where id = '00000000-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'nor the grid cell their location was rounded to');
select is((select display_name || ' ' || last_initial from app.profiles where id = :'junior_a'::uuid), 'Junior A',
  'but still reads the profile the app shows');
select is((select (app.my_profile()).date_of_birth), (current_date - interval '16 years')::date,
  'and reads their own birthday through my_profile');
select ok((select count(*) = 1 from app.my_profile()), 'my_profile is exactly one row: yours');
reset role;

-- 3. Ages --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select age from app.ages(array[:'junior_b'::uuid, :'junior_e'::uuid]) where profile_id = :'junior_e'::uuid), 13,
  'a junior sees another junior''s age');
select is((select age from app.discover() where profile_id = :'junior_b'::uuid), 16,
  'and discover carries it');
select is((select count(*)::int from app.discover(p_age_gap => 2) where profile_id = :'junior_e'::uuid), 0,
  '"around my age" leaves out a 13-year-old for a 16-year-old');
select is((select count(*)::int from app.discover(p_age_gap => 2) where profile_id = :'junior_b'::uuid), 1,
  'and keeps the other 16-year-old');
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select count(*)::int from app.ages(array[:'junior_a'::uuid, :'adult_b'::uuid])), 0,
  'an adult learns no ages: not a junior''s, not another adult''s');
select ok((select bool_and(age is null) from app.discover()), 'and discover gives adults none');
reset role;

-- 4. The parent's age rule ------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select ok(app.can_request_hit(:'junior_a'::uuid, :'junior_e'::uuid), 'with no rule, a junior can invite any junior');
select throws_ok($$update app.profiles set max_partner_age_gap = 5 where id = '00000000-0000-0000-0000-0000000000a1'$$,
  'P0001', 'a parent sets who their child can hit with', 'a junior cannot set their own age rule');
select throws_ok($$select app.set_child_age_gap('00000000-0000-0000-0000-0000000000a1', 5)$$,
  'P0001', 'only a linked parent can set this', 'nor through the parent''s function');
reset role;

select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select throws_ok($$select app.set_child_age_gap('00000000-0000-0000-0000-0000000000a1', 1)$$,
  'P0001', 'only a linked parent can set this', 'nor can a stranger');
reset role;

select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select lives_ok($$select app.set_child_age_gap('00000000-0000-0000-0000-0000000000a1', 2)$$,
  'a linked parent sets "within two years"');
select throws_ok($$select app.set_child_age_gap('00000000-0000-0000-0000-0000000000a1', 9)$$,
  'P0001', 'pick between one and five years, or anyone under 18', 'and the rule is a sensible number of years');
select is((select count(*)::int from app.my_children()), 3, 'a parent sees every child they are linked to');
select is((select max_partner_age_gap from app.my_children() where id = :'junior_a'::uuid), 2::smallint,
  'with the rule they set');
reset role;

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select count(*)::int from app.discover() where profile_id = :'junior_e'::uuid), 0,
  'the rule holds in discover without the junior asking for it');
select ok(not app.can_request_hit(:'junior_a'::uuid, :'junior_e'::uuid), 'and on sending an invitation');
select ok(app.can_request_hit(:'junior_a'::uuid, :'junior_b'::uuid), 'players inside the rule are still reachable');
reset role;

select set_config('request.jwt.claim.sub', :'junior_e', true);
set local role authenticated;
select is((select count(*)::int from app.discover() where profile_id = :'junior_a'::uuid), 0,
  'and it works both ways: the younger one does not see them either');
reset role;

-- 5. Unread -----------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
insert into app.hit_messages (hit_request_id, sender_profile_id, body) values
  (:'hit'::uuid, :'adult_b'::uuid, 'What time works?'),
  (:'hit'::uuid, :'adult_b'::uuid, 'I can do 6');
reset role;

-- The two quick lines arrive as one push, carrying the latest.
select is((select count(*)::int from app.notifications where user_id = :'adult_a'::uuid and kind = 'message' and (data->>'hit')::uuid = :'hit'::uuid), 1,
  'a burst of messages is one push, not a stack');
select is((select title || ': ' || body from app.notifications where user_id = :'adult_a'::uuid and kind = 'message' and (data->>'hit')::uuid = :'hit'::uuid), 'Adult: I can do 6',
  'it says who wrote and the latest line');

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select unread from app.inbox() where hit_id = :'hit'::uuid), 2, 'two unread from the other player');
select is((select last_body from app.inbox() where hit_id = :'hit'::uuid), 'I can do 6', 'and the latest one leads');
select app.mark_hit_read(:'hit'::uuid);
select is((select unread from app.inbox() where hit_id = :'hit'::uuid), 0, 'opening the thread reads them');
reset role;

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select throws_ok($$select app.mark_hit_read('00000000-0000-0000-0000-00000000f301')$$,
  'P0001', 'not your hit', 'nobody else can touch the read marker on a hit');

-- Discovery's radius snaps to the distances the app offers, so it cannot be stepped a
-- metre at a time to measure how far away someone's cell is.
select is((select count(*)::int from app.discover(p_radius_m => 1)), (select count(*)::int from app.discover(p_radius_m => 8047)),
  'a one-metre radius is treated as five miles');
select is((select count(*)::int from app.discover(p_radius_m => 9000)), (select count(*)::int from app.discover(p_radius_m => 16093)),
  'and anything between steps rounds up to the next one');
select is((select count(*)::int from app.discover(p_limit => 100000)), (select count(*)::int from app.discover(p_limit => 1000)),
  'and a page is at most a thousand players');

-- 6. Courts -------------------------------------------------------------------------------
select is((select players from app.court_players() where court_id = :'court'::uuid), 1,
  'a court counts the players you could actually invite there');
reset role;

select * from finish();
rollback;

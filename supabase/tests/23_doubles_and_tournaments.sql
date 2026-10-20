-- Doubles and tournaments (migration 20261020000100).
--
-- A doubles game is up to three ordinary invitations from one organizer. Whoever joins has
-- to be someone every player already in it could have invited: same side of 18, nobody
-- blocked, every parent's age rule. Tournament entrants are shown only to the players who
-- could already find them.

begin;
select plan(36);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set junior_c '00000000-0000-0000-0000-0000000000a3'
\set junior_e '00000000-0000-0000-0000-0000000000a5'
\set junior_f '00000000-0000-0000-0000-0000000000a6'
\set junior_g '00000000-0000-0000-0000-0000000000a7'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-00000000f401'
\set hit2     '00000000-0000-0000-0000-00000000f402'
\set hit3     '00000000-0000-0000-0000-00000000f403'

-- Three more juniors, 16, 15 and 13, linked to the same parent, a short drive away.
insert into auth.users (id, email) values
  (:'junior_e'::uuid, 'juniore@example.test'), (:'junior_f'::uuid, 'juniorf@example.test'), (:'junior_g'::uuid, 'juniorg@example.test');
insert into app.profiles (id, market_id, display_name, last_initial, date_of_birth, level_value, level_source,
                          home_court_id, availability_mask, phone_verified_at, snapped_point, play_format)
values
  (:'junior_e'::uuid, :'market'::uuid, 'Junior', 'E', current_date - interval '16 years 2 months', 8.40, 'utr_self',
   :'court'::uuid, 8, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2800, 42.2990), 4326)::geography), 'doubles'),
  (:'junior_f'::uuid, :'market'::uuid, 'Junior', 'F', current_date - interval '15 years 2 months', 8.60, 'utr_self',
   :'court'::uuid, 8, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2810, 42.2980), 4326)::geography), 'either'),
  (:'junior_g'::uuid, :'market'::uuid, 'Junior', 'G', current_date - interval '13 years 2 months', 8.20, 'utr_self',
   :'court'::uuid, 8, now(), app.snap_point(ST_SetSRID(ST_MakePoint(-71.2820, 42.2970), 4326)::geography), 'doubles');
insert into app.profiles_private (profile_id) values (:'junior_e'::uuid), (:'junior_f'::uuid), (:'junior_g'::uuid);
insert into app.guardian_links (minor_profile_id, guardian_user_id, guardian_email, relationship, verified_at)
values (:'junior_e'::uuid, :'guardian'::uuid, 'guardian@example.test', 'parent', now()),
       (:'junior_f'::uuid, :'guardian'::uuid, 'guardian@example.test', 'parent', now()),
       (:'junior_g'::uuid, :'guardian'::uuid, 'guardian@example.test', 'parent', now());
-- B's parent: within two years. A has no rule, so A could invite G (three years younger)
-- for singles; in a game with B, G can't join.
update app.profiles set max_partner_age_gap = 2 where id = :'junior_b'::uuid;

-- 1. Singles or doubles ----------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select play_format from app.profiles where id = :'junior_e'::uuid), 'doubles', 'players can see who is looking for doubles');
update app.profiles set play_format = 'doubles' where id = :'junior_a'::uuid;
select throws_ok($$update app.profiles set play_format = 'mixed' where id = app.uid()$$, '23514', null, 'singles, doubles or either, nothing else');

-- 2. A doubles game ---------------------------------------------------------------------------
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format)
values (:'hit'::uuid, :'market'::uuid, :'junior_a'::uuid, :'junior_b'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 90 minutes', :'junior_b'::uuid, 'doubles');
select is((select match_id from app.hit_requests where id = :'hit'::uuid), :'hit'::uuid, 'the first doubles invitation starts the game');
select is((select doubles_role from app.hit_requests where id = :'hit'::uuid), 'partner', 'and asks a partner');

insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
values (:'hit2'::uuid, :'market'::uuid, :'junior_a'::uuid, :'junior_e'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 90 minutes', :'junior_e'::uuid, 'doubles', :'hit'::uuid, 'opponent');
select is((select count(*)::int from app.hit_requests where match_id = :'hit'::uuid), 2, 'an opponent joins the same game');

select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'opponent')$$,
  :'market', :'junior_a', :'junior_g', :'court', :'junior_g', :'hit'), 'P0001', 'that player can''t join this doubles game',
  'a player outside one member''s parent rule cannot join, though the organizer could invite them alone');

select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'opponent')$$,
  :'market', :'junior_a', :'adult_a', :'court', :'adult_a', :'hit'), 'P0001', 'that player can''t join this doubles game', 'an adult cannot be asked into a junior game');

select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'opponent')$$,
  :'market', :'junior_a', :'junior_e', :'court', :'junior_e', :'hit'), 'P0001', 'they are already in this game', 'nobody is asked twice');

insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
values (:'hit3'::uuid, :'market'::uuid, :'junior_a'::uuid, :'junior_f'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 90 minutes', :'junior_f'::uuid, 'doubles', :'hit'::uuid, 'opponent');
select is((select count(*)::int from app.hit_requests where match_id = :'hit'::uuid), 3, 'a second opponent makes four');

select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'opponent')$$,
  :'market', :'junior_a', :'junior_g', :'court', :'junior_g', :'hit'), 'P0001', 'this game already has two opponents', 'a game has two opponents at most');
select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'partner')$$,
  :'market', :'junior_a', :'junior_g', :'court', :'junior_g', :'hit'), 'P0001', 'this game already has a partner', 'and one partner');
select throws_ok(format($$update app.hit_requests set format = 'singles' where id = %L$$, :'hit'), 'P0001', null, 'a sent invitation keeps its format');
select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'singles', %L)$$,
  :'market', :'junior_a', :'junior_g', :'court', :'junior_g', :'hit'), 'P0001', 'a singles hit has no doubles game', 'a singles hit cannot claim a game');
reset role;

select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select throws_ok(format($$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id, format, match_id, doubles_role)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 90 minutes', %L, 'doubles', %L, 'opponent')$$,
  :'market', :'junior_b', :'junior_g', :'court', :'junior_g', :'hit'), 'P0001', 'only the player who set up the doubles game invites the others',
  'only the organizer invites');
select throws_ok(format($$select * from app.suggest_doubles(%L, 'opponent')$$, :'hit'), 'P0001', null, 'and only the organizer asks for suggestions');
reset role;

-- Who is in it --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'junior_e', true);
set local role authenticated;
select is((select count(*)::int from app.doubles_match(:'hit'::uuid)), 4, 'an opponent sees all four players');
select is((select count(*)::int from app.doubles_match(:'hit'::uuid) where hit_id is not null), 1, 'and only their own invitation''s id');
select is((select role from app.doubles_match(:'hit'::uuid) where profile_id = :'junior_b'::uuid), 'partner', 'and who is on which side');
reset role;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select count(*)::int from app.doubles_match(:'hit'::uuid)), 0, 'someone outside the game sees nobody');
reset role;

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select count(*)::int from app.suggest_doubles(:'hit'::uuid, 'opponent')
            where profile_id in (:'junior_b'::uuid, :'junior_e'::uuid, :'junior_f'::uuid)), 0,
  'suggestions leave out the players already in the game');
select is((select count(*)::int from app.suggest_doubles(null, 'partner') where profile_id in (:'adult_a'::uuid, :'adult_b'::uuid)), 0,
  'and never suggest an adult to a junior');

-- 3. Tournaments ------------------------------------------------------------------------------
select set_config('test.t', app.add_tournament('Peninsula  Junior Open', current_date + 3, current_date + 4, 'Town courts', null)::text, true);
select is(app.add_tournament('peninsula junior open', current_date + 3, current_date + 4, null, null)::text, current_setting('test.t'),
  'the same tournament added twice is one tournament');
select throws_ok($$select app.add_tournament('Last Year Open', current_date - 3, current_date - 2)$$, 'P0001', null, 'a tournament that is over cannot be added');
select throws_ok($$select app.add_tournament('Link Open', current_date + 3, current_date + 3, null, 'http://example.test')$$, 'P0001', null, 'a link has to be https');
select throws_ok($$select * from app.tournaments$$, '42501', null, 'the tables are not readable directly');
select app.enter_tournament(current_setting('test.t')::uuid, 'b16', false, true, true);
reset role;

select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select app.enter_tournament(current_setting('test.t')::uuid, 'B16', true, true, false);
reset role;
select set_config('request.jwt.claim.sub', :'junior_g', true);
set local role authenticated;
select app.enter_tournament(current_setting('test.t')::uuid, 'B14', true, false, false);
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select app.enter_tournament(current_setting('test.t')::uuid, 'Open', true, false, false);
select is((select count(*)::int from app.tournament_players(current_setting('test.t')::uuid)), 0, 'an adult sees none of the juniors playing');
reset role;
select set_config('request.jwt.claim.sub', :'junior_c', true);
set local role authenticated;
select throws_ok(format($$select app.enter_tournament(%L, 'B14', true, false, false)$$, current_setting('test.t')), 'P0001', null,
  'a junior without a verified parent cannot enter');
reset role;

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select division from app.upcoming_tournaments() where id = current_setting('test.t')::uuid), 'B16', 'your entry comes back, division tidied');
select is((select count(*)::int from app.tournament_players(current_setting('test.t')::uuid) where profile_id = :'adult_a'::uuid), 0,
  'a junior never sees an adult who is playing');
select is((select profile_id from app.tournament_players(current_setting('test.t')::uuid) limit 1), :'junior_b'::uuid,
  'players in your division come first');
select ok((select age = 13 from app.tournament_players(current_setting('test.t')::uuid) where profile_id = :'junior_g'::uuid),
  'juniors see each other''s age');
select is((select players from app.upcoming_tournaments() where id = current_setting('test.t')::uuid), 2, 'counts only players you could find');
reset role;

update app.profiles set max_partner_age_gap = 2 where id = :'junior_g'::uuid;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select is((select count(*)::int from app.tournament_players(current_setting('test.t')::uuid) where profile_id = :'junior_g'::uuid), 0,
  'a parent''s age rule hides their child from older players at the tournament too');
reset role;

-- A parent, for their child.
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select app.leave_tournament(current_setting('test.t')::uuid, :'junior_b'::uuid);
select is((select entered from app.upcoming_tournaments(:'junior_b'::uuid) where id = current_setting('test.t')::uuid), false, 'a parent can take their child out');
reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select throws_ok(format($$select app.leave_tournament(%L, %L)$$, current_setting('test.t'), :'junior_a'), 'P0001', null, 'and nobody else can');
reset role;

select ok(not has_function_privilege('anon', 'app.tournament_players(uuid, uuid)', 'EXECUTE')
      and not has_function_privilege('authenticated', 'app.pair_ok(uuid, uuid)', 'EXECUTE'),
  'nothing new is reachable before sign-in, and the pair rule is internal');

select * from finish();
rollback;

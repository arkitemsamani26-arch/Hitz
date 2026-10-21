-- Parent-run accounts (migration 20261022000100).
--
-- A parent signs in with their own number, adds a child, and uses the app as that child.
-- The parent can act only as children they run, never as anyone else; the child is a
-- minor to every rule; sending or accepting as the child is the parent's approval; the
-- child's pushes reach the parent; under 13 nobody signs up alone; and a child of 13 or
-- more can be handed their own sign-in without losing anything.

begin;
select plan(48);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set parent   '00000000-0000-0000-0000-0000000000f1'
\set other    '00000000-0000-0000-0000-0000000000f2'
\set kidself  '00000000-0000-0000-0000-0000000000f3'
\set teenself '00000000-0000-0000-0000-0000000000f4'
\set newlogin '00000000-0000-0000-0000-0000000000f5'

-- The shim's auth.users has no phone; Supabase's does.
alter table auth.users add column if not exists phone text;
insert into auth.users (id, email, phone) values
  (:'parent'::uuid, null, '16505550100'),
  (:'other'::uuid, 'other@example.test', '16505550101'),
  (:'kidself'::uuid, 'kid@example.test', '16505550102'),
  (:'teenself'::uuid, 'teen@example.test', '16505550103'),
  (:'newlogin'::uuid, null, '16505550199');
update app.profiles set looking_to_hit_until = now() + interval '3 days' where id = :'junior_a'::uuid;

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- 1. Adding children --------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'parent', true);
set local role authenticated;
insert into ids values
  ('lily', app.add_child('Lily', 's', (current_date - interval '9 years')::date, 3.0, 'estimated', '00000000-0000-0000-0000-0000000000e1', 8, 'doubles')),
  ('theo', app.add_child('Theo', 'S', (current_date - interval '15 years 2 months')::date, 8.4, 'utr_self', '00000000-0000-0000-0000-0000000000e1', 8, 'either'));
select is((select count(*)::int from app.my_run_children()), 2, 'a parent with no profile of their own adds two children');
select is((select display_name from app.my_run_children() order by age limit 1), 'Lily', 'youngest first, with their name');
select ok(app.is_guardian_of((select v from ids where k = 'theo')), 'the parent is the child''s verified guardian from the start');
select ok(app.is_participating((select v from ids where k = 'theo')), 'so the child can take part straight away');
select throws_like($$select app.add_child('Sam', null, (current_date - interval '19 years')::date, null, null, null, 0, 'either')$$,
  'Someone who is 18%', 'an adult is not added as a child');
reset role;
select is((select band from (select app.profile_band(v) band from ids where k = 'theo') x), 'minor'::app.age_band, 'the child is a minor to every rule');

-- 2. Acting as a child, and only your own ---------------------------------------------------
select set_config('request.jwt.claim.sub', :'parent', true);
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'theo'))::text, true);
set local role authenticated;
select is(app.uid(), (select v from ids where k = 'theo'), 'with the header, the parent is their child');
select is((select display_name from app.my_profile()), 'Theo', 'and their own row is the child''s');
select ok(app.is_guardian_of((select v from ids where k = 'theo')), 'still a parent while switched, so approvals work from either side');
select throws_ok($$select app.begin_purchase()$$, 'P0001', null, 'Plus is bought as yourself, not while switched to a child');
select throws_ok($$select app.add_child('Sam', null, (current_date - interval '10 years')::date, null, null, null, 0, 'either')$$,
  'P0001', null, 'and children are added as yourself');
reset role;

select set_config('request.headers', json_build_object('x-hits-as', :'junior_a')::text, true);
set local role authenticated;
select throws_ok($$select app.uid()$$, '42501', null, 'naming a child somebody else runs, or a self-run player, is refused');
reset role;
select set_config('request.headers', '{"x-hits-as":"not-a-uuid"}', true);
set local role authenticated;
select throws_ok($$select app.uid()$$, '42501', null, 'so is nonsense');
reset role;

select set_config('request.jwt.claim.sub', :'other', true);
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'theo'))::text, true);
set local role authenticated;
select throws_ok($$select app.uid()$$, '42501', null, 'another parent cannot act as this child');
select is((select count(*)::int from app.my_run_children()), 0, 'or see them in their list');
reset role;
select set_config('request.headers', '', true);

select set_config('request.jwt.claim.sub', :'parent', true);
set local role authenticated;
select is(app.uid(), :'parent'::uuid, 'without the header, the parent is themselves');
select is((select v from ids where k = 'theo') in (select id from app.my_profile()), false, 'and their own row is not the child''s');
reset role;

-- 3. Nobody under 13 signs up alone; nobody changes who runs an account ------------------
select set_config('request.jwt.claim.sub', :'kidself', true);
set local role authenticated;
select throws_like($$insert into app.profiles (id, market_id, display_name, date_of_birth, phone_verified_at)
  values ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000d1', 'Kid', current_date - interval '11 years', now())$$,
  'under_13:%', 'an eleven-year-old signing up themselves is sent to a parent');
reset role;
select set_config('request.jwt.claim.sub', :'teenself', true);
set local role authenticated;
select lives_ok($$insert into app.profiles (id, market_id, display_name, date_of_birth)
  values ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000d1', 'Teen', current_date - interval '14 years')$$,
  'a fourteen-year-old can');
select is((select managed_by from app.my_profile()), null, 'and cannot name someone to run their account');
select throws_ok($$select managed_by from app.profiles$$, '42501', null, 'nor can any player read who runs an account');
select throws_ok($$update app.profiles set managed_by = '00000000-0000-0000-0000-0000000000f1' where id = '00000000-0000-0000-0000-0000000000f4'$$,
  'P0001', null, 'not later either');
reset role;

-- 4. The child is a junior in discovery, under the parent's rule ---------------------------
select set_config('request.jwt.claim.sub', :'parent', true);
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'theo'))::text, true);
set local role authenticated;
select ok(exists (select 1 from app.discover(p_radius_m => 16093) where profile_id = :'junior_a'::uuid), 'acting as Theo (15), a 16-year-old nearby shows up');
select ok(not exists (select 1 from app.discover(p_radius_m => 16093) where profile_id = :'adult_a'::uuid), 'an adult never does');
reset role;
select set_config('request.headers', '', true);
set local role authenticated;
select lives_ok(format('select app.set_child_age_gap(%L, 2)', (select v from ids where k = 'lily')), 'the parent sets Lily''s age rule as themselves');
reset role;
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'lily'))::text, true);
set local role authenticated;
select ok(not exists (select 1 from app.discover(p_radius_m => 16093) where profile_id = :'junior_a'::uuid), 'acting as Lily (9), a 16-year-old does not');
select throws_ok(format($f$insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
  values (%L, %L, %L, %L, now() + interval '2 days', now() + interval '2 days 1 hour', %L)$f$,
  :'market', (select v from ids where k = 'lily'), :'junior_a', :'court', :'junior_a'), '42501', null, 'and cannot be invited either');
reset role;

-- 5. Sending as the child is the parent's approval ---------------------------------------
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'theo'))::text, true);
set local role authenticated;
with x as (
  insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, awaiting_profile_id)
  values (:'market'::uuid, (select v from ids where k = 'theo'), :'junior_a'::uuid, :'court'::uuid,
          now() + interval '2 days', now() + interval '2 days 90 minutes', :'junior_a'::uuid)
  returning id)
insert into ids select 'hit', id from x;
reset role;
select is((select owner_approved from app.hit_requests where id = (select v from ids where k = 'hit')),
  array[(select v from ids where k = 'theo')], 'the parent sent it as Theo, so Theo''s side is approved');
select set_config('request.headers', '', true);
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
update app.hit_requests set state = 'accepted', awaiting_profile_id = null where id = (select v from ids where k = 'hit');
select is((select ok from app.parent_run(array[(select v from ids where k = 'theo')]) ok), (select v from ids where k = 'theo'),
  'the other player can tell a parent runs Theo''s account');
reset role;
select is((select decision from app.hit_guardian_approvals where hit_request_id = (select v from ids where k = 'hit') and minor_profile_id = (select v from ids where k = 'theo')),
  true, 'when Junior A says yes, Theo''s approval is already in');
select is((select state::text from app.hit_requests where id = (select v from ids where k = 'hit')), 'accepted', 'and the hit waits only on Junior A''s parent');
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
update app.hit_guardian_approvals set decision = true
 where hit_request_id = (select v from ids where k = 'hit') and minor_profile_id = :'junior_a'::uuid;
reset role;
select is((select state::text from app.hit_requests where id = (select v from ids where k = 'hit')), 'confirmed', 'who approves, and it''s on');

-- A counter is a new time: the parent's approval goes with it.
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select lives_ok(format($f$update app.hit_requests set state = 'countered', window_start = now() + interval '3 days',
  window_end = now() + interval '3 days 90 minutes', awaiting_profile_id = %L where id = %L$f$,
  (select v from ids where k = 'theo'), (select v from ids where k = 'hit')), 'Junior A suggests another time');
reset role;
select is((select owner_approved from app.hit_requests where id = (select v from ids where k = 'hit')), '{}'::uuid[],
  'and the parent''s approval of the old time is gone');
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
update app.hit_requests set owner_approved = array[(select v from ids where k = 'theo')] where id = (select v from ids where k = 'hit');
reset role;
select is((select owner_approved from app.hit_requests where id = (select v from ids where k = 'hit')), '{}'::uuid[],
  'which no client can write back');

-- 6. The child's pushes reach the parent -----------------------------------------------------
select app.enqueue((select v from ids where k = 'theo'), 'test', 'It''s on.', 'Court 3', '{}'::jsonb);
select is((select user_id from app.notifications where kind = 'test'), :'parent'::uuid, 'a push for Theo goes to the parent');
select is((select title from app.notifications where kind = 'test'), 'Theo: It''s on.', 'with his name on it');
select is((select data->>'as' from app.notifications where kind = 'test'), (select v::text from ids where k = 'theo'), 'and opens the app as him');

-- 7. Handing over a sign-in ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'parent', true);
set local role authenticated;
select throws_like(format('select app.start_handoff(%L, %L)', (select v from ids where k = 'lily'), '(650) 555-0198'),
  'Kids get their own sign-in from 13%', 'a nine-year-old stays with the parent');
select throws_ok(format('select app.revoke_guardian_link(id) from app.guardian_links where minor_profile_id = %L', (select v from ids where k = 'theo')),
  'P0001', null, 'and a parent cannot just drop a child they run');
select lives_ok(format('select app.start_handoff(%L, %L)', (select v from ids where k = 'theo'), '(650) 555-0199'), 'Theo (15) gets his own number');
reset role;
select set_config('request.jwt.claim.sub', :'newlogin', true);
set local role authenticated;
select is(app.claim_handoff(), (select v from ids where k = 'theo'), 'Theo signs in with that number and his profile is his');
select is(app.uid(), (select v from ids where k = 'theo'), 'from now on his login is him, history and all');
reset role;
select set_config('request.jwt.claim.sub', :'parent', true);
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'theo'))::text, true);
set local role authenticated;
select throws_ok($$select app.uid()$$, '42501', null, 'the parent no longer runs his account');
reset role;
select set_config('request.headers', '', true);
set local role authenticated;
select ok(app.is_guardian_of((select v from ids where k = 'theo')), 'but is still his parent, approving his hits');
reset role;

-- 8. Removing a child is deleting their account, as them -----------------------------------
select set_config('request.jwt.claim.sub', :'parent', true);
select set_config('request.headers', json_build_object('x-hits-as', (select v from ids where k = 'lily'))::text, true);
set local role authenticated;
select lives_ok($$select app.delete_account()$$, 'the parent removes Lily, switched to her');
reset role;
select is((select count(*)::int from app.profiles where id = (select v from ids where k = 'lily')), 0, 'and everything of hers goes');
select is((select count(*)::int from auth.users where id = :'parent'::uuid), 1, 'while the parent''s own login stays');

select * from finish();
rollback;

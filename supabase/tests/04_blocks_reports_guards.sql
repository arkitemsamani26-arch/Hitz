-- Blocking, reporting, and the server-owned columns.

begin;
select plan(12);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'

select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

select ok(app.can_view_profile(:'junior_b'::uuid), 'two linked minors can see each other to begin with');

insert into app.blocks (blocker_id, blocked_id) values (:'junior_a'::uuid, :'junior_b'::uuid);

select ok(not app.can_view_profile(:'junior_b'::uuid), 'the blocker can no longer see the blocked user');
select is((select count(*) from app.profiles where id = :'junior_b'::uuid), 0::bigint,
  'the blocked row is gone from the blocker''s queries entirely');

-- Symmetric in effect, whoever pressed the button.
reset role;
select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;

select ok(not app.can_view_profile(:'junior_a'::uuid),
  'blocking is symmetric in effect -- the blocked user also loses sight of the blocker');
select ok(not app.can_request_hit(:'junior_b'::uuid, :'junior_a'::uuid),
  'a blocked user cannot send a hit request back');

-- You must always be able to report someone, including someone you can no longer see.
select lives_ok($$
  insert into app.reports (reporter_profile_id, reported_profile_id, reason, body)
  values ('00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000a1', 'safety_concern', 'made me uncomfortable')
$$, 'a user can report someone they have already blocked out of view');

select is(
  (select involves_minor from app.reports
    where reported_profile_id = :'junior_a'::uuid order by created_at desc limit 1),
  true,
  'a report touching a minor is flagged priority automatically');

-- Reporters see their own reports and nothing else; the queue is not a client feature.
select is((select count(*) from app.reports), 1::bigint,
  'a reporter sees only their own reports');

-- Server-owned columns ----------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;

select throws_ok($$
  update app.profiles set date_of_birth = current_date - interval '30 years'
   where id = '00000000-0000-0000-0000-0000000000b1'
$$, 'date_of_birth cannot be changed after signup (support review required)',
  'date of birth is not client-editable -- it decides which safety regime applies');

select throws_ok($$
  update app.profiles set level_source = 'utr_verified'
   where id = '00000000-0000-0000-0000-0000000000b1'
$$, 'utr_verified can only be set by the UTR link flow',
  'a user cannot award themselves a verified rating badge');

select throws_ok($$
  update app.profiles set hits_confirmed = 500
   where id = '00000000-0000-0000-0000-0000000000b1'
$$, 'reputation counters are server-owned',
  'reputation counters cannot be self-reported');

select throws_ok($$
  update app.profiles
     set snapped_point = ST_SetSRID(ST_MakePoint(-71.0, 42.0), 4326)::geography
   where id = '00000000-0000-0000-0000-0000000000b1'
$$, 'snapped_point is derived from profiles_private.exact_point',
  'the approximate location cannot be spoofed by the client');

select * from finish();
rollback;

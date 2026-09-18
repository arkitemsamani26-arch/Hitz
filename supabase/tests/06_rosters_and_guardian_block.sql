-- Rosters carry no visibility privilege; guardians can block on a child's behalf.
begin;
select plan(7);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set guardian '00000000-0000-0000-0000-0000000000c1'

-- Adult creates a roster; a junior redeems it. They still cannot see each other.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select lives_ok($$ select app.create_roster('Paly Varsity', 20) $$, 'a participating player can create a roster');
select is((select count(*) from app.rosters where created_by = :'adult_a'::uuid), 1::bigint, 'the roster belongs to its creator');

reset role;
select code as rcode from app.rosters limit 1 \gset
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select lives_ok(format($$ select app.redeem_roster_code(%L) $$, :'rcode'), 'a junior can redeem the code');
select is((select count(*) from app.profiles where id = :'adult_a'::uuid), 0::bigint,
  'sharing a roster with an adult grants a minor NO visibility of them');

-- Guardian-side block.
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select lives_ok($$
  insert into app.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2')
$$, 'a verified guardian can block on their child''s behalf');
select throws_ok($$
  insert into app.blocks (blocker_id, blocked_id)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a2')
$$, 'new row violates row-level security policy for table "blocks"',
  'a guardian cannot block as someone who is not their child');

reset role;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select ok(not app.can_view_profile(:'junior_b'::uuid), 'the guardian''s block takes effect for the child');

select * from finish();
rollback;

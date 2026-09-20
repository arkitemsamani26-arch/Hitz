-- Numbers are never shown by default; shared per confirmed hit; revocable.
begin;
select plan(7);
set search_path = app, public;
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-0000000000f9'
update app.profiles_private set phone = '+16505550101' where profile_id = :'adult_a'::uuid;
update app.profiles_private set phone = '+16505550102' where profile_id = :'adult_b'::uuid;

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end)
values (:'hit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid, now() + interval '1 day', now() + interval '1 day 2 hours');
select throws_ok(format($$ select app.share_my_phone(%L, true) $$, :'hit'), 'You can share your number once the hit is confirmed.', 'cannot share before the hit is confirmed');

reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.hit_requests set state = 'accepted' where id = :'hit'::uuid;
select is((select state from app.hit_requests where id = :'hit'::uuid), 'confirmed'::app.hit_state, 'adult hit confirms');
select is((select count(*) from app.shared_phone(:'hit'::uuid)), 0::bigint, 'nothing is shared by default');

reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select lives_ok(format($$ select app.share_my_phone(%L, true) $$, :'hit'), 'a participant can share once confirmed');

reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select is((select phone from app.shared_phone(:'hit'::uuid) where not mine), '+16505550101', 'the other player sees the shared number');
select ok(not has_table_privilege('authenticated', 'app.profiles_private', 'SELECT'), 'and still cannot read the private table');

reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select app.share_my_phone(:'hit'::uuid, false);
reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select is((select count(*) from app.shared_phone(:'hit'::uuid)), 0::bigint, 'unsharing takes it back');
select * from finish();
rollback;

begin;
select plan(3);
set search_path = app, public;
\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set guardian '00000000-0000-0000-0000-0000000000c1'
update app.profiles set photo_url = 'https://x/avatars/a1/p.jpg' where id = :'junior_a'::uuid;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select is((select count(*) from app.profiles where photo_url like 'https://x/avatars/a1%'), 0::bigint, 'an adult cannot find a minor''s photo URL');
select throws_ok(format($$ select app.guardian_remove_photo(%L) $$, :'junior_a'), 'not your child', 'a stranger cannot remove it');
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select app.guardian_remove_photo(:'junior_a'::uuid);
reset role;
select is((select photo_url from app.profiles where id = :'junior_a'::uuid), null, 'the linked parent can remove the photo');
select * from finish();
rollback;

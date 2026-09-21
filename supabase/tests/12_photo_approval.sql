begin;
select plan(4);
set search_path = app, public;
\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;
select app.set_my_photo('https://x/avatars/a1/new.jpg');
reset role;
select is((select photo_url from app.profiles where id = :'junior_a'::uuid), null, 'a minor''s new photo is not published');
select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select is((select photo_url from app.profiles where id = :'junior_a'::uuid), null, 'another player sees no photo yet');
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;
select app.guardian_approve_photo(:'junior_a'::uuid, true);
reset role;
select is((select photo_url from app.profiles where id = :'junior_a'::uuid), 'https://x/avatars/a1/new.jpg', 'the parent approves it into place');
select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;
select is((select count(*) from app.profiles where id = :'junior_a'::uuid and photo_pending_url is not null), 0::bigint, 'pending is cleared');
select * from finish();
rollback;

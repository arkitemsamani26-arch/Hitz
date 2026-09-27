-- Deleting your account. Apple requires the button; these are the rules that make it
-- safe to press. The interesting cases are all about the people left behind.
begin;
select plan(16);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'

insert into auth.users (id) values (:'adult_b'::uuid), (:'guardian'::uuid)
  on conflict (id) do nothing;

-- Who can reach it -----------------------------------------------------------------
select ok(has_function_privilege('authenticated', 'app.delete_account()', 'EXECUTE'),
  'a signed-in user can delete their own account');
select ok(not has_function_privilege('anon', 'app.delete_account()', 'EXECUTE'),
  'a signed-out caller cannot');
select ok(not has_table_privilege('authenticated', 'app.deleted_accounts', 'SELECT'),
  'and nobody signed in can read the tombstones');

-- An adult with a confirmed hit and a report against them --------------------------
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, state)
values ('00000000-0000-0000-0000-00000000cc01', :'market'::uuid,
        :'adult_a'::uuid, :'adult_b'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 2 hours', 'confirmed');

insert into app.reports (id, reporter_profile_id, reported_profile_id, reason, body)
values ('00000000-0000-0000-0000-00000000dd01', :'adult_a'::uuid, :'adult_b'::uuid,
        'no_show', 'Never turned up.');

select is((select reported_ref from app.reports where id = '00000000-0000-0000-0000-00000000dd01'),
  :'adult_b'::uuid, 'a new report records who it is about, outside the foreign key');

delete from app.notifications;

select auth.login_as(:'adult_b'::uuid);
select lives_ok($$ select app.delete_account() $$, 'the account deletes');
select auth.logout();
reset role;

select is((select count(*)::int from app.profiles where id = :'adult_b'::uuid), 0,
  'the profile is gone, not flagged');
select is((select count(*)::int from app.profiles_private where profile_id = :'adult_b'::uuid), 0,
  'and so is the private row holding their phone and exact location');
select is((select count(*)::int from auth.users where id = :'adult_b'::uuid), 0,
  'and the login, so the account is deleted rather than emptied');

-- The row itself cascades away with the profile, which is right: it is half theirs.
-- What the other player keeps is the notification, not a ghost entry on their board.
select is((select count(*)::int from app.hit_requests where id = '00000000-0000-0000-0000-00000000cc01'), 0,
  'their confirmed hit does not linger on the other person''s calendar');
select is((select count(*)::int from app.notifications
            where user_id = :'adult_a'::uuid and kind = 'hit_cancelled'), 1,
  'and the other player is told the hit is off');
select is((select count(*)::int from app.notifications
            where user_id = :'adult_a'::uuid and body like '%deleted%'), 0,
  'without being told why, because that is not theirs to know');

-- The report outlives them ----------------------------------------------------------
select is((select count(*)::int from app.reports where id = '00000000-0000-0000-0000-00000000dd01'), 1,
  'the report about them survives: deleting your account is not how you erase one');
select is((select reported_profile_id from app.reports where id = '00000000-0000-0000-0000-00000000dd01'),
  null, 'the foreign key lets go');
select is((select reported_ref from app.reports where id = '00000000-0000-0000-0000-00000000dd01'),
  :'adult_b'::uuid, 'but a moderator can still group every report about that person');

select is((select reports_about from app.deleted_accounts where profile_id = :'adult_b'::uuid), 1,
  'a tombstone records that they left, and what was outstanding');

-- A guardian leaving is somebody else's problem ---------------------------------------
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, state)
values ('00000000-0000-0000-0000-00000000cc02', :'market'::uuid,
        :'junior_a'::uuid, '00000000-0000-0000-0000-0000000000a2'::uuid, :'court'::uuid,
        now() + interval '3 days', now() + interval '3 days 2 hours', 'accepted');

select auth.login_as(:'guardian'::uuid);
select lives_ok($$ select app.delete_account() $$, 'a guardian with no profile of their own can still delete');
select auth.logout();
reset role;

select is((select count(*)::int from app.guardian_links
            where guardian_user_id = :'guardian'::uuid and revoked_at is null), 0,
  'their guardianships are revoked, not deleted, so the link stays auditable');
select is((select state::text from app.hit_requests where id = '00000000-0000-0000-0000-00000000cc02'),
  'cancelled', 'and the child they were covering comes off the board rather than playing unsupervised');

select * from finish();
rollback;

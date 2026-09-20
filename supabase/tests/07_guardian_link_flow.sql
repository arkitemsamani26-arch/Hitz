-- The parent's link: preview, opened, accept (email must match), revoke.
begin;
select plan(9);
set search_path = app, public;

\set junior_c '00000000-0000-0000-0000-0000000000a3'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set guardian '00000000-0000-0000-0000-0000000000c1'

-- junior_c invited unverified@example.test. Create a user with that address.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c2', 'unverified@example.test');
select id as link from app.guardian_links where minor_profile_id = :'junior_c'::uuid \gset

-- Anonymous link page.
set local role anon;
select is((select child_name from app.guardian_link_preview(:'link'::uuid)), 'Junior', 'the link page shows the child''s first name only');
select lives_ok(format($$ select app.mark_guardian_link_opened(%L) $$, :'link'), 'opening the link is recorded without signing in');
reset role;
select ok((select opened_at is not null from app.guardian_links where id = :'link'::uuid), 'opened_at is set');

-- The wrong person cannot accept it.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select throws_ok(format($$ select app.accept_guardian_link(%L) $$, :'link'), 'This link was sent to a different email address.',
  'a signed-in user with a different email cannot verify the link');

-- The right person can.
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
set local role authenticated;
select lives_ok(format($$ select app.accept_guardian_link(%L) $$, :'link'), 'the invited address verifies the link');
reset role;
select ok(app.has_verified_guardian(:'junior_c'::uuid), 'the child now has a verified guardian');
select ok(app.is_participating(:'junior_c'::uuid), 'and participates');

-- Revoking ends participation.
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
set local role authenticated;
select lives_ok(format($$ select app.revoke_guardian_link(%L) $$, :'link'), 'the guardian can revoke');
reset role;
select ok(not app.is_participating(:'junior_c'::uuid), 'revoking removes participation immediately');

select * from finish();
rollback;

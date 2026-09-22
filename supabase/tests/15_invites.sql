-- Invite codes. Attribution, not privilege: the thing to hold onto is that redeeming a
-- code never makes anybody visible to anybody.
begin;
select plan(16);
set search_path = app, public;

\set junior_a  '00000000-0000-0000-0000-0000000000a1'
\set junior_c  '00000000-0000-0000-0000-0000000000a3'
\set adult_a   '00000000-0000-0000-0000-0000000000b1'
\set adult_b   '00000000-0000-0000-0000-0000000000b2'
\set roster    '00000000-0000-0000-0000-0000000000f1'

insert into app.rosters (id, name, code, cap, market_id, created_by)
values (:'roster'::uuid, 'Wellesley HS', 'WELLE42', 20,
        '00000000-0000-0000-0000-0000000000d1', :'adult_a'::uuid);

-- Issuing --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;

create temp table inv as select (app.issue_invite()).code::text as code;

select is((select length(code) from inv), 8,
  'an invite is long enough that guessing one is not worth doing');

select is((select kind from app.check_code((select code from inv))), 'invite',
  'and the code field knows which kind it is holding');

select is((select label from app.check_code((select code from inv))), 'Adult',
  'so the new player arrives to a name, not a form');

select ok((select valid from app.check_code((select code from inv))),
  'an unredeemed invite is valid');

-- A junior with no verified guardian cannot act, and issuing is acting.
select set_config('request.jwt.claim.sub', :'junior_c', true);
select throws_ok(
  $$ select app.issue_invite() $$, 'not participating',
  'a junior without a verified parent cannot hand out invites');

-- Redeeming --------------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_b', true);

select lives_ok(
  $$ select app.redeem_code((select code from inv)) $$,
  'someone handed the code can redeem it');

select is((select redeemed_by_profile_id from app.invites where code = (select code from inv)),
  :'adult_b'::uuid, 'and the invite records who it brought');

select ok(not (select valid from app.check_code((select code from inv))),
  'a used invite stops being valid');

select is((select label from app.check_code((select code from inv))), 'Adult',
  'but still says whose it was, so the field can explain rather than deny');

select throws_ok(
  $$ select app.redeem_code((select code from inv)) $$,
  'You have already used an invite.',
  'one invite per player, ever -- attribution is a fact about how someone arrived');

-- The issuer hears that it landed, and is not told who by. The outbox is server-owned,
-- so reading it is the reviewer's privilege, not a player's.
reset role;
select is((select count(*)::int from app.notifications
            where user_id = :'adult_a'::uuid and kind = 'invite_redeemed'), 1,
  'the issuer is told their invite landed');

select is((select body from app.notifications
            where user_id = :'adult_a'::uuid and kind = 'invite_redeemed'),
  'Someone you invited just joined Hits.',
  'and not who by: the two of them may be in different bands');

-- Your own invite is not a way to attribute yourself.
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
create temp table mine as select (app.issue_invite()).code::text as code;
select throws_ok(
  $$ select app.redeem_code((select code from mine)) $$,
  'That is your own invite.',
  'and you cannot redeem your own');

-- Ten out at a time ------------------------------------------------------------------------
-- adult_a holds one still open: the first was redeemed, so it no longer counts against them.
select lives_ok(
  $$ select app.issue_invite() from generate_series(1, 9) $$,
  'ten invites can be out at once');
select throws_ok(
  $$ select app.issue_invite() $$,
  'You have ten invites out already. Wait for one to be used.',
  'the eleventh is not a growth lever');

-- One field, two kinds of code ---------------------------------------------------------------
select is((select kind from app.check_code('WELLE42')), 'roster',
  'the same field still takes a team code');

rollback;

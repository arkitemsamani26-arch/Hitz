-- Verified levels by human review. The rule that matters: a player can file a claim and
-- can never grant themselves the badge.
begin;
select plan(13);
set search_path = app, public;

\set adult_a '00000000-0000-0000-0000-0000000000b1'
\set adult_b '00000000-0000-0000-0000-0000000000b2'

select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;

-- Filing -------------------------------------------------------------------------------
select lives_ok(
  $$ select app.submit_utr_claim(9.20, 'https://app.utrsports.net/profiles/123', 'Adult A Example') $$,
  'a player can state their UTR');

select is((select level_source from app.profiles where id = :'adult_a'::uuid), 'utr_self'::app.level_source,
  'which is a self-report until someone checks it');

select is((select state from app.my_utr_claim()), 'pending'::app.utr_claim_state,
  'and they can see it is waiting');

select throws_ok(
  $$ select app.submit_utr_claim(9.20, 'not-a-link', 'Adult A Example') $$,
  'We need the link to your UTR profile so we can check it.',
  'without a profile link there is nothing to check');

select throws_ok(
  $$ select app.submit_utr_claim(99, 'https://app.utrsports.net/profiles/123', 'Adult A Example') $$,
  'That is not a UTR.',
  'and 99 is not a UTR');

-- Re-filing replaces the open claim rather than stacking up.
select lives_ok(
  $$ select app.submit_utr_claim(9.40, 'https://app.utrsports.net/profiles/123', 'Adult A Example') $$,
  'filing again replaces the one still waiting');
select is((select count(*)::int from app.utr_claims where profile_id = :'adult_a'::uuid and state = 'pending'), 1,
  'so there is only ever one open claim');

-- The line that matters ------------------------------------------------------------------
select ok(not has_function_privilege('authenticated', 'app.review_utr_claim(uuid, boolean, text, numeric, text)', 'EXECUTE'),
  'a player cannot approve their own claim');

-- Nor read anyone else's.
reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
select is((select count(*) from app.utr_claims), 0::bigint,
  'and cannot see another player''s claim');

-- Reviewing ------------------------------------------------------------------------------
reset role;
select app.review_utr_claim(
  (select id from app.utr_claims where profile_id = :'adult_a'::uuid and state = 'pending'),
  true, 'sam@hits.test', 9.35, null);

select is((select level_source from app.profiles where id = :'adult_a'::uuid), 'utr_verified'::app.level_source,
  'a reviewed claim grants the badge');
select is((select level_value::numeric from app.profiles where id = :'adult_a'::uuid), 9.35::numeric,
  'at the number the reviewer actually saw, not the one claimed');
select is((select decided_by from app.utr_claims where profile_id = :'adult_a'::uuid and state = 'approved'),
  'sam@hits.test', 'and the claim records who checked it against utrsports.net');
select is((select utr_verified_by from app.profiles where id = :'adult_a'::uuid), 'review',
  'and the provenance is recorded, so a UTR partnership can tell the two apart');

select * from finish();
rollback;

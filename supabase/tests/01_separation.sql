-- The separation rule, tested adversarially.
--
-- The question these tests ask is not "does the UI hide minors from adults" but "can an
-- adult's session reach a minor's row by ANY query the client can construct". A
-- minor-safety rule that isn't tested isn't a rule.

begin;
select plan(12);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set junior_c '00000000-0000-0000-0000-0000000000a3'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set guardian '00000000-0000-0000-0000-0000000000c1'

-- Band derivation ---------------------------------------------------------------------
select is(app.profile_band(:'junior_a'::uuid), 'minor'::app.age_band,
  'a 16-year-old derives as minor');
select is(app.profile_band(:'adult_a'::uuid), 'adult'::app.age_band,
  'a 25-year-old derives as adult');
select is(app.band_of((current_date - interval '18 years')::date), 'adult'::app.age_band,
  'the boundary: exactly 18 today is an adult');
select is(app.band_of((current_date - interval '18 years' + interval '1 day')::date), 'minor'::app.age_band,
  'one day short of 18 is still a minor');

-- As an adult -------------------------------------------------------------------------
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;

select is(
  (select count(*) from app.profiles where id = :'junior_a'::uuid),
  0::bigint,
  'an adult selecting a minor by primary key gets nothing');

select is(
  (select count(*) from app.profiles where date_of_birth > current_date - interval '18 years'),
  0::bigint,
  'an adult cannot enumerate minors by date of birth');

select is(
  (select count(*) from app.profiles),
  2::bigint,
  'an adult sees only themselves and the other adult');

select ok(not app.can_view_profile(:'junior_a'::uuid),
  'can_view_profile is false across the age boundary');

select ok(not app.can_request_hit(:'adult_a'::uuid, :'junior_a'::uuid),
  'an adult cannot request a hit with a minor');

-- As a minor --------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

select is(
  (select count(*) from app.profiles where id = :'adult_a'::uuid),
  0::bigint,
  'a minor cannot see an adult either -- the rule is symmetric');

-- junior_c has no verified guardian, so they do not participate yet.
select is(
  (select count(*) from app.profiles where id = :'junior_c'::uuid),
  0::bigint,
  'a minor without a verified guardian is not discoverable');

-- Guardian visibility is the deliberate exception.
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;

select is(
  (select count(*) from app.profiles where id in (:'junior_a'::uuid, :'junior_b'::uuid)),
  2::bigint,
  'a verified guardian sees their own children');

select * from finish();
rollback;

-- The verified badge can only come from the server.
begin;
select plan(5);
set search_path = app, public;
\set adult_a '00000000-0000-0000-0000-0000000000b1'
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;
select throws_ok($$ select app.apply_utr('00000000-0000-0000-0000-0000000000b1', 'x', 9.5, 'rated', null, null) $$,
  'permission denied for function apply_utr', 'a client cannot apply a UTR rating');
select lives_ok($$ select app.begin_utr_link() $$, 'a client can start the link (gets a state)');
reset role;
select app.apply_utr(:'adult_a'::uuid, 'utr-123', 9.52, 'rated', 'tok', 'ref');
select is((select level_source from app.profiles where id = :'adult_a'::uuid), 'utr_verified'::app.level_source, 'a rated player becomes utr_verified');
-- level_value is a domain over numeric, so the cast is what lets pgTAP resolve is().
select is((select level_value::numeric from app.profiles where id = :'adult_a'::uuid), 9.52::numeric, 'and takes the UTR rating');
select ok(not has_table_privilege('authenticated', 'app.utr_links', 'SELECT'), 'tokens are unreadable by clients');
select * from finish();
rollback;

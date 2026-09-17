-- Guardian approves the hit, not the conversation.
--
-- The kids browse, request, accept and chat without an adult in the loop. The guardian
-- has one required action, at exactly one point: the moment before a real-world meeting.

begin;
select plan(11);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set guardian '00000000-0000-0000-0000-0000000000c1'
\set court    '00000000-0000-0000-0000-0000000000e1'
\set market   '00000000-0000-0000-0000-0000000000d1'
\set hit      '00000000-0000-0000-0000-0000000000f1'
\set adulthit '00000000-0000-0000-0000-0000000000f2'

-- Junior A requests a hit with Junior B. No adult involved so far.
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

select lives_ok($$
  insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id,
                                window_start, window_end, awaiting_profile_id)
  values ('00000000-0000-0000-0000-0000000000f1',
          '00000000-0000-0000-0000-0000000000d1',
          '00000000-0000-0000-0000-0000000000a1',
          '00000000-0000-0000-0000-0000000000a2',
          '00000000-0000-0000-0000-0000000000e1',
          now() + interval '2 days', now() + interval '2 days 2 hours',
          '00000000-0000-0000-0000-0000000000a2')
$$, 'a minor can send a hit request to another minor with no adult involved');

-- Junior B accepts. Still no adult.
reset role;
select set_config('request.jwt.claim.sub', :'junior_b', true);
set local role authenticated;

select lives_ok($$
  update app.hit_requests set state = 'accepted'
   where id = '00000000-0000-0000-0000-0000000000f1'
$$, 'the other minor can accept');

select is(
  (select state from app.hit_requests where id = :'hit'::uuid),
  'accepted'::app.hit_state,
  'an accepted hit between two minors does NOT auto-confirm');

select is(
  (select count(*) from app.hit_guardian_approvals where hit_request_id = :'hit'::uuid),
  2::bigint,
  'accepting seeds one pending approval per minor participant');

-- The gate itself.
select throws_ok($$
  update app.hit_requests set state = 'confirmed'
   where id = '00000000-0000-0000-0000-0000000000f1'
$$, 'hit cannot be confirmed until every minor participant has guardian approval',
  'a minor cannot confirm their own hit past the guardian gate');

-- Messaging works while unconfirmed: the guardian gates the meeting, not the chat.
select lives_ok($$
  insert into app.hit_messages (hit_request_id, sender_profile_id, body)
  values ('00000000-0000-0000-0000-0000000000f1',
          '00000000-0000-0000-0000-0000000000a2', 'see you saturday')
$$, 'the kids can talk before a guardian has approved anything');

-- The guardian approves both children.
reset role;
select set_config('request.jwt.claim.sub', :'guardian', true);
set local role authenticated;

select is(
  (select count(*) from app.hit_messages where hit_request_id = :'hit'::uuid),
  1::bigint,
  'a guardian can read the thread in full, not a summary');

select lives_ok($$
  update app.hit_guardian_approvals set decision = true
   where hit_request_id = '00000000-0000-0000-0000-0000000000f1'
$$, 'the guardian approves');

select is(
  (select state from app.hit_requests where id = :'hit'::uuid),
  'confirmed'::app.hit_state,
  'the hit confirms once every minor has guardian approval');

-- A counter after approval invalidates it: the guardian approved a specific court and
-- time, not a blank cheque.
reset role;
select set_config('request.jwt.claim.sub', :'junior_a', true);
set local role authenticated;

update app.hit_requests set window_start = now() + interval '3 days',
                            window_end = now() + interval '3 days 2 hours'
 where id = :'hit'::uuid;

select is(
  (select count(*) from app.hit_guardian_approvals where hit_request_id = :'hit'::uuid),
  0::bigint,
  'changing the court or time clears every prior guardian approval');

-- Adults need no approval, so their hits confirm on accept.
reset role;
select set_config('request.jwt.claim.sub', :'adult_a', true);
set local role authenticated;

insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id,
                              window_start, window_end)
values (:'adulthit'::uuid, :'market'::uuid, :'adult_a'::uuid, :'adult_b'::uuid,
        :'court'::uuid, now() + interval '1 day', now() + interval '1 day 2 hours');

reset role;
select set_config('request.jwt.claim.sub', :'adult_b', true);
set local role authenticated;
update app.hit_requests set state = 'accepted' where id = :'adulthit'::uuid;

select is(
  (select state from app.hit_requests where id = :'adulthit'::uuid),
  'confirmed'::app.hit_state,
  'an adult-only hit confirms immediately on accept');

select * from finish();
rollback;

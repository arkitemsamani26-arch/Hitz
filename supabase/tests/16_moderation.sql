-- Moderation. The report button promises a person reads it the same day; these are the
-- rules that make that promise keepable, and the one that makes it safe: no signed-in
-- user can reach any of it.
begin;
select plan(16);
set search_path = app, public;

\set junior_a '00000000-0000-0000-0000-0000000000a1'
\set junior_b '00000000-0000-0000-0000-0000000000a2'
\set adult_a  '00000000-0000-0000-0000-0000000000b1'
\set adult_b  '00000000-0000-0000-0000-0000000000b2'
\set court    '00000000-0000-0000-0000-0000000000e1'

-- Two juniors with a confirmed hit, and one of them reports the other.
insert into app.hit_requests (id, market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, state)
values ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000d1',
        :'junior_a'::uuid, :'junior_b'::uuid, :'court'::uuid,
        now() + interval '2 days', now() + interval '2 days 2 hours', 'accepted');

insert into app.reports (id, reporter_profile_id, reported_profile_id, reason, body)
values ('00000000-0000-0000-0000-00000000bb01', :'junior_a'::uuid, :'junior_b'::uuid,
        'inappropriate_messages', 'Said something nasty.');

select ok((select involves_minor from app.reports where id = '00000000-0000-0000-0000-00000000bb01'),
  'a report touching a minor is flagged for the front of the queue');

select is((select count(*)::int from app.moderation_queue
            where report_id = '00000000-0000-0000-0000-00000000bb01'), 1,
  'and it is in the queue the reviewer actually reads');

-- Nobody signed in can reach any of this ------------------------------------------------
select ok(not has_function_privilege('authenticated', 'app.review_report(uuid, text, text, text, boolean)', 'EXECUTE'),
  'a signed-in user cannot review a report');
select ok(not has_function_privilege('authenticated', 'app.suspend_profile(uuid)', 'EXECUTE'),
  'nor suspend anybody');
select ok(not has_function_privilege('authenticated', 'app.reinstate_profile(uuid)', 'EXECUTE'),
  'nor reinstate anybody');
select ok(not has_table_privilege('authenticated', 'app.moderation_queue', 'SELECT'),
  'nor read the queue');

-- A decision is one call ------------------------------------------------------------------
select throws_ok(
  $$ select app.review_report('00000000-0000-0000-0000-00000000bb01', 'suspend', '   ', 'sam') $$,
  'every decision leaves a resolution',
  'and it never lands without a resolution');

-- app.uid() is null in the SQL editor, which is where moderation.sql says to work, so
-- "who decided this" has to be typed rather than inferred.
select throws_ok(
  $$ select app.review_report('00000000-0000-0000-0000-00000000bb01', 'suspend', 'because', '  ') $$,
  'every decision leaves a reviewer',
  'nor without a reviewer -- nobody suspends anybody anonymously');

select throws_ok(
  $$ select app.review_report('00000000-0000-0000-0000-00000000bb01', 'ban', 'because', 'sam') $$,
  'action must be suspend or dismiss, not ban',
  'there are two actions, not a free-text verb');

select is(
  (select app.review_report('00000000-0000-0000-0000-00000000bb01', 'suspend',
                            'suspended: repeated abuse in thread', 'sam@hits.test')),
  1,
  'suspending reports how many live hits it just cancelled');

select is((select reviewer from app.moderation_log
            where report_id = '00000000-0000-0000-0000-00000000bb01'), 'sam@hits.test',
  'and the log says who made the call');

select is((select status from app.profiles where id = :'junior_b'::uuid), 'suspended'::app.profile_status,
  'the profile is hidden');

-- The part the three hand-typed UPDATEs never did.
select is((select state from app.hit_requests where id = '00000000-0000-0000-0000-00000000aa01'),
  'cancelled'::app.hit_state,
  'and the hit that was already on somebody else''s calendar comes off it');

select is((select count(*)::int from app.notifications
            where user_id = :'junior_a'::uuid and kind = 'hit_cancelled'), 1,
  'the other player is told their hit is off');

select is((select body from app.notifications
            where user_id = :'junior_a'::uuid and kind = 'report_reviewed'),
  'Thank you. We acted on it.',
  'and the reporter hears back, which is the whole of what the button promised');

-- Dismissing the last report can undo an automatic hide ---------------------------------
-- Three distinct reporters hide a profile on their own. If all three were nonsense, the
-- profile must not stay hidden because nobody remembered a fourth statement.
insert into app.reports (id, reporter_profile_id, reported_profile_id, reason, body)
values ('00000000-0000-0000-0000-00000000bb02', :'adult_b'::uuid, :'adult_a'::uuid, 'other', 'Nonsense.');
update app.profiles set status = 'suspended' where id = :'adult_a'::uuid;

select app.review_report('00000000-0000-0000-0000-00000000bb02', 'dismiss', 'nothing to it', 'sam@hits.test', true);
select is((select status from app.profiles where id = :'adult_a'::uuid), 'active'::app.profile_status,
  'a dismissal can put back someone the auto-hide rule took down');

rollback;

-- The executable surface of schema `app`, pinned.
--
-- Every other test here asks "can this role do this particular thing". This one asks the
-- question from the other side: what is the complete set of things each role can reach?
-- That is the only form of the question that catches a function somebody adds next month
-- and forgets to lock down, because Postgres's default is EXECUTE to PUBLIC and anon
-- inherits PUBLIC. Relying on ALTER DEFAULT PRIVILEGES for this did not work -- it covers
-- only objects created afterwards by the role that ran it -- and the live project spent a
-- while with roughly forty functions quietly reachable by anon as a result.
--
-- If you are here because this test failed: you added a function. Decide which list it
-- belongs in and say so out loud in a migration. Do not add it here to make the red go
-- away.
begin;
select plan(6);
set search_path = app, public;

-- Anonymous ------------------------------------------------------------------------------
-- Before sign-in there is exactly one screen that talks to the database (the phone step's
-- code field), one that counts a cohort, and the page a parent opens from a text message.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and has_function_privilege('anon', p.oid, 'EXECUTE')),
  array['check_code', 'check_roster_code', 'guardian_link_preview',
        'mark_guardian_link_opened', 'peek_cohort'],
  'anon can execute exactly the five RPCs that run before anyone has signed in');

select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app' and has_table_privilege('anon', c.oid, 'SELECT')),
  0,
  'and cannot read a single table or view directly');

-- The server ------------------------------------------------------------------------------
-- The cron functions are revoked from every client role, which is right, and was done by
-- revoking PUBLIC -- which was the only grant they had. service_role is not a superuser,
-- so that silently took the scheduled jobs down with it: notify() fires every minute and
-- discards the result, so nothing said a word.
select ok(has_function_privilege('service_role', 'app.expire_requests()', 'EXECUTE'),
  'the server can expire stale requests');
select ok(has_function_privilege('service_role', 'app.enqueue_tomorrow_reminders()', 'EXECUTE'),
  'and fill the outbox with tomorrow''s reminders');
select ok(
  has_function_privilege('service_role', 'app.apply_utr(uuid, text, numeric, text, text, text)', 'EXECUTE')
  and has_function_privilege('service_role', 'app.utr_due_for_sync(int)', 'EXECUTE')
  and has_function_privilege('service_role', 'app.retire_utr(uuid)', 'EXECUTE'),
  'and keep verified UTR badges current');

-- Which must not have widened the client's reach by accident.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app'
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and p.proname in ('expire_requests', 'enqueue_tomorrow_reminders', 'enqueue',
                        'apply_utr', 'retire_utr', 'utr_due_for_sync', 'review_utr_claim',
                        'review_report', 'suspend_profile', 'reinstate_profile',
                        'mint_code', 'snap_point')),
  '{}'::text[],
  'and a signed-in player still cannot reach any of it');

rollback;

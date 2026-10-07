-- Taking the service_role key back out of the database
--
-- `drain_outbox()` invoked the notify edge function through pg_net, with
-- `Authorization: Bearer <service_role key>` in the headers. pg_net stores a pending
-- request -- headers included -- as a row in `net.http_request_queue`, and on this project
-- `anon` and `authenticated` hold USAGE on the `net` schema and SELECT on that table.
-- Those grants come with the extension and belong to supabase_admin, so they cannot be
-- revoked from a migration; both attempts failed silently.
--
-- Nothing leaked. The Vault secret was never created, so the function returned 'no key'
-- every minute and never built a request: both net tables were empty when this was found.
-- But the next step on the launch list was to add that secret, which would have started
-- writing the key that bypasses every RLS policy in this database into a table two
-- unprivileged roles can read.
--
-- `net` is not one of the API's exposed schemas, so this was not reachable with a
-- publishable key over REST. It was still the wrong place to put that particular
-- credential, and the fix costs nothing: the platform can invoke the function itself.
--
-- So: no key, no pg_net, no secret anywhere in the database. The schedule moves to
-- Dashboard -> Edge Functions -> notify -> Schedules, where Supabase authenticates the
-- call internally. That was the original plan in docs/09 before this function replaced it.
drop function if exists app.drain_outbox();

do $cron$ begin
  if to_regclass('cron.job') is null then return; end if;
  perform cron.unschedule(jobname) from cron.job where jobname = 'hits-drain-outbox';
end $cron$;

-- The other two jobs are pure SQL running as the table owner. They carry no credential and
-- stay exactly as they were.

comment on schema app is
  'Hits. No credential is ever stored in or sent from this database: the notify function '
  'is scheduled by the platform, not invoked from SQL. See migration 20260929000300.';

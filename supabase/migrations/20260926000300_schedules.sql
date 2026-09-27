-- The schedules themselves.
--
-- Nothing was scheduled on the live project, which is why stale requests never expired and
-- the outbox was never filled or drained. `ops_health()` reported cron_jobs = 0 and there
-- was nothing to read it.
--
-- pg_cron lives in the postgres database only, so on a local test database these statements
-- are skipped rather than failing the migration run.
do $cron$
begin
  if to_regclass('pg_catalog.pg_extension') is null then return; end if;

  begin
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_cron/pg_net unavailable here; skipping schedules';
    return;
  end;

  -- Idempotent: unschedule by name first, so re-running a migration does not stack jobs.
  perform cron.unschedule(jobname) from cron.job
    where jobname in ('hits-expire-requests', 'hits-tomorrow-reminders', 'hits-drain-outbox');

  perform cron.schedule('hits-expire-requests',   '*/10 * * * *', $$select app.expire_requests()$$);
  perform cron.schedule('hits-tomorrow-reminders','7 * * * *',    $$select app.enqueue_tomorrow_reminders()$$);
  -- Every minute. A push that arrives four minutes after a parent taps Approve is a push
  -- that arrives after the child has given up looking at their phone.
  perform cron.schedule('hits-drain-outbox',      '* * * * *',    $$select app.drain_outbox()$$);
end $cron$;

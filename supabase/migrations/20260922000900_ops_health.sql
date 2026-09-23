-- One question the server can ask about itself.
--
-- Three bugs in one session had the same shape: the code assumed the project was
-- configured a way nobody had configured it, and the app degraded quietly enough that a
-- live smoke test passed anyway. The cron functions had lost the only EXECUTE grant they
-- had. The realtime publication was empty, so a subscription nobody could see was firing
-- never fired. `notify` has no schedule at all, so the outbox is never drained.
--
-- None of those were findable with `npm run check:backend`, because that speaks to the
-- REST API with the anon key and every one of them is invisible from there. This is what
-- it needs to be able to ask, and it is service-role only because every answer is a fact
-- about the inside of the system.
--
-- The point is not the numbers. It is that a deployment can be wrong in a way that shows
-- up nowhere until a fourteen-year-old does not get told their hit was approved.
create or replace function app.ops_health()
returns table (
  realtime_tables       int,      -- expect 3
  anon_executable       int,      -- expect 5
  cron_ready            boolean,  -- pg_cron + pg_net installed
  cron_jobs             int,      -- schedules defined, if pg_cron is there to ask
  outbox_waiting        int,
  outbox_oldest_seconds int,      -- climbs forever when notify is not running
  jobs_executable       boolean   -- can service_role actually run the scheduled work
)
language plpgsql
stable
security definer
set search_path = app, public
as $$
begin
  realtime_tables := (select count(*) from pg_publication_tables
                       where pubname = 'supabase_realtime' and schemaname = 'app');

  anon_executable := (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname = 'app' and has_function_privilege('anon', p.oid, 'EXECUTE'));

  cron_ready := (select count(*) from pg_extension where extname in ('pg_cron', 'pg_net')) = 2;

  -- cron.job only exists once pg_cron does, so this has to be asked dynamically.
  cron_jobs := 0;
  if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
              where n.nspname = 'cron' and c.relname = 'job') then
    execute 'select count(*)::int from cron.job' into cron_jobs;
  end if;

  select count(*)::int,
         coalesce(extract(epoch from max(now() - created_at))::int, 0)
    into outbox_waiting, outbox_oldest_seconds
    from app.notifications where sent_at is null;

  jobs_executable :=
       has_function_privilege('service_role', 'app.expire_requests()', 'EXECUTE')
   and has_function_privilege('service_role', 'app.enqueue_tomorrow_reminders()', 'EXECUTE')
   and has_function_privilege('service_role', 'app.apply_utr(uuid, text, numeric, text, text, text)', 'EXECUTE')
   and has_function_privilege('service_role', 'app.utr_due_for_sync(int)', 'EXECUTE')
   and has_function_privilege('service_role', 'app.retire_utr(uuid)', 'EXECUTE');

  return next;
end;
$$;

revoke execute on function app.ops_health() from public, anon, authenticated;
grant  execute on function app.ops_health() to service_role;

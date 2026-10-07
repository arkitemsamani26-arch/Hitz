-- ops_health learns one more question
--
-- The security linter found that `anon` could write to `public.spatial_ref_sys`, and the
-- migration meant to fix it could not: that table belongs to supabase_admin. The local
-- test suite passes anyway, because on a stock Postgres we own the table -- so the suite
-- says "fixed" while the live project is not.
--
-- That is the same shape as the three bugs that made this function exist. So it gets
-- asked here instead, where it is asked of the real project: how many tables outside
-- `app` can a signed-out caller write to? The answer should be zero, and it stays wrong
-- until `public` is removed from the API's exposed schemas.
-- Adding an OUT parameter changes the function's row type, which CREATE OR REPLACE
-- refuses, so this drops first. Safe: nothing depends on it but the ops script.
drop function if exists app.ops_health();

create function app.ops_health()
returns table (
  realtime_tables       int,
  anon_executable       int,
  cron_ready            boolean,
  cron_jobs             int,
  outbox_waiting        int,
  outbox_oldest_seconds int,
  jobs_executable       boolean,
  public_writable_by_anon int   -- expect 0; see docs/11
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

  -- Writable, by a caller holding nothing but the publishable key.
  public_writable_by_anon := (
    select count(*)::int from pg_class c
     where c.relkind = 'r'
       and c.relnamespace::regnamespace::text not in ('app', 'pg_catalog', 'information_schema')
       and not c.relrowsecurity
       and (has_table_privilege('anon', c.oid, 'INSERT')
         or has_table_privilege('anon', c.oid, 'UPDATE')
         or has_table_privilege('anon', c.oid, 'DELETE')));

  return next;
end;
$$;

revoke execute on function app.ops_health() from public, anon, authenticated;
grant  execute on function app.ops_health() to service_role;

-- What the security linter flagged, pinned so it cannot come back.
begin;
select plan(6);
set search_path = app, public;

-- These two pass here and prove nothing about production. On a stock Postgres we own
-- spatial_ref_sys so the revoke lands; on Supabase it is owned by supabase_admin and the
-- same migration silently cannot. The live answer comes from `ops_health()`, which asks
-- the question of the real project -- see `public_writable_by_anon`.
select ok(not has_table_privilege('anon', 'public.spatial_ref_sys', 'UPDATE'),
  'anon cannot rewrite the coordinate systems every distance query depends on (locally)');
select ok(not has_table_privilege('anon', 'public.spatial_ref_sys', 'DELETE'),
  'nor delete them (locally)');
select ok(has_table_privilege('anon', 'public.spatial_ref_sys', 'SELECT'),
  'but can still read them, because PostGIS needs to on every geography call');

select ok((select relrowsecurity from pg_class where oid = 'app.deleted_accounts'::regclass),
  'the tombstones have row level security, not just an absent grant');

select ok(not has_table_privilege('authenticated', 'app.reports', 'UPDATE'),
  'a signed-in user cannot update a report, by grant as well as by policy');

-- The whole class, asked from the other side: every function in the schema pins its
-- search_path. `stamp_report_refs` did not, and nothing would have caught it.
select is(
  (select coalesce(array_agg(p.proname::text order by p.proname), '{}')
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app' and p.prokind = 'f'
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c
                       where c like 'search_path=%')),
  '{}'::text[],
  'every function in schema app pins its search_path');

select * from finish();
rollback;

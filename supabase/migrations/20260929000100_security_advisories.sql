-- Closing what Supabase's security linter found
--
-- One ERROR and one WARN, both worth fixing, neither as alarming as the email.
--
-- The ERROR was `public.spatial_ref_sys`: PostGIS's own table of coordinate-system
-- definitions, which ships with the extension in the `public` schema and had RLS off and
-- full write access granted to `anon`. It holds no personal data -- it is the EPSG
-- reference list -- so nothing about a player was ever exposed. What WAS possible is that
-- anyone holding the publishable key could rewrite or delete those definitions, and every
-- distance and location-snapping call in the app goes through them. That is a real
-- integrity problem even though it is not a privacy one.
--
-- RLS cannot be enabled on it: the table belongs to the extension, not to us. Revoking the
-- writes is the fix Supabase recommends, and it is the better one anyway -- SELECT has to
-- stay, because ST_Transform and the geography operators read it on every query.
do $srs$ begin
  if to_regclass('public.spatial_ref_sys') is null then return; end if;
  -- On a stock Postgres (and so in the test suite) this works, because we own the table.
  -- On Supabase it does NOT: spatial_ref_sys belongs to supabase_admin and migrations run
  -- as postgres, which is not a member of that role. The revoke fails and there is nothing
  -- this file can do about it.
  --
  -- A NOTICE would have been swallowed, which is how the first version of this migration
  -- reported success while changing nothing on the live project -- the exact failure mode
  -- `ops_health()` exists to catch. WARNING is visible in the migration output, and
  -- `ops_health()` now counts the problem directly so the live answer never comes from
  -- a test that only ever runs somewhere else.
  --
  -- The real fix is to stop exposing the `public` schema through the API at all. The app
  -- only ever talks to `app` (see the createClient call in src/data/supabase.ts), so
  -- nothing breaks: Dashboard -> Project Settings -> API -> Exposed schemas, remove
  -- `public`. See docs/11.
  begin
    execute 'revoke insert, update, delete, truncate on public.spatial_ref_sys from anon, authenticated';
  exception when insufficient_privilege or undefined_object then
    raise warning 'spatial_ref_sys is owned by another role: anon can still write to it. Remove `public` from the API''s exposed schemas.';
  end;
end $srs$;

-- The WARN was mine, from the account-deletion migration three days ago:
-- `stamp_report_refs` is the only function in the schema without a pinned search_path.
-- A trigger function that resolves its own names is how a schema-shadowing attack starts,
-- and every other function here was pinned back in migration 12. This one was missed
-- because it was written as a plain trigger rather than a SECURITY DEFINER call.
do $fn$ begin
  if to_regprocedure('app.stamp_report_refs()') is not null then
    execute 'alter function app.stamp_report_refs() set search_path = app, public';
  end if;
end $fn$;

-- Defence in depth on the tombstones. There are no grants on this table at all, so no
-- signed-in user can reach it either way, but "no grant" and "no rows visible" are two
-- different guarantees and a future GRANT should not silently open it.
alter table app.deleted_accounts enable row level security;

-- And a grant that outlived its policy. `authenticated` could UPDATE app.reports, which
-- RLS has always refused because no UPDATE policy exists -- but a grant with nothing
-- behind it is one policy away from being a way to edit a report about yourself.
revoke update on app.reports from authenticated;

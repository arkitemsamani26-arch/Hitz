-- Findings from the Supabase security advisor on the live project: pin search_path on
-- the remaining functions, and take PostGIS's anon-executable helper off the API.
alter function app.guard_profile_columns() set search_path = app, public, pg_catalog;
alter function app.guard_guardian_links() set search_path = app, public, pg_catalog;
alter function app.uid() set search_path = app, public, auth;
alter function app.band_of(date) set search_path = app, public;
alter function app.snap_point(geography) set search_path = app, public;
alter function app.distance_bucket_m(double precision) set search_path = app, public;
alter function app.enqueue(uuid, text, text, text, jsonb) set search_path = app, public;
do $$ begin
  if to_regprocedure('public.st_estimatedextent(text, text)') is not null then
    revoke execute on function public.st_estimatedextent(text, text) from anon, authenticated;
    revoke execute on function public.st_estimatedextent(text, text, text) from anon, authenticated;
    revoke execute on function public.st_estimatedextent(text, text, text, boolean) from anon, authenticated;
  end if;
  if to_regclass('public.spatial_ref_sys') is not null then
    revoke select on public.spatial_ref_sys from anon, authenticated;
  end if;
end $$;

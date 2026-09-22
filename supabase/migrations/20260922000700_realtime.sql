-- Turn the live updates on.
--
-- src/data/supabase.ts subscribes to postgres_changes on three tables and bumps a tick
-- that every screen refetches from. On the live project `supabase_realtime` had no tables
-- in it at all, so that channel could never fire: a request arriving, a message, a parent's
-- approval -- none of it reached a screen that was already open. The app looked like it
-- worked because every screen also refetches on focus and on pull-to-refresh, which is
-- exactly why nobody noticed.
--
-- Same shape of bug as the execute grants in 000600: a thing the code assumes, that the
-- project was never actually told to do.
--
-- Only these three. Realtime respects RLS per subscriber, so a player is streamed only the
-- rows they could have read anyway -- but profiles and profiles_private stay out of it
-- regardless, because the safest row to not broadcast is the one nobody asked for.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['hit_requests', 'hit_messages', 'hit_guardian_approvals'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'app' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table app.%I', t);
    end if;
  end loop;
end;
$$;

-- Row Level Security for profiles, guardians, blocks, markets and courts.
--
-- Safety rules live here, in the database, rather than in React components. A
-- visibility bug in a component is a bad day; a visibility bug that lets an adult
-- enumerate minors is the end of the product. The client cannot query around these
-- policies whatever the app code does.

alter table app.profiles          enable row level security;
alter table app.profiles_private  enable row level security;
alter table app.guardian_links    enable row level security;
alter table app.blocks            enable row level security;
alter table app.markets           enable row level security;
alter table app.market_cohorts    enable row level security;
alter table app.courts            enable row level security;

grant select, insert, update on app.profiles to authenticated;
grant select, insert, delete on app.blocks to authenticated;
grant select, insert on app.guardian_links to authenticated;
grant update on app.guardian_links to authenticated;
grant select on app.markets, app.market_cohorts, app.courts to authenticated;

-- profiles ---------------------------------------------------------------------------

create policy profiles_select_self on app.profiles
  for select to authenticated
  using (id = app.uid());

create policy profiles_select_guardian on app.profiles
  for select to authenticated
  using (app.is_guardian_of(id));

-- The separation rule reaches the client here, and only here.
create policy profiles_select_peers on app.profiles
  for select to authenticated
  using (app.can_view_profile(id));

create policy profiles_insert_self on app.profiles
  for insert to authenticated
  with check (id = app.uid());

create policy profiles_update_self on app.profiles
  for update to authenticated
  using (id = app.uid())
  with check (id = app.uid());

-- profiles_private -------------------------------------------------------------------
--
-- No policies, by design. Combined with the revoked grants in the profiles migration,
-- this table is unreachable from any client role. Writes go through the RPC in the
-- discovery migration, which is SECURITY DEFINER and never returns the exact point.

-- guardian_links ---------------------------------------------------------------------

create policy guardian_links_select_minor on app.guardian_links
  for select to authenticated
  using (minor_profile_id = app.uid());

create policy guardian_links_select_guardian on app.guardian_links
  for select to authenticated
  using (guardian_user_id = app.uid());

-- A minor may invite a guardian; they may not verify one. verified_at is set by the
-- guardian's own confirmation flow (service_role), so a kid cannot self-approve by
-- inviting an address they control and marking it done.
create policy guardian_links_insert_minor on app.guardian_links
  for insert to authenticated
  with check (minor_profile_id = app.uid() and verified_at is null and guardian_user_id is null);

-- Guardians may revoke their own link at any time.
create policy guardian_links_update_guardian on app.guardian_links
  for update to authenticated
  using (guardian_user_id = app.uid())
  with check (guardian_user_id = app.uid());

create or replace function app.guard_guardian_links()
returns trigger
language plpgsql
as $$
begin
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'guardian_links') then
    return new;
  end if;
  if new.verified_at is distinct from old.verified_at
     or new.guardian_user_id is distinct from old.guardian_user_id
     or new.minor_profile_id is distinct from old.minor_profile_id then
    raise exception 'guardian verification is server-owned';
  end if;
  return new;
end;
$$;

create trigger guardian_links_guard
  before update on app.guardian_links
  for each row execute function app.guard_guardian_links();

-- blocks -----------------------------------------------------------------------------
--
-- Deliberately NOT gated on can_view_profile: you must always be able to block someone,
-- including someone you can no longer see, and including from inside a thread.

create policy blocks_select_own on app.blocks
  for select to authenticated
  using (blocker_id = app.uid() or blocked_id = app.uid());

create policy blocks_insert_own on app.blocks
  for insert to authenticated
  with check (blocker_id = app.uid());

create policy blocks_delete_own on app.blocks
  for delete to authenticated
  using (blocker_id = app.uid());

-- markets / cohorts / courts ---------------------------------------------------------

create policy markets_select_all on app.markets
  for select to authenticated using (true);

create policy market_cohorts_select_all on app.market_cohorts
  for select to authenticated using (true);

-- Minors only ever see public and club courts. Private courts are a v2 problem with
-- their own review; nothing in v1 may reference one.
create policy courts_select_directory on app.courts
  for select to authenticated
  using (
    is_active
    and access <> 'private'
    and (app.profile_band(app.uid()) = 'adult' or access in ('public', 'club'))
  );

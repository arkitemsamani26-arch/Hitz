-- UTR linking. The verified rating only ever arrives through the utr-link edge function
-- (service role), which completes the Engage API OAuth exchange and calls this. Clients
-- cannot call it -- that is what keeps the "UTR verified" badge worth something.
create table app.utr_links (
  profile_id     uuid primary key references app.profiles(id) on delete cascade,
  utr_player_id  text not null,
  rating         numeric(4,2),
  rating_status  text,                 -- 'rated' | 'projected' | 'unrated' as UTR reports it
  access_token   text,                 -- refreshable; never leaves the server
  refresh_token  text,
  linked_at      timestamptz not null default now(),
  synced_at      timestamptz not null default now()
);
alter table app.utr_links enable row level security;     -- service_role only
revoke all on app.utr_links from public;

create or replace function app.apply_utr(p_profile uuid, p_player_id text, p_rating numeric, p_status text, p_access text, p_refresh text)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  insert into app.utr_links (profile_id, utr_player_id, rating, rating_status, access_token, refresh_token)
  values (p_profile, p_player_id, p_rating, p_status, p_access, p_refresh)
  on conflict (profile_id) do update set utr_player_id = excluded.utr_player_id, rating = excluded.rating,
    rating_status = excluded.rating_status, access_token = excluded.access_token, refresh_token = excluded.refresh_token, synced_at = now();
  -- A rated player gets the verified level; a projected/unrated one keeps their own number
  -- but is still marked as linked.
  update app.profiles
     set utr_player_id = p_player_id,
         utr_verified_at = now(),
         level_value = case when p_status = 'rated' and p_rating is not null then p_rating else level_value end,
         level_source = case when p_status = 'rated' and p_rating is not null then 'utr_verified'::app.level_source else level_source end
   where id = p_profile;
end; $$;
revoke execute on function app.apply_utr(uuid, text, numeric, text, text, text) from public, anon, authenticated;

-- One-time state for the OAuth round trip, so the callback can be tied to a user.
create table app.utr_oauth_states (
  state       text primary key,
  profile_id  uuid not null references app.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table app.utr_oauth_states enable row level security;
create or replace function app.begin_utr_link()
returns text language plpgsql security definer set search_path = app, public as $$
declare st text;
begin
  if app.uid() is null then raise exception 'sign in first'; end if;
  st := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into app.utr_oauth_states (state, profile_id) values (st, app.uid());
  delete from app.utr_oauth_states where created_at < now() - interval '1 hour';
  return st;
end; $$;
grant execute on function app.begin_utr_link() to authenticated;

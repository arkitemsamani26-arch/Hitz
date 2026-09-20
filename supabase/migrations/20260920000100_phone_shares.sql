-- Sharing your number for a hit.
--
-- Numbers are never shown by default. Once a hit is confirmed, either player can choose
-- to share theirs for that hit -- one tap, per hit, revocable. The other player sees it
-- only while it is shared and only on that hit. A linked parent sees when their child
-- shares, and what number the other player shared.

create table app.phone_shares (
  hit_request_id uuid not null references app.hit_requests(id) on delete cascade,
  profile_id     uuid not null references app.profiles(id) on delete cascade,
  shared_at      timestamptz not null default now(),
  revoked_at     timestamptz,
  primary key (hit_request_id, profile_id)
);
alter table app.phone_shares enable row level security;
grant select on app.phone_shares to authenticated;
create policy phone_shares_select on app.phone_shares for select to authenticated
  using (app.is_hit_participant(hit_request_id) or app.is_hit_guardian(hit_request_id));

-- The player's own number, from the auth record, kept in the private table.
create or replace function app.stamp_phone_verified() returns void
language plpgsql security definer set search_path = app, public, auth as $$
begin
  update app.profiles p set phone_verified_at = coalesce(p.phone_verified_at, u.phone_confirmed_at, now())
    from auth.users u where p.id = app.uid() and u.id = p.id and u.phone is not null;
  insert into app.profiles_private (profile_id, phone)
  select u.id, u.phone from auth.users u where u.id = app.uid() and u.phone is not null
  on conflict (profile_id) do update set phone = coalesce(app.profiles_private.phone, excluded.phone), updated_at = now();
end; $$;

create or replace function app.share_my_phone(p_hit uuid, p_share boolean)
returns void language plpgsql security definer set search_path = app, public as $$
declare st app.hit_state;
begin
  select state into st from app.hit_requests where id = p_hit and app.uid() in (from_profile_id, to_profile_id);
  if st is null then raise exception 'not your hit'; end if;
  if p_share then
    if st not in ('confirmed', 'completed') then raise exception 'You can share your number once the hit is confirmed.'; end if;
    insert into app.phone_shares (hit_request_id, profile_id) values (p_hit, app.uid())
    on conflict (hit_request_id, profile_id) do update set shared_at = now(), revoked_at = null;
  else
    update app.phone_shares set revoked_at = now() where hit_request_id = p_hit and profile_id = app.uid();
  end if;
end; $$;
grant execute on function app.share_my_phone(uuid, boolean) to authenticated;

-- The other player's number, if and only if they shared it for this hit. A guardian of a
-- participant may read it too (they see everything their child sees).
create or replace function app.shared_phone(p_hit uuid)
returns table (profile_id uuid, phone text, mine boolean)
language sql stable security definer set search_path = app, public as $$
  select s.profile_id, pp.phone::text, s.profile_id = app.uid()
    from app.phone_shares s
    join app.hit_requests h on h.id = s.hit_request_id
    join app.profiles_private pp on pp.profile_id = s.profile_id
   where s.hit_request_id = p_hit
     and s.revoked_at is null
     and h.state in ('confirmed', 'completed')
     and (app.uid() in (h.from_profile_id, h.to_profile_id) or app.is_hit_guardian(p_hit));
$$;
grant execute on function app.shared_phone(uuid) to authenticated;

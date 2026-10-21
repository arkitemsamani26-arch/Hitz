-- Parent-run accounts.
--
-- A parent can set Hits up for their kid instead of the kid signing up themselves: the
-- parent signs in with their own number, adds the child, and then uses the app *as* that
-- child, switching between "me" and each child. Under 13 this is the only way in.
--
-- How the database knows who "you" are:
--
--   * Every rule in this schema asks app.uid() who the player is. Until now that was
--     simply the signed-in user. It now resolves, in order:
--       1. an `x-hits-as` request header naming a child profile the signed-in user runs
--          (profiles.managed_by), checked on every call, refused for anyone else;
--       2. a login that was handed over to a child (profile_logins), so a kid who later
--          gets their own sign-in keeps the profile, history and entries they had;
--       3. the signed-in user, as before.
--   * Being a parent is about the person holding the phone, not the profile they are
--     acting as. Every guardian check now asks auth.uid() directly, so a parent can
--     approve a hit or a coach while switched to their child.
--
-- A child the parent runs is a minor like any other: same band, same age rule, same
-- discovery, same guardian approval. The parent is that child's verified guardian (a
-- guardian_links row written here), and when the parent sends or accepts a hit *as* the
-- child, that counts as their approval for that child, at that court and time. A counter
-- clears it, exactly as a counter clears an ordinary approval.

-- Who runs a profile. Null for everyone who signed up themselves. Not readable by other
-- players (no column grant) and not writable by any client (trigger below). Deleting the
-- parent's login removes the children they run with it.
alter table app.profiles add column if not exists managed_by uuid references auth.users(id) on delete cascade;
create index if not exists profiles_managed_by_idx on app.profiles (managed_by) where managed_by is not null;

-- A child who was run by a parent and later got their own sign-in. Their login maps to
-- the profile they already had, which keeps its id (and so every hit, message and entry
-- that points at it).
create table if not exists app.profile_logins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  profile_id  uuid not null unique references app.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table app.profile_logins enable row level security;
revoke all on app.profile_logins from public, anon, authenticated;

-- A parent handing a child their own sign-in. The phone is the child's; the child proves
-- it by signing in with the code texted to it, then the profile moves to that login.
create table if not exists app.handoffs (
  child_id    uuid primary key references app.profiles(id) on delete cascade,
  phone       text not null check (phone ~ '^[0-9]{10,15}$'),
  started_by  uuid not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '7 days',
  claimed_at  timestamptz,
  claimed_by  uuid
);
alter table app.handoffs enable row level security;
revoke all on app.handoffs from public, anon, authenticated;

-- Push tokens by login. A parent who does not play has no profile, so a token keyed on
-- the profile had nowhere to live and their pushes went nowhere. The notify function
-- reads this first and falls back to the old per-profile column.
create table if not exists app.device_tokens (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  push_token  text not null,
  updated_at  timestamptz not null default now()
);
alter table app.device_tokens enable row level security;
revoke all on app.device_tokens from public, anon, authenticated;
-- The notify function reads tokens and clears the ones Expo says are dead.
grant select, delete on app.device_tokens to service_role;

-- 1. Who "you" are --------------------------------------------------------------------

create or replace function app.uid()
returns uuid
language plpgsql
stable
security definer
set search_path = app, public, auth
as $$
declare
  v_real uuid := auth.uid();
  v_hdr  text;
  v_as   uuid;
begin
  if v_real is null then
    return null;
  end if;
  v_hdr := nullif(current_setting('request.headers', true), '')::json ->> 'x-hits-as';
  if v_hdr is not null and v_hdr <> '' then
    if v_hdr !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'not an account you run' using errcode = '42501';
    end if;
    v_as := v_hdr::uuid;
    if v_as = v_real then
      return v_real;
    end if;
    if exists (select 1 from app.profiles p
                where p.id = v_as and p.managed_by = v_real and p.status = 'active') then
      return v_as;
    end if;
    raise exception 'not an account you run' using errcode = '42501';
  end if;
  return coalesce((select l.profile_id from app.profile_logins l where l.user_id = v_real), v_real);
end;
$$;

revoke execute on function app.uid() from public, anon;
grant execute on function app.uid() to authenticated, service_role;

-- Is this a child the signed-in parent runs?
create or replace function app.run_by_me(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select auth.uid() is not null and exists (
    select 1 from app.profiles p
     where p.id = p_profile and p.managed_by = auth.uid() and p.status = 'active'
  );
$$;
revoke execute on function app.run_by_me(uuid) from public, anon;
grant execute on function app.run_by_me(uuid) to authenticated;

-- 2. Being a parent is about the login ---------------------------------------------------

create or replace function app.is_guardian_of(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select auth.uid() is not null and exists (
    select 1 from app.guardian_links g
     where g.minor_profile_id = p_profile
       and g.guardian_user_id = auth.uid()
       and g.verified_at is not null
       and g.revoked_at is null
  );
$$;

create or replace function app.is_hit_counterparty_for_my_child(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select auth.uid() is not null and exists (
    select 1
      from app.hit_requests h
      join app.guardian_links g
        on g.guardian_user_id = auth.uid()
       and g.verified_at is not null
       and g.revoked_at is null
       and g.minor_profile_id in (h.from_profile_id, h.to_profile_id)
     where p_profile in (h.from_profile_id, h.to_profile_id)
       and p_profile <> g.minor_profile_id
       and h.state in ('pending', 'countered', 'accepted', 'confirmed', 'completed')
  );
$$;

create or replace function app.accept_guardian_link(p_link uuid)
returns void
language plpgsql
security definer
set search_path = app, public, auth
as $$
declare u_email text;
begin
  select lower(email) into u_email from auth.users where id = auth.uid();
  if u_email is null then raise exception 'sign in first'; end if;
  update app.guardian_links
     set guardian_user_id = auth.uid(), verified_at = coalesce(verified_at, now()), opened_at = coalesce(opened_at, now())
   where id = p_link and revoked_at is null and lower(guardian_email::text) = u_email;
  if not found then raise exception 'This link was sent to a different email address.'; end if;
end; $$;

-- A parent cannot walk away from a child they run by revoking the link: that would leave
-- a junior with nobody responsible for them. Removing the child is the way out.
create or replace function app.revoke_guardian_link(p_link uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare child uuid;
begin
  select minor_profile_id into child from app.guardian_links
   where id = p_link and guardian_user_id = auth.uid() and revoked_at is null;
  if child is null then raise exception 'not your link'; end if;
  if exists (select 1 from app.profiles where id = child and managed_by = auth.uid()) then
    raise exception 'You run this account. Remove the child instead.';
  end if;
  update app.guardian_links set revoked_at = now() where id = p_link;
  update app.hit_requests set state = 'cancelled', awaiting_profile_id = null
   where (from_profile_id = child or to_profile_id = child)
     and state in ('pending', 'countered', 'accepted', 'confirmed');
end; $$;

alter policy guardian_links_select_guardian on app.guardian_links
  using (guardian_user_id = auth.uid());
alter policy guardian_links_update_guardian on app.guardian_links
  using (guardian_user_id = auth.uid()) with check (guardian_user_id = auth.uid());
alter policy hit_guardian_approvals_select on app.hit_guardian_approvals
  using (guardian_user_id = auth.uid() or minor_profile_id = app.uid() or app.is_hit_participant(hit_request_id));
alter policy hit_guardian_approvals_update on app.hit_guardian_approvals
  using (guardian_user_id = auth.uid() and app.is_guardian_of(minor_profile_id))
  with check (guardian_user_id = auth.uid() and app.is_guardian_of(minor_profile_id));

-- Plus is bought by the login, never while switched to a child. A parent's Plus already
-- covers their children through the guardian link (app.is_plus).
create or replace function app.begin_purchase()
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if app.uid() is distinct from auth.uid() and app.run_by_me(app.uid()) then
    raise exception 'Switch back to yourself to buy Plus. It covers every child you run.';
  end if;
  if exists (select 1 from app.profiles where id = app.uid() and adult_at > current_date) then
    raise exception 'Your parent buys Plus for you. Ask them from Profile.';
  end if;
  return auth.uid();
end;
$$;

-- 3. Photos a parent adds for a child they run need no second approval -----------------

create or replace function app.set_my_photo(p_url text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if p_url is null then
    update app.profiles set photo_url = null, photo_pending_url = null where id = app.uid();
  elsif app.profile_band(app.uid()) = 'minor' and not app.run_by_me(app.uid()) then
    update app.profiles set photo_pending_url = p_url where id = app.uid();
  else
    update app.profiles set photo_url = p_url, photo_pending_url = null where id = app.uid();
  end if;
end; $$;

create or replace function app.set_my_action_photo(p_url text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if p_url is not null and not app.is_plus(app.uid()) then
    raise exception 'plus_required:card An action photo is part of Plus.';
  end if;
  if p_url is null then
    update app.profiles set action_photo_url = null, action_photo_pending_url = null where id = app.uid();
  elsif app.profile_band(app.uid()) = 'minor' and not app.run_by_me(app.uid()) then
    update app.profiles set action_photo_pending_url = p_url where id = app.uid();
  else
    update app.profiles set action_photo_url = p_url, action_photo_pending_url = null where id = app.uid();
  end if;
end;
$$;

-- 4. Who may sign up themselves, and who may change who runs a profile -----------------

create or replace function app.guard_self_signup()
returns trigger
language plpgsql
set search_path = app, public
as $$
begin
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'profiles') then
    return new;
  end if;
  if new.date_of_birth > (current_date - interval '13 years')::date then
    raise exception 'under_13: Under 13, a parent sets up the account. Ask them to sign in and choose "This is for my kid".'
      using errcode = '42501';
  end if;
  new.managed_by := null;
  return new;
end;
$$;

create or replace trigger profiles_self_signup
  before insert on app.profiles
  for each row execute function app.guard_self_signup();

create or replace function app.guard_managed_by()
returns trigger
language plpgsql
set search_path = app, public
as $$
begin
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'profiles') then
    return new;
  end if;
  if new.managed_by is distinct from old.managed_by then
    raise exception 'who runs an account is not changed from the app';
  end if;
  return new;
end;
$$;

create or replace trigger profiles_managed_by_guard
  before update on app.profiles
  for each row execute function app.guard_managed_by();

-- 5. Adding a child ------------------------------------------------------------------------

create or replace function app.add_child(
  p_name text, p_last_initial text, p_dob date, p_level numeric, p_level_source app.level_source,
  p_court uuid, p_availability int, p_format text default 'either')
returns uuid
language plpgsql
security definer
set search_path = app, public, auth
as $$
declare
  v_real   uuid := auth.uid();
  v_name   text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_market uuid;
  v_email  text;
  v_phone  text;
  v_id     uuid := gen_random_uuid();
  v_age    int;
begin
  if v_real is null then raise exception 'sign in first'; end if;
  if app.uid() is distinct from (select coalesce((select l.profile_id from app.profile_logins l where l.user_id = v_real), v_real)) then
    raise exception 'Switch back to yourself to add a child.';
  end if;
  if exists (select 1 from app.profiles where id = app.uid() and adult_at > current_date) then
    raise exception 'A parent adds a child. Ask yours to set this up.';
  end if;
  if (select count(*) from app.profiles where managed_by = v_real and status = 'active') >= 6 then
    raise exception 'That is six children already. Write to us if you need more.';
  end if;
  if length(v_name) < 1 or length(v_name) > 40 then raise exception 'Add their first name.'; end if;
  if p_last_initial is not null and p_last_initial !~ '^[A-Za-z]$' then raise exception 'One letter for the last initial.'; end if;
  if p_dob is null then raise exception 'Add their birthday.'; end if;
  v_age := extract(year from age(current_date, p_dob))::int;
  if v_age >= 18 then raise exception 'Someone who is 18 signs up themselves.'; end if;
  if v_age < 4 then raise exception 'Check the birthday. Hits is for kids four and up.'; end if;
  if p_format is not null and p_format not in ('singles', 'doubles', 'either') then raise exception 'singles, doubles or either'; end if;

  select c.market_id into v_market from app.courts c where c.id = p_court;
  if v_market is null then
    select market_id into v_market from app.profiles where id = app.uid();
  end if;
  if v_market is null then
    select id into v_market from app.markets order by created_at limit 1;
  end if;

  select email, phone into v_email, v_phone from auth.users where id = v_real;

  insert into app.profiles
    (id, market_id, display_name, last_initial, date_of_birth, level_value, level_source,
     home_court_id, availability_mask, play_format, phone_verified_at, managed_by)
  values
    (v_id, v_market, v_name, upper(p_last_initial), p_dob, p_level, p_level_source,
     p_court, coalesce(p_availability, 0), coalesce(p_format, 'either'), now(), v_real);

  -- The parent is the child's verified guardian from the start. A parent who signed in
  -- by phone may have no email; the placeholder is on a reserved domain nothing delivers to.
  insert into app.guardian_links
    (minor_profile_id, guardian_user_id, guardian_email, guardian_phone, relationship, verified_at, opened_at)
  values
    (v_id, v_real, coalesce(nullif(v_email, ''), 'parent-' || v_real || '@hits.invalid'), v_phone, 'parent', now(), now());

  return v_id;
end;
$$;

revoke execute on function app.add_child(text, text, date, numeric, app.level_source, uuid, int, text) from public, anon;
grant execute on function app.add_child(text, text, date, numeric, app.level_source, uuid, int, text) to authenticated;

-- The children this login runs, for the switcher.
create or replace function app.my_run_children()
returns table (id uuid, display_name text, last_initial text, photo_url text, age int,
               handoff_phone_last4 text, handoff_expires_at timestamptz)
language sql
stable
security definer
set search_path = app, public
as $$
  select p.id, p.display_name, p.last_initial, p.photo_url,
         extract(year from age(current_date, p.date_of_birth))::int,
         case when h.claimed_at is null and h.expires_at > now() then right(h.phone, 4) end,
         case when h.claimed_at is null and h.expires_at > now() then h.expires_at end
    from app.profiles p
    left join app.handoffs h on h.child_id = p.id
   where p.managed_by = auth.uid() and p.status = 'active'
   order by p.date_of_birth desc;
$$;
revoke execute on function app.my_run_children() from public, anon;
grant execute on function app.my_run_children() to authenticated;

-- Which of these players does a parent run? Shown in a conversation so the other side
-- knows who is typing. Only for players the caller can already see or has a hit with.
create or replace function app.parent_run(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select p.id from app.profiles p
   where p.id = any(p_ids) and p.managed_by is not null
     and (app.can_view_profile(p.id)
          or exists (select 1 from app.hit_requests h
                      where app.uid() in (h.from_profile_id, h.to_profile_id)
                        and p.id in (h.from_profile_id, h.to_profile_id))
          or app.is_guardian_of(p.id));
$$;
revoke execute on function app.parent_run(uuid[]) from public, anon;
grant execute on function app.parent_run(uuid[]) to authenticated;

-- 6. A child gets their own sign-in ---------------------------------------------------

create or replace function app.start_handoff(p_child uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_dob date;
begin
  if not app.run_by_me(p_child) then raise exception 'not an account you run'; end if;
  select date_of_birth into v_dob from app.profiles where id = p_child;
  if v_dob > (current_date - interval '13 years')::date then
    raise exception 'Kids get their own sign-in from 13.';
  end if;
  if length(v_digits) = 10 then v_digits := '1' || v_digits; end if;
  if length(v_digits) < 11 or length(v_digits) > 15 then raise exception 'That number does not look complete.'; end if;
  insert into app.handoffs (child_id, phone, started_by)
  values (p_child, v_digits, auth.uid())
  on conflict (child_id) do update
     set phone = excluded.phone, started_by = excluded.started_by, created_at = now(),
         expires_at = now() + interval '7 days', claimed_at = null, claimed_by = null;
end;
$$;

create or replace function app.cancel_handoff(p_child uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not app.run_by_me(p_child) then raise exception 'not an account you run'; end if;
  update app.handoffs set expires_at = now() where child_id = p_child and claimed_at is null;
end;
$$;

-- Called by the app right after a new sign-in that has no profile. If a parent started a
-- handoff to this number, the profile becomes this login's, and the parent stays on as
-- the verified guardian (approvals, family view) but no longer runs the account.
create or replace function app.claim_handoff()
returns uuid
language plpgsql
security definer
set search_path = app, public, auth
as $$
declare
  v_real  uuid := auth.uid();
  v_phone text;
  h       app.handoffs%rowtype;
  v_name  text;
begin
  if v_real is null then return null; end if;
  if exists (select 1 from app.profiles where id = v_real)
     or exists (select 1 from app.profile_logins where user_id = v_real) then
    return null;
  end if;
  select regexp_replace(coalesce(phone, ''), '\D', '', 'g') into v_phone from auth.users where id = v_real;
  if v_phone is null or v_phone = '' then return null; end if;
  select * into h from app.handoffs
   where phone = v_phone and claimed_at is null and expires_at > now()
   order by created_at desc limit 1;
  if h.child_id is null then return null; end if;
  if not exists (select 1 from app.profiles where id = h.child_id and managed_by is not null and status = 'active') then
    return null;
  end if;

  insert into app.profile_logins (user_id, profile_id) values (v_real, h.child_id);
  update app.profiles set managed_by = null, phone_verified_at = now() where id = h.child_id
  returning display_name into v_name;
  insert into app.profiles_private (profile_id, phone) values (h.child_id, '+' || v_phone)
  on conflict (profile_id) do update set phone = excluded.phone, updated_at = now();
  update app.handoffs set claimed_at = now(), claimed_by = v_real where child_id = h.child_id;

  perform app.enqueue(h.started_by, 'handoff', v_name || ' is signed in on their own phone',
                      'You are still their parent: you approve their hits and see their week.',
                      jsonb_build_object('family', true));
  return h.child_id;
end;
$$;

revoke execute on function app.start_handoff(uuid, text), app.cancel_handoff(uuid), app.claim_handoff() from public, anon;
grant execute on function app.start_handoff(uuid, text), app.cancel_handoff(uuid), app.claim_handoff() to authenticated;

-- 7. Pushes for a child a parent runs go to the parent ---------------------------------

create or replace function app.enqueue(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void
language sql
set search_path = app, public
as $$
  insert into app.notifications (user_id, kind, title, body, data)
  select coalesce(p.managed_by, p_user),
         p_kind,
         case when p.managed_by is not null then p.display_name || ': ' || p_title else p_title end,
         p_body,
         case when p.managed_by is not null then coalesce(p_data, '{}'::jsonb) || jsonb_build_object('as', p.id) else p_data end
    from (select p_user as u) x
    left join app.profiles p on p.id = x.u and p.managed_by is not null;
$$;

create or replace function app.set_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into app.device_tokens (user_id, push_token) values (auth.uid(), p_token)
  on conflict (user_id) do update set push_token = excluded.push_token, updated_at = now();
  -- The older per-profile column, for a login that has its own profile.
  if exists (select 1 from app.profiles where id = auth.uid()) then
    insert into app.profiles_private (profile_id, push_token) values (auth.uid(), p_token)
    on conflict (profile_id) do update set push_token = excluded.push_token, updated_at = now();
  end if;
end; $$;

-- 8. A parent sending or accepting as their child is the parent's approval -------------

alter table app.hit_requests add column if not exists owner_approved uuid[] not null default '{}';

create or replace function app.track_owner_approval()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_me uuid := app.uid();
  v_acting_owned boolean := v_me is not null and v_me in (new.from_profile_id, new.to_profile_id) and app.run_by_me(v_me);
begin
  if tg_op = 'INSERT' then
    new.owner_approved := case when v_acting_owned and v_me = new.from_profile_id then array[v_me] else '{}'::uuid[] end;
    return new;
  end if;
  -- Never taken from the client.
  new.owner_approved := old.owner_approved;
  -- A new court or time is a new hit to approve, for every family.
  if new.court_id is distinct from old.court_id
     or new.window_start is distinct from old.window_start
     or new.window_end is distinct from old.window_end then
    new.owner_approved := '{}';
  end if;
  -- Proposing the new time, or saying yes, is the parent's own decision.
  if v_acting_owned
     and ((new.state = 'accepted' and old.state is distinct from 'accepted')
          or (new.state = 'countered' and (new.window_start is distinct from old.window_start
                                            or new.court_id is distinct from old.court_id))
          or (new.state = 'pending' and v_me = new.from_profile_id))
     and not (v_me = any(new.owner_approved)) then
    new.owner_approved := new.owner_approved || v_me;
  end if;
  return new;
end;
$$;

create or replace trigger hit_requests_track_owner_approval
  before insert or update on app.hit_requests
  for each row execute function app.track_owner_approval();

-- Runs after the approval rows are seeded (trigger names sort: seed_approvals, then this).
create or replace function app.apply_owner_approval()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if coalesce(array_length(new.owner_approved, 1), 0) = 0 then
    return null;
  end if;
  update app.hit_guardian_approvals a
     set decision = true
    from app.profiles p
   where a.hit_request_id = new.id
     and a.minor_profile_id = p.id
     and p.id = any(new.owner_approved)
     and p.managed_by = a.guardian_user_id
     and a.decision is null;
  return null;
end;
$$;

create or replace trigger hit_requests_seed_owner_approval
  after update on app.hit_requests
  for each row execute function app.apply_owner_approval();

revoke execute on function app.track_owner_approval(), app.apply_owner_approval(),
  app.guard_self_signup(), app.guard_managed_by() from public, anon, authenticated;

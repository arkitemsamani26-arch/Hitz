-- Profiles, and the strict split between public profile data and private data.
--
-- The single most important rule in this file: exact coordinates, phone numbers and
-- email addresses live in app.profiles_private, which has NO grants to anon or
-- authenticated. Not "protected by a policy" -- unreachable, because the privilege to
-- read the column was never granted to the role. A policy bug is a bad day; an exposed
-- minor's home location is the end of the product.

create table app.profiles (
  id                  uuid primary key,                -- = auth.users.id
  market_id           uuid references app.markets(id) on delete restrict,

  display_name        text not null,
  last_initial        text check (last_initial ~ '^[A-Za-z]$'),
  photo_url           text,

  -- Collected once at signup, not user-editable afterwards (enforced by trigger below).
  date_of_birth       date not null,
  -- Generated, so "is this user a minor" can never be a client-supplied field and can
  -- never go stale: the row ages into adulthood on its own, no nightly job.
  adult_at            date generated always as ((date_of_birth + interval '18 years')::date) stored,

  level_value         app.level_value,
  level_source        app.level_source,

  home_court_id       uuid references app.courts(id) on delete set null,
  availability_mask   app.availability_mask not null default 0,

  -- Ghost suppression (v1, not v2). A feed full of people who signed up in March and
  -- never came back is worse than a small feed, and response-rate visibility is a trust
  -- feature, so it is free and on by default rather than behind a paywall.
  last_active_at      timestamptz not null default now(),
  looking_to_hit_until timestamptz,                    -- expiring "free this week" status
  requests_received   int not null default 0,
  requests_responded  int not null default 0,
  requests_accepted   int not null default 0,
  hits_confirmed      int not null default 0,
  median_response_minutes int,

  phone_verified_at   timestamptz,
  utr_verified_at     timestamptz,
  utr_player_id       text unique,

  -- Approximate location only. Snapped to a coarse grid by trigger; the exact point it
  -- was derived from is in profiles_private and never leaves the server.
  snapped_point       geography(Point, 4326),

  status              app.profile_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index profiles_snapped_point_idx on app.profiles using gist (snapped_point);
create index profiles_level_idx on app.profiles (level_value);
create index profiles_market_idx on app.profiles (market_id);
-- Supports the separation rule's band predicate without a function call per row.
create index profiles_adult_at_idx on app.profiles (adult_at);

create table app.profiles_private (
  profile_id  uuid primary key references app.profiles(id) on delete cascade,
  exact_point geography(Point, 4326),
  phone       text,
  email       citext,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The load-bearing line. No policy can accidentally re-expose what was never granted.
revoke all on app.profiles_private from public;

comment on table app.profiles_private is
  'Never granted to anon/authenticated. Reachable only via SECURITY DEFINER functions.';

-- Location snapping -----------------------------------------------------------------
--
-- ~0.02 degrees is roughly 2.2km of latitude and ~1.6km of longitude at Boston's
-- latitude. Enough to say "this player is around here" and not enough to say "this
-- player lives there".
create or replace function app.snap_point(p geography)
returns geography
language sql
immutable
as $$
  select case
    when p is null then null
    else ST_SnapToGrid(p::geometry, 0.02)::geography
  end;
$$;

create or replace function app.sync_snapped_point()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  update app.profiles
     set snapped_point = app.snap_point(new.exact_point),
         updated_at = now()
   where id = new.profile_id;
  return new;
end;
$$;

create trigger profiles_private_sync_snapped
  after insert or update of exact_point on app.profiles_private
  for each row execute function app.sync_snapped_point();

-- Immutable / privileged columns ------------------------------------------------------
--
-- Date of birth decides which safety regime a user lives under, so it is not something
-- the client gets to change after the fact. Verification timestamps and the derived
-- counters are server-owned for the same reason: a self-awarded "UTR verified" badge
-- would make every other badge meaningless.
create or replace function app.guard_profile_columns()
returns trigger
language plpgsql
as $$
begin
  -- Server-side paths bypass: SECURITY DEFINER functions run as the table owner, and
  -- service_role is the backend. Everything else is a client and is held to the rules.
  if current_user = 'service_role'
     or current_user = (select tableowner from pg_tables
                         where schemaname = 'app' and tablename = 'profiles') then
    return new;
  end if;

  if new.date_of_birth is distinct from old.date_of_birth then
    raise exception 'date_of_birth cannot be changed after signup (support review required)';
  end if;
  if new.phone_verified_at is distinct from old.phone_verified_at
     or new.utr_verified_at is distinct from old.utr_verified_at
     or new.utr_player_id is distinct from old.utr_player_id then
    raise exception 'verification fields are server-owned';
  end if;
  if new.hits_confirmed is distinct from old.hits_confirmed
     or new.requests_received is distinct from old.requests_received
     or new.requests_responded is distinct from old.requests_responded
     or new.requests_accepted is distinct from old.requests_accepted then
    raise exception 'reputation counters are server-owned';
  end if;
  if new.level_source = 'utr_verified' and old.level_source is distinct from 'utr_verified' then
    raise exception 'utr_verified can only be set by the UTR link flow';
  end if;
  if new.snapped_point is distinct from old.snapped_point then
    raise exception 'snapped_point is derived from profiles_private.exact_point';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_guard_columns
  before update on app.profiles
  for each row execute function app.guard_profile_columns();

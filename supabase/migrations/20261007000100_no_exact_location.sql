-- Not storing the precise location at all
--
-- `set_my_location` wrote the device's coordinates to `profiles_private.exact_point`, and
-- a trigger derived the coarse `snapped_point` from it. The precise point was never
-- granted to any client role and never left the server -- but it was kept forever, and the
-- only thing it was ever used for was to compute the rounded one.
--
-- Data you do not hold cannot leak, cannot be subpoenaed, cannot be exported by mistake,
-- and does not have to be explained in a privacy policy. For an app whose users are
-- fourteen, "we know where you live, we promise not to look" is a worse answer than not
-- knowing. So the rounding moves to the moment of writing: the exact coordinates exist in
-- the request for as long as it takes to round them, and are never stored.
--
-- This is the strongest item on the pre-launch legal checklist (docs/14) and it costs
-- nothing: the snapped point, the distance buckets and the discovery query are unchanged.

-- One thing did read `exact_point` besides the trigger: the home-court rule treats a real
-- device fix as outranking the court you picked, and asked "is there an exact point?" to
-- tell them apart. The answer it actually wanted was "has this player ever shared their
-- location", which is a timestamp, not a coordinate.
alter table app.profiles add column if not exists located_at timestamptz;
comment on column app.profiles.located_at is
  'When the player last shared a device location. The location itself is rounded on arrival '
  'and never stored; this only records that it happened, so a home court does not override it.';

-- The function snaps on the way in. SECURITY DEFINER runs as the table owner, which is one
-- of the two roles `guard_profile_columns` lets through, so it can set the derived column
-- the client still cannot.
create or replace function app.set_my_location(p_lat double precision, p_lon double precision)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if app.uid() is null then
    raise exception 'not authenticated';
  end if;
  update app.profiles
     set snapped_point = app.snap_point(
           ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography),
         located_at = now(),
         updated_at = now()
   where id = app.uid();
end;
$$;

-- The trigger had nothing left to derive from.
drop trigger if exists profiles_private_sync_snapped on app.profiles_private;
drop function if exists app.sync_snapped_point();

-- And the column goes, so it cannot quietly come back. Any precise point already stored
-- is dropped with it.
alter table app.profiles_private drop column if exists exact_point;

create or replace function app.sync_home_court_point()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare v_point geography;
begin
  if new.home_court_id is null then
    return new;
  end if;
  -- A device fix, once given, still outranks the court -- asked of the timestamp now.
  if new.located_at is not null then
    return new;
  end if;
  select c.point into v_point from app.courts c where c.id = new.home_court_id;
  new.snapped_point := app.snap_point(v_point);
  return new;
end;
$$;

-- The guard's message named the column that no longer exists.
create or replace function app.guard_profile_columns()
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
    raise exception 'snapped_point is set by set_my_location, from coordinates we do not keep';
  end if;
  if new.located_at is distinct from old.located_at then
    raise exception 'located_at is server-owned';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

comment on table app.profiles_private is
  'Phone and email only. The precise location this table used to hold was removed in '
  '20261007000100: coordinates are rounded on arrival and the exact point is never stored.';

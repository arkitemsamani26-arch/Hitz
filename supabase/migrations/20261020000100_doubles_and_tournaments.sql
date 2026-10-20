-- Doubles and tournaments (migration 20261020000100).
--
-- Doubles. Every invitation is still a two-person hit: one organizer, one invitee, its own
-- conversation, its own parent approvals. A doubles game is up to three of them from the
-- same organizer sharing a match_id: one partner and two opponents. The new rule is that
-- whoever joins a game has to be someone every other player in it could have invited
-- themselves: same side of 18, nobody blocked, every parent's age rule.
--
-- Tournaments. Players say which tournament they are playing ("Peninsula Junior Open, this
-- weekend, B14 doubles"), and see the others playing it whom they could already find in
-- Discover. Entered by players; nothing here is pulled from USTA or any other organizer.

-- 1 -------------------------------------------------------------------------------------
-- What you are looking for: singles, doubles, or either.
alter table app.profiles
  add column play_format text not null default 'either'
  check (play_format in ('singles', 'doubles', 'either'));

grant select (play_format) on app.profiles to authenticated;

-- Your own row comes through my_profile(), which returns the whole row, so it carries the
-- new column without a change.

-- 2 -------------------------------------------------------------------------------------
-- The pairwise form of the visibility rule. can_view_profile asks it about the caller; a
-- doubles game has to ask it about every pair of players in it.
create or replace function app.pair_ok(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select a is not null and b is not null and a <> b
     and app.is_participating(a)
     and app.is_participating(b)
     and app.same_band(a, b)
     and not app.blocked_between(a, b)
     and app.age_gap_ok(a, b);
$$;

revoke execute on function app.pair_ok(uuid, uuid) from public, anon, authenticated;

-- 3 -------------------------------------------------------------------------------------
create table app.tournaments (
  id          uuid primary key default uuid_generate_v4(),
  market_id   uuid not null references app.markets(id) on delete cascade,
  name        citext not null check (length(name) between 3 and 80),
  starts_on   date not null,
  ends_on     date not null,
  location    text check (location is null or length(location) <= 120),
  url         text check (url is null or (url ~ '^https://' and length(url) <= 300)),
  -- A player or a parent. Not shown to anyone.
  created_by  uuid not null,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on <= starts_on + 14),
  unique (market_id, name, starts_on)
);

create table app.tournament_entries (
  tournament_id uuid not null references app.tournaments(id) on delete cascade,
  player_id     uuid not null references app.profiles(id) on delete cascade,
  division      text check (division is null or length(division) between 1 and 12),
  singles       boolean not null default false,
  doubles       boolean not null default false,
  wants_partner boolean not null default false,
  created_at    timestamptz not null default now(),
  primary key (tournament_id, player_id),
  check (singles or doubles),
  check (not wants_partner or doubles)
);

create index tournament_entries_player_idx on app.tournament_entries (player_id);

alter table app.tournaments enable row level security;
alter table app.tournament_entries enable row level security;
-- No grants: both are reached only through the functions below. Revoked outright, in case
-- the hosted project's default privileges hand new tables to the client roles.
revoke all on app.tournaments, app.tournament_entries from public, anon, authenticated;

alter table app.hit_requests
  add column format        text not null default 'singles' check (format in ('singles', 'doubles')),
  add column match_id      uuid,
  add column doubles_role  text check (doubles_role in ('partner', 'opponent')),
  add column tournament_id uuid references app.tournaments(id) on delete set null;

create index hit_requests_match_idx on app.hit_requests (match_id) where match_id is not null;

-- 4 -------------------------------------------------------------------------------------
-- The doubles rules, checked where the row is written so no client can skip them.
create or replace function app.guard_doubles()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_member uuid;
  v_partners int;
  v_opponents int;
begin
  if tg_op = 'UPDATE' then
    if new.format is distinct from old.format or new.match_id is distinct from old.match_id
       or new.doubles_role is distinct from old.doubles_role
       -- A tournament that is removed lets go of its invitations (on delete set null).
       or (new.tournament_id is distinct from old.tournament_id and new.tournament_id is not null) then
      raise exception 'a hit''s format cannot change once it is sent';
    end if;
    return new;
  end if;

  if new.tournament_id is not null and not exists (select 1 from app.tournaments where id = new.tournament_id) then
    raise exception 'that tournament is not on Hits';
  end if;

  if new.format = 'singles' then
    if new.match_id is not null or new.doubles_role is not null then
      raise exception 'a singles hit has no doubles game';
    end if;
    return new;
  end if;

  new.doubles_role := coalesce(new.doubles_role, 'partner');
  -- The first invitation starts the game; its own id is the game's id.
  if new.match_id is null or new.match_id = new.id then
    new.match_id := new.id;
    return new;
  end if;

  if not exists (select 1 from app.hit_requests where match_id = new.match_id) then
    raise exception 'that doubles game is not on Hits';
  end if;
  if exists (select 1 from app.hit_requests where match_id = new.match_id and from_profile_id <> new.from_profile_id) then
    raise exception 'only the player who set up the doubles game invites the others';
  end if;
  if new.to_profile_id in (select to_profile_id from app.hit_requests
                            where match_id = new.match_id and state in ('pending', 'countered', 'accepted', 'confirmed')) then
    raise exception 'they are already in this game';
  end if;

  select count(*) filter (where doubles_role = 'partner'), count(*) filter (where doubles_role = 'opponent')
    into v_partners, v_opponents
    from app.hit_requests
   where match_id = new.match_id and state in ('pending', 'countered', 'accepted', 'confirmed');
  if new.doubles_role = 'partner' and v_partners >= 1 then
    raise exception 'this game already has a partner';
  end if;
  if new.doubles_role = 'opponent' and v_opponents >= 2 then
    raise exception 'this game already has two opponents';
  end if;

  -- Everyone already in has to be someone the new player could play with.
  for v_member in
    select to_profile_id from app.hit_requests
     where match_id = new.match_id and state in ('pending', 'countered', 'accepted', 'confirmed')
  loop
    if not app.pair_ok(v_member, new.to_profile_id) then
      raise exception 'that player can''t join this doubles game';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function app.guard_doubles() from public, anon, authenticated;

create trigger hit_requests_doubles
  before insert or update on app.hit_requests
  for each row execute function app.guard_doubles();

-- 5 -------------------------------------------------------------------------------------
-- Who is in a doubles game, for the people in it and their parents.
create or replace function app.doubles_match(p_match uuid)
returns table (profile_id uuid, display_name text, last_initial text, photo_url text,
               level_value numeric, level_source app.level_source, age int,
               role text, state app.hit_state, hit_id uuid)
language sql
stable
security definer
set search_path = app, public
as $$
  with rows as (
    select * from app.hit_requests where match_id = p_match
  ),
  allowed as (
    select exists (
      select 1 from rows r
       where app.uid() in (r.from_profile_id, r.to_profile_id)
          or app.is_guardian_of(r.from_profile_id) or app.is_guardian_of(r.to_profile_id)
    ) as ok
  ),
  organizer as (select distinct from_profile_id as id from rows),
  members as (
    select o.id, 'organizer'::text as role, null::app.hit_state as state, null::uuid as hit_id from organizer o
    union all
    select r.to_profile_id, r.doubles_role, r.state, r.id from rows r
     where r.state in ('pending', 'countered', 'accepted', 'confirmed', 'completed')
        or app.uid() = r.from_profile_id
  )
  select p.id, p.display_name, p.last_initial, p.photo_url, p.level_value::numeric, p.level_source,
         case when p.adult_at > current_date then app.age_years(p.date_of_birth) end,
         m.role, m.state,
         case when m.hit_id is not null and exists (
                select 1 from rows r where r.id = m.hit_id
                   and (app.uid() in (r.from_profile_id, r.to_profile_id)
                        or app.is_guardian_of(r.from_profile_id) or app.is_guardian_of(r.to_profile_id)))
              then m.hit_id end
    from members m
    join app.profiles p on p.id = m.id
   cross join allowed
   where allowed.ok
     and (p.id = app.uid() or app.is_guardian_of(p.id) or not app.blocked_between(app.uid(), p.id))
   order by case m.role when 'organizer' then 0 when 'partner' then 1 else 2 end, p.display_name;
$$;

-- 6 -------------------------------------------------------------------------------------
-- Players to ask: for a doubles hit you organize, people every player already in it could
-- play with; otherwise, people you could play with. Closest level to the team first, then
-- the most usual times in common, then whoever said they are looking this week.
create or replace function app.suggest_doubles(p_hit uuid default null, p_role text default 'opponent')
returns table (profile_id uuid, display_name text, last_initial text, photo_url text,
               level_value numeric, level_source app.level_source, age int,
               home_court_id uuid, availability_mask int, looking_to_hit boolean,
               play_format text, common_times int)
language plpgsql
stable
security definer
set search_path = app, public
as $$
#variable_conflict use_column
declare
  v_match uuid;
  v_members uuid[];
begin
  if p_role not in ('partner', 'opponent') then
    raise exception 'partner or opponent';
  end if;
  if p_hit is not null then
    select h.match_id into v_match from app.hit_requests h
     where h.id = p_hit and h.from_profile_id = app.uid() and h.format = 'doubles';
    if v_match is null then
      raise exception 'only the player who set up the doubles game invites the others';
    end if;
    select array_agg(to_profile_id) into v_members from app.hit_requests
     where match_id = v_match and state in ('pending', 'countered', 'accepted', 'confirmed');
  end if;
  v_members := coalesce(v_members, '{}'::uuid[]);

  return query
  with team as (
    select avg(p.level_value) as level, bit_and(p.availability_mask) as mask
      from app.profiles p where p.id = app.uid() or p.id = any(v_members)
  )
  select d.profile_id, d.display_name, d.last_initial, d.photo_url, d.level_value, d.level_source, d.age,
         d.home_court_id, d.availability_mask, d.looking_to_hit, p.play_format,
         length(replace(((d.availability_mask & team.mask)::bit(32))::text, '0', ''))::int
    from app.discover(p_radius_m => 40234, p_limit => 1000) d
    join app.profiles p on p.id = d.profile_id
   cross join team
   where p.play_format in ('doubles', 'either')
     and not d.profile_id = any(v_members)
     and not exists (select 1 from unnest(v_members) m where not app.pair_ok(m, d.profile_id))
   order by abs(coalesce(d.level_value, 0) - coalesce(team.level, 0)),
            length(replace(((d.availability_mask & team.mask)::bit(32))::text, '0', '')) desc,
            d.looking_to_hit desc
   limit 30;
end;
$$;

-- 7 -------------------------------------------------------------------------------------
-- Acting for yourself, or as a parent for your child.
create or replace function app.acting_for(p_child uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = app, public
as $$
#variable_conflict use_column
begin
  if p_child is null or p_child = app.uid() then
    return app.uid();
  end if;
  if not app.is_guardian_of(p_child) then
    raise exception 'only a linked parent can do this for a child';
  end if;
  return p_child;
end;
$$;

revoke execute on function app.acting_for(uuid) from public, anon, authenticated;

create or replace function app.add_tournament(p_name text, p_starts_on date, p_ends_on date,
                                              p_location text default null, p_url text default null,
                                              p_child uuid default null)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_who uuid := app.acting_for(p_child);
  v_market uuid;
  v_id uuid;
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if not app.is_participating(v_who) then
    raise exception 'finish setting up your profile first';
  end if;
  select market_id into v_market from app.profiles where id = v_who;
  if length(v_name) < 3 then raise exception 'give the tournament its name'; end if;
  if p_starts_on is null or p_starts_on < current_date then raise exception 'pick a date that hasn''t passed'; end if;
  if p_starts_on > current_date + 365 then raise exception 'pick a date in the next year'; end if;
  if p_ends_on is null or p_ends_on < p_starts_on or p_ends_on > p_starts_on + 14 then
    raise exception 'the last day has to be on or after the first, within two weeks';
  end if;
  if p_url is not null and btrim(p_url) <> '' and btrim(p_url) !~ '^https://' then
    raise exception 'a link has to start with https://';
  end if;

  select id into v_id from app.tournaments
   where market_id = v_market and name = v_name::citext and starts_on = p_starts_on;
  if v_id is not null then
    return v_id;
  end if;

  if (select count(*) from app.tournaments where created_by = app.uid() and created_at > now() - interval '1 day') >= 10 then
    raise exception 'that''s a lot of tournaments for one day; try again tomorrow';
  end if;

  insert into app.tournaments (market_id, name, starts_on, ends_on, location, url, created_by)
  values (v_market, v_name, p_starts_on, p_ends_on, nullif(btrim(coalesce(p_location, '')), ''),
          nullif(btrim(coalesce(p_url, '')), ''), app.uid())
  on conflict (market_id, name, starts_on) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end;
$$;

-- Tournaments still to play in your area, with your entry and how many players you could
-- already find are playing.
create or replace function app.upcoming_tournaments(p_child uuid default null)
returns table (id uuid, name text, starts_on date, ends_on date, location text, url text,
               entered boolean, division text, singles boolean, doubles boolean, wants_partner boolean,
               players int, partner_seekers int)
language plpgsql
stable
security definer
set search_path = app, public
as $$
#variable_conflict use_column
declare
  v_who uuid := app.acting_for(p_child);
begin
  return query
  select t.id, t.name::text, t.starts_on, t.ends_on, t.location, t.url,
         e.player_id is not null, e.division, coalesce(e.singles, false), coalesce(e.doubles, false), coalesce(e.wants_partner, false),
         (select count(*)::int from app.tournament_entries o
           where o.tournament_id = t.id and app.pair_ok(v_who, o.player_id) and app.cohort_discovery_open(v_who)),
         (select count(*)::int from app.tournament_entries o
           where o.tournament_id = t.id and o.wants_partner and app.pair_ok(v_who, o.player_id) and app.cohort_discovery_open(v_who))
    from app.tournaments t
    left join app.tournament_entries e on e.tournament_id = t.id and e.player_id = v_who
   where t.market_id = (select market_id from app.profiles where id = v_who)
     and t.ends_on >= current_date
   order by t.starts_on, t.name;
end;
$$;

create or replace function app.enter_tournament(p_tournament uuid, p_division text, p_singles boolean,
                                                p_doubles boolean, p_wants_partner boolean,
                                                p_child uuid default null)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_who uuid := app.acting_for(p_child);
  v_division text := nullif(upper(btrim(coalesce(p_division, ''))), '');
begin
  if not app.is_participating(v_who) then
    raise exception 'finish setting up your profile first';
  end if;
  if not exists (select 1 from app.tournaments t join app.profiles p on p.id = v_who
                  where t.id = p_tournament and t.market_id = p.market_id and t.ends_on >= current_date) then
    raise exception 'that tournament is over or not in your area';
  end if;
  if not coalesce(p_singles, false) and not coalesce(p_doubles, false) then
    raise exception 'pick singles, doubles or both';
  end if;
  if v_division is not null and length(v_division) > 12 then
    raise exception 'keep the division short, like B14 or 4.0';
  end if;
  insert into app.tournament_entries (tournament_id, player_id, division, singles, doubles, wants_partner)
  values (p_tournament, v_who, v_division, coalesce(p_singles, false), coalesce(p_doubles, false),
          coalesce(p_doubles, false) and coalesce(p_wants_partner, false))
  on conflict (tournament_id, player_id) do update
    set division = excluded.division, singles = excluded.singles,
        doubles = excluded.doubles, wants_partner = excluded.wants_partner;
end;
$$;

create or replace function app.leave_tournament(p_tournament uuid, p_child uuid default null)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_who uuid := app.acting_for(p_child);
begin
  delete from app.tournament_entries where tournament_id = p_tournament and player_id = v_who;
end;
$$;

-- The other players in a tournament, only those you could already find: your side of 18,
-- nobody blocked, every parent's age rule. Your division and partner seekers first.
create or replace function app.tournament_players(p_tournament uuid, p_child uuid default null)
returns table (profile_id uuid, display_name text, last_initial text, photo_url text,
               level_value numeric, level_source app.level_source, age int,
               division text, singles boolean, doubles boolean, wants_partner boolean,
               same_division boolean, availability_mask int, home_court_id uuid)
language plpgsql
stable
security definer
set search_path = app, public
as $$
#variable_conflict use_column
declare
  v_who uuid := app.acting_for(p_child);
  v_mine text;
begin
  select e.division into v_mine from app.tournament_entries e
   where e.tournament_id = p_tournament and e.player_id = v_who;
  return query
  select p.id, p.display_name, p.last_initial, p.photo_url, p.level_value::numeric, p.level_source,
         case when p.adult_at > current_date then app.age_years(p.date_of_birth) end,
         e.division, e.singles, e.doubles, e.wants_partner,
         coalesce(e.division = v_mine, false), p.availability_mask::int, p.home_court_id
    from app.tournament_entries e
    join app.profiles p on p.id = e.player_id
    join app.tournaments t on t.id = e.tournament_id
   where e.tournament_id = p_tournament
     and t.market_id = (select market_id from app.profiles where id = v_who)
     and app.pair_ok(v_who, e.player_id)
     and app.cohort_discovery_open(v_who)
   order by coalesce(e.division = v_mine, false) desc, e.wants_partner desc,
            abs(coalesce(p.level_value, 0) - coalesce((select level_value from app.profiles where id = v_who), 0)),
            p.display_name;
end;
$$;

-- 8 -------------------------------------------------------------------------------------
revoke execute on function
  app.doubles_match(uuid), app.suggest_doubles(uuid, text),
  app.add_tournament(text, date, date, text, text, uuid), app.upcoming_tournaments(uuid),
  app.enter_tournament(uuid, text, boolean, boolean, boolean, uuid), app.leave_tournament(uuid, uuid),
  app.tournament_players(uuid, uuid)
from public, anon;

grant execute on function
  app.doubles_match(uuid), app.suggest_doubles(uuid, text),
  app.add_tournament(text, date, date, text, text, uuid), app.upcoming_tournaments(uuid),
  app.enter_tournament(uuid, text, boolean, boolean, boolean, uuid), app.leave_tournament(uuid, uuid),
  app.tournament_players(uuid, uuid)
to authenticated;

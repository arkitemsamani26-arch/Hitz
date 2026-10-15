-- Coaches (migration 20261014000100).
--
-- A coach runs an academy or a team. Players join with the coach's code, and the coach can
-- pair two of them up: "Theo, hit with Maya on Saturday at Mitchell". Each player gets the
-- suggestion, and either one turns it into an ordinary invitation with one tap. From there
-- it is the normal flow: they talk, a parent approves a junior's hit, it's on.
--
-- The separation rule still holds. A coach is an adult, and no adult finds or contacts a
-- junior on Hits. So a junior is on a coach's roster only when all three are true:
--
--   * the junior joined with the coach's code themselves;
--   * their parent approved that coach, by name, for that child;
--   * a person at Hits has verified the coach (coaches.juniors_verified_at, set by the
--     server, never by a client).
--
-- Even then the coach sees a junior's first name, last initial, photo, level, age, home
-- court and usual times, and can suggest partners. A coach cannot message anyone, cannot
-- see conversations, and cannot pair across the age boundary or outside a parent's age
-- rule. Everything here goes through the functions below; the tables have no grants.

create table app.coaches (
  profile_id           uuid primary key references app.profiles(id) on delete cascade,
  academy              text not null check (char_length(btrim(academy)) between 2 and 60),
  code                 citext not null unique,
  juniors_verified_at  timestamptz,
  created_at           timestamptz not null default now()
);

create table app.coach_members (
  coach_id      uuid not null references app.coaches(profile_id) on delete cascade,
  player_id     uuid not null references app.profiles(id) on delete cascade,
  joined_at     timestamptz not null default now(),
  parent_ok_at  timestamptz,          -- juniors only: their parent approved this coach
  left_at       timestamptz,
  primary key (coach_id, player_id),
  check (coach_id <> player_id)
);
create index coach_members_player_idx on app.coach_members (player_id) where left_at is null;

create table app.pairings (
  id              uuid primary key default uuid_generate_v4(),
  coach_id        uuid not null references app.coaches(profile_id) on delete cascade,
  a_id            uuid not null references app.profiles(id) on delete cascade,
  b_id            uuid not null references app.profiles(id) on delete cascade,
  court_id        uuid references app.courts(id) on delete set null,
  window_start    timestamptz,
  window_end      timestamptz,
  note            text check (note is null or char_length(note) <= 280),
  state           text not null default 'open' check (state in ('open', 'sent', 'dismissed')),
  hit_request_id  uuid references app.hit_requests(id) on delete set null,
  created_at      timestamptz not null default now(),
  check (a_id <> b_id),
  check ((window_start is null) = (window_end is null)),
  check (window_end is null or window_end > window_start)
);
create index pairings_a_idx on app.pairings (a_id) where state = 'open';
create index pairings_b_idx on app.pairings (b_id) where state = 'open';
create index pairings_coach_idx on app.pairings (coach_id, created_at desc);

alter table app.coaches enable row level security;
alter table app.coach_members enable row level security;
alter table app.pairings enable row level security;
revoke all on app.coaches, app.coach_members, app.pairings from public, anon, authenticated;

-- Membership that counts: not left, and for a junior, approved by a parent and with a
-- coach Hits has verified.
create or replace function app.coach_member_active(p_coach uuid, p_player uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.coach_members m join app.coaches c on c.profile_id = m.coach_id
     where m.coach_id = p_coach and m.player_id = p_player and m.left_at is null
       and app.is_participating(p_player)
       and (app.profile_band(p_player) = 'adult'
            or (m.parent_ok_at is not null and c.juniors_verified_at is not null))
  );
$$;
revoke execute on function app.coach_member_active(uuid, uuid) from public, anon, authenticated;

-- Becoming a coach ---------------------------------------------------------------------------
create or replace function app.become_coach(p_academy text)
returns table (academy text, code text, juniors_verified boolean)
language plpgsql
security definer
set search_path = app, public
as $$
declare v_code text; tries int := 0;
begin
  if app.uid() is null or not app.is_participating(app.uid()) then raise exception 'sign in first'; end if;
  if app.profile_band(app.uid()) <> 'adult' then raise exception 'coaches are adults'; end if;
  if char_length(btrim(coalesce(p_academy, ''))) < 2 then raise exception 'name your academy or team'; end if;
  if exists (select 1 from app.coaches where profile_id = app.uid()) then
    update app.coaches set academy = btrim(p_academy) where profile_id = app.uid();
  else
    -- Speakable when the name allows ("PENIN42"); mint_code checks invites and rosters, so
    -- this checks coaches, and falls back to a random code if the name's space is crowded.
    loop
      v_code := case when tries < 10 then app.mint_code(7, p_academy) else app.mint_code(8, null) end;
      exit when not exists (select 1 from app.coaches x where x.code = v_code);
      tries := tries + 1;
    end loop;
    insert into app.coaches (profile_id, academy, code) values (app.uid(), btrim(p_academy), v_code);
  end if;
  return query select c.academy, c.code::text, c.juniors_verified_at is not null from app.coaches c where c.profile_id = app.uid();
end;
$$;

create or replace function app.my_coaching()
returns table (academy text, code text, juniors_verified boolean)
language sql
stable
security definer
set search_path = app, public
as $$
  select c.academy, c.code::text, c.juniors_verified_at is not null from app.coaches c where c.profile_id = app.uid();
$$;

-- Joining a coach ----------------------------------------------------------------------------
-- Before joining: who is this code? A name and an academy, nothing else.
create or replace function app.check_coach_code(p_code text)
returns table (coach_name text, academy text)
language sql
stable
security definer
set search_path = app, public
as $$
  select p.display_name || coalesce(' ' || p.last_initial || '.', ''), c.academy
    from app.coaches c join app.profiles p on p.id = c.profile_id
   where c.code = p_code and p.status = 'active';
$$;

create or replace function app.join_coach(p_code text)
returns table (coach_id uuid, coach_name text, academy text, needs_parent boolean)
language plpgsql
security definer
set search_path = app, public
as $$
declare c app.coaches; minor boolean;
begin
  if app.uid() is null or not exists (select 1 from app.profiles where id = app.uid()) then raise exception 'sign in first'; end if;
  select * into c from app.coaches where code = p_code;
  if c.profile_id is null then raise exception 'That code is not a coach on Hits. Check it with them.'; end if;
  if c.profile_id = app.uid() then raise exception 'That is your own code.'; end if;
  minor := app.profile_band(app.uid()) = 'minor';
  insert into app.coach_members (coach_id, player_id) values (c.profile_id, app.uid())
  on conflict on constraint coach_members_pkey do update set left_at = null, joined_at = now(),
    parent_ok_at = case when minor then null else app.coach_members.parent_ok_at end;
  -- The coach hears about adults now; about a junior only once the junior is on the roster.
  if not minor then
    perform app.enqueue(c.profile_id, 'coach_joined', (select display_name from app.profiles where id = app.uid()) || ' joined ' || c.academy,
      'Pair them with someone from Coach tools.', jsonb_build_object('coach', true));
  else
    -- The parent decides.
    perform app.enqueue(g.guardian_user_id, 'coach_approval', (select display_name from app.profiles where id = app.uid()) || ' wants to join a coach',
      c.academy || ': approve it in Hits.', jsonb_build_object('coach', true))
      from app.guardian_links g
     where g.minor_profile_id = app.uid() and g.verified_at is not null and g.revoked_at is null and g.guardian_user_id is not null;
  end if;
  return query select c.profile_id, (select p.display_name || coalesce(' ' || p.last_initial || '.', '') from app.profiles p where p.id = c.profile_id), c.academy, minor;
end;
$$;

-- A player's coaches, with where each link stands.
create or replace function app.my_coaches()
returns table (coach_id uuid, coach_name text, academy text, status text)
language sql
stable
security definer
set search_path = app, public
as $$
  select c.profile_id, p.display_name || coalesce(' ' || p.last_initial || '.', ''), c.academy,
         case when app.profile_band(m.player_id) = 'adult' then 'active'
              when m.parent_ok_at is null then 'parent'
              when c.juniors_verified_at is null then 'verify'
              else 'active' end
    from app.coach_members m
    join app.coaches c on c.profile_id = m.coach_id
    join app.profiles p on p.id = c.profile_id
   where m.player_id = app.uid() and m.left_at is null;
$$;

create or replace function app.leave_coach(p_coach uuid)
returns void
language sql
security definer
set search_path = app, public
as $$
  update app.coach_members set left_at = now()
   where coach_id = p_coach and player_id = app.uid() and left_at is null;
  update app.pairings set state = 'dismissed'
   where coach_id = p_coach and state = 'open' and app.uid() in (a_id, b_id);
$$;

-- Parents ------------------------------------------------------------------------------------
create or replace function app.guardian_coach_links()
returns table (child_id uuid, child_name text, coach_id uuid, coach_name text, academy text, approved boolean, coach_verified boolean)
language sql
stable
security definer
set search_path = app, public
as $$
  select m.player_id, kid.display_name, c.profile_id, cp.display_name || coalesce(' ' || cp.last_initial || '.', ''), c.academy,
         m.parent_ok_at is not null, c.juniors_verified_at is not null
    from app.coach_members m
    join app.coaches c on c.profile_id = m.coach_id
    join app.profiles cp on cp.id = c.profile_id
    join app.profiles kid on kid.id = m.player_id
   where m.left_at is null and app.is_guardian_of(m.player_id)
   order by m.joined_at desc;
$$;

create or replace function app.guardian_decide_coach(p_child uuid, p_coach uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not app.is_guardian_of(p_child) then raise exception 'only a linked parent can decide this'; end if;
  if p_ok then
    update app.coach_members set parent_ok_at = now() where coach_id = p_coach and player_id = p_child and left_at is null;
    perform app.enqueue(p_coach, 'coach_joined', (select display_name from app.profiles where id = p_child) || ' joined your academy',
      'Their parent approved. Pair them with someone from Coach tools.', jsonb_build_object('coach', true))
     where exists (select 1 from app.coaches where profile_id = p_coach and juniors_verified_at is not null);
  else
    update app.coach_members set left_at = now(), parent_ok_at = null where coach_id = p_coach and player_id = p_child and left_at is null;
    update app.pairings set state = 'dismissed' where coach_id = p_coach and state = 'open' and p_child in (a_id, b_id);
  end if;
end;
$$;

-- The coach's view ---------------------------------------------------------------------------
-- The roster: everyone who joined, with where they stand. A junior who is not yet on the
-- roster appears by first name only, so the coach knows who to chase, and nothing else.
create or replace function app.coach_roster()
returns table (
  player_id uuid, display_name text, last_initial text, photo_url text, level_value numeric, level_source app.level_source,
  home_court_id uuid, availability_mask int, looking_to_hit boolean, last_active_at timestamptz, hits_confirmed int,
  prefers text, age int, band app.age_band, status text, joined_at timestamptz
)
language sql
stable
security definer
set search_path = app, public
as $$
  select p.id, p.display_name,
         case when ok then p.last_initial end, case when ok then p.photo_url end,
         case when ok then p.level_value end, case when ok then p.level_source end,
         case when ok then p.home_court_id end, case when ok then p.availability_mask else 0 end,
         case when ok then p.looking_to_hit_until is not null and p.looking_to_hit_until > now() else false end,
         case when ok then p.last_active_at end, case when ok then p.hits_confirmed else 0 end,
         case when ok then p.prefers end,
         case when ok and p.adult_at > current_date then app.age_years(p.date_of_birth) end,
         app.profile_band(p.id),
         case when ok then 'active'
              when app.profile_band(p.id) = 'minor' and m.parent_ok_at is null then 'parent'
              when app.profile_band(p.id) = 'minor' then 'verify'
              else 'inactive' end,
         m.joined_at
    from app.coach_members m
    join app.profiles p on p.id = m.player_id
    cross join lateral (select app.coach_member_active(m.coach_id, m.player_id) as ok) a
   where m.coach_id = app.uid() and m.left_at is null
   order by ok desc, p.display_name;
$$;

create or replace function app.coach_remove(p_player uuid)
returns void
language sql
security definer
set search_path = app, public
as $$
  update app.coach_members set left_at = now() where coach_id = app.uid() and player_id = p_player and left_at is null;
  update app.pairings set state = 'dismissed' where coach_id = app.uid() and state = 'open' and p_player in (a_id, b_id);
$$;

-- Pairing two players. Both must be on the roster, on the same side of 18, not blocked,
-- and inside both parents' age rules: the same tests an invitation between them would face.
create or replace function app.coach_pair(p_a uuid, p_b uuid, p_court uuid, p_start timestamptz, p_end timestamptz, p_note text)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare v_id uuid; coach_name text; a_name text; b_name text; court text; whenx text;
begin
  if not exists (select 1 from app.coaches where profile_id = app.uid()) then raise exception 'turn on coach tools first'; end if;
  if p_a = p_b then raise exception 'pick two different players'; end if;
  if not app.coach_member_active(app.uid(), p_a) or not app.coach_member_active(app.uid(), p_b) then
    raise exception 'both players need to be on your roster';
  end if;
  if not app.same_band(p_a, p_b) then raise exception 'juniors are only paired with juniors'; end if;
  if app.blocked_between(p_a, p_b) then raise exception 'these two cannot be paired'; end if;
  if not app.age_gap_ok(p_a, p_b) then raise exception 'a parent''s age range rules this pair out'; end if;
  if p_start is not null and p_start < now() then raise exception 'pick a time that has not passed'; end if;
  if exists (select 1 from app.pairings where coach_id = app.uid() and state = 'open'
              and ((a_id = p_a and b_id = p_b) or (a_id = p_b and b_id = p_a))) then
    raise exception 'you already paired these two';
  end if;

  insert into app.pairings (coach_id, a_id, b_id, court_id, window_start, window_end, note)
  values (app.uid(), p_a, p_b, p_court, p_start, p_end, nullif(btrim(coalesce(p_note, '')), ''))
  returning id into v_id;

  select display_name into coach_name from app.profiles where id = app.uid();
  select display_name into a_name from app.profiles where id = p_a;
  select display_name into b_name from app.profiles where id = p_b;
  select name into court from app.courts where id = p_court;
  whenx := case when p_start is null then 'Pick a time together'
                else app.hit_when(p_start, coalesce(p_court, (select home_court_id from app.profiles where id = p_a))) end;
  perform app.enqueue(p_a, 'pairing', 'Coach ' || coach_name || ' paired you with ' || b_name, whenx || coalesce(' · ' || court, ''), jsonb_build_object('pairing', v_id));
  perform app.enqueue(p_b, 'pairing', 'Coach ' || coach_name || ' paired you with ' || a_name, whenx || coalesce(' · ' || court, ''), jsonb_build_object('pairing', v_id));
  return v_id;
end;
$$;

-- The coach's pairings and how each went. Hit state only; never what was said.
create or replace function app.coach_pairings()
returns table (
  id uuid, a_id uuid, a_name text, b_id uuid, b_name text, court_id uuid, window_start timestamptz, window_end timestamptz,
  note text, state text, hit_state app.hit_state, created_at timestamptz
)
language sql
stable
security definer
set search_path = app, public
as $$
  select x.id, x.a_id, pa.display_name, x.b_id, pb.display_name, x.court_id, x.window_start, x.window_end, x.note, x.state,
         h.state, x.created_at
    from app.pairings x
    join app.profiles pa on pa.id = x.a_id
    join app.profiles pb on pb.id = x.b_id
    left join app.hit_requests h on h.id = x.hit_request_id
   where x.coach_id = app.uid()
   order by x.created_at desc
   limit 50;
$$;

-- The player's side ------------------------------------------------------------------------
create or replace function app.my_pairings()
returns table (id uuid, coach_id uuid, coach_name text, academy text, other_id uuid, court_id uuid,
               window_start timestamptz, window_end timestamptz, note text, created_at timestamptz)
language sql
stable
security definer
set search_path = app, public
as $$
  select x.id, c.profile_id, cp.display_name || coalesce(' ' || cp.last_initial || '.', ''), c.academy,
         case when x.a_id = app.uid() then x.b_id else x.a_id end,
         x.court_id, x.window_start, x.window_end, x.note, x.created_at
    from app.pairings x
    join app.coaches c on c.profile_id = x.coach_id
    join app.profiles cp on cp.id = c.profile_id
   where x.state = 'open' and app.uid() in (x.a_id, x.b_id)
     and app.coach_member_active(x.coach_id, app.uid())
     and app.can_view_profile(case when x.a_id = app.uid() then x.b_id else x.a_id end)
   order by x.created_at desc;
$$;

-- One of the pair sent the invitation: the suggestion is done, and the coach can follow the
-- hit it became.
create or replace function app.pairing_sent(p_pairing uuid, p_hit uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not exists (select 1 from app.pairings where id = p_pairing and app.uid() in (a_id, b_id)) then raise exception 'not your pairing'; end if;
  if not exists (select 1 from app.hit_requests h join app.pairings x on x.id = p_pairing
                  where h.id = p_hit and h.from_profile_id = app.uid()
                    and h.to_profile_id = case when x.a_id = app.uid() then x.b_id else x.a_id end) then
    raise exception 'that invitation is not between the two of you';
  end if;
  update app.pairings set state = 'sent', hit_request_id = p_hit where id = p_pairing;
end;
$$;

create or replace function app.dismiss_pairing(p_pairing uuid)
returns void
language sql
security definer
set search_path = app, public
as $$
  update app.pairings set state = 'dismissed' where id = p_pairing and app.uid() in (a_id, b_id) and state = 'open';
$$;

-- Grants -------------------------------------------------------------------------------------
revoke execute on function app.become_coach(text), app.my_coaching(), app.check_coach_code(text), app.join_coach(text),
  app.my_coaches(), app.leave_coach(uuid), app.guardian_coach_links(), app.guardian_decide_coach(uuid, uuid, boolean),
  app.coach_roster(), app.coach_remove(uuid), app.coach_pair(uuid, uuid, uuid, timestamptz, timestamptz, text),
  app.coach_pairings(), app.my_pairings(), app.pairing_sent(uuid, uuid), app.dismiss_pairing(uuid)
  from public, anon;
grant execute on function app.become_coach(text), app.my_coaching(), app.check_coach_code(text), app.join_coach(text),
  app.my_coaches(), app.leave_coach(uuid), app.guardian_coach_links(), app.guardian_decide_coach(uuid, uuid, boolean),
  app.coach_roster(), app.coach_remove(uuid), app.coach_pair(uuid, uuid, uuid, timestamptz, timestamptz, text),
  app.coach_pairings(), app.my_pairings(), app.pairing_sent(uuid, uuid), app.dismiss_pairing(uuid)
  to authenticated;

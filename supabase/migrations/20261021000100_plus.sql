-- Hits Plus (migration 20261021000100). One paid plan, $4.99 a month.
--
-- The rule: a free player can still get a hit every week. Nothing here limits receiving or
-- answering invitations, messages, phone sharing, parent approvals, safety, blocking,
-- reporting, tournaments, doubles partners, the family view or the coach tools. What Plus
-- buys is more at once and more insight: unlimited open invitations (free: three), the
-- advanced filters, the whole "looking this week" list (free: the top five), "I'm free"
-- for seven days (free: three), your stats, saved searches with alerts, private notes on
-- partners, a fuller card, and auto-match.
--
-- Every limit is enforced here, not hidden in the app. A limit raises an error whose
-- message starts with `plus_required:`, which the app turns into the paywall.
--
-- A junior never buys. Plus on a child's account comes from a linked, verified parent who
-- has it; the parent's one subscription covers every child they manage.

-- 1. Subscriptions ------------------------------------------------------------------------
-- Keyed by the auth user, not the profile: a parent has a sign-in and may have no profile.
create table app.subscriptions (
  user_id                 uuid primary key,
  plan                    text not null default 'plus' check (plan = 'plus'),
  status                  text not null check (status in ('active', 'grace', 'cancelled', 'expired', 'billing_issue')),
  expires_at              timestamptz,
  source                  text not null check (source in ('apple', 'google', 'promo')),
  original_transaction_id text,
  updated_at              timestamptz not null default now()
);
alter table app.subscriptions enable row level security;
revoke all on app.subscriptions from public, anon, authenticated;
-- No client writes, ever. The RevenueCat webhook (service role) and the owner's promo
-- function are the only writers.

create or replace function app.has_own_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select exists (
    select 1 from app.subscriptions s
     where s.user_id = p_user
       and s.status in ('active', 'grace')
       and (s.expires_at is null or s.expires_at > now())
  );
$$;
revoke execute on function app.has_own_plus(uuid) from public, anon, authenticated;

-- Plus for a player: their own, or any verified parent's. A parent's plan covers the kids.
create or replace function app.is_plus(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = app, public
as $$
  select p_user is not null and (
    app.has_own_plus(p_user)
    or exists (
      select 1 from app.guardian_links g
       where g.minor_profile_id = p_user
         and g.verified_at is not null and g.revoked_at is null
         and g.guardian_user_id is not null
         and app.has_own_plus(g.guardian_user_id)
    )
  );
$$;
revoke execute on function app.is_plus(uuid) from public, anon, authenticated;

-- What the app shows about your plan.
create or replace function app.my_plus()
returns table (plus boolean, plus_until timestamptz, via_parent boolean, source text)
language sql
stable
security definer
set search_path = app, public
as $$
  with own as (
    select s.expires_at, s.source from app.subscriptions s
     where s.user_id = app.uid() and s.status in ('active', 'grace') and (s.expires_at is null or s.expires_at > now())
  ),
  parent as (
    select s.expires_at from app.guardian_links g
      join app.subscriptions s on s.user_id = g.guardian_user_id
     where g.minor_profile_id = app.uid() and g.verified_at is not null and g.revoked_at is null
       and s.status in ('active', 'grace') and (s.expires_at is null or s.expires_at > now())
     order by s.expires_at desc nulls first limit 1
  )
  select app.is_plus(app.uid()),
         coalesce((select expires_at from own), (select expires_at from parent)),
         not exists (select 1 from own) and exists (select 1 from parent),
         (select source from own);
$$;
revoke execute on function app.my_plus() from public, anon;
grant execute on function app.my_plus() to authenticated;

-- The webhook's one write. service_role only.
create or replace function app.apply_subscription(p_user uuid, p_status text, p_expires_at timestamptz, p_source text, p_txn text default null)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if current_user <> 'service_role' and current_user <> (select tableowner from pg_tables where schemaname = 'app' and tablename = 'subscriptions') then
    raise exception 'subscriptions are written by the server only';
  end if;
  insert into app.subscriptions (user_id, status, expires_at, source, original_transaction_id, updated_at)
  values (p_user, p_status, p_expires_at, p_source, p_txn, now())
  on conflict (user_id) do update
    set status = excluded.status, expires_at = excluded.expires_at, source = excluded.source,
        original_transaction_id = coalesce(excluded.original_transaction_id, app.subscriptions.original_transaction_id),
        updated_at = now();
  -- A parent who just got Plus has answered every child's request.
  update app.plus_requests r set answered_at = now()
   where r.answered_at is null
     and r.child_id in (select g.minor_profile_id from app.guardian_links g
                         where g.guardian_user_id = p_user and g.verified_at is not null and g.revoked_at is null);
end;
$$;
revoke execute on function app.apply_subscription(uuid, text, timestamptz, text, text) from public, anon, authenticated;
grant execute on function app.apply_subscription(uuid, text, timestamptz, text, text) to service_role;

-- For the owner: give someone Plus by hand, for a number of days. service_role only.
create or replace function app.grant_plus_promo(p_user uuid, p_days int default 30)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if current_user <> 'service_role' and current_user <> (select tableowner from pg_tables where schemaname = 'app' and tablename = 'subscriptions') then
    raise exception 'promo codes are granted by the server only';
  end if;
  perform app.apply_subscription(p_user, 'active', now() + make_interval(days => greatest(coalesce(p_days, 30), 1)), 'promo', null);
end;
$$;
revoke execute on function app.grant_plus_promo(uuid, int) from public, anon, authenticated;
grant execute on function app.grant_plus_promo(uuid, int) to service_role;

-- The badge. Which of these players have Plus: a yes or no per id, nothing about the plan.
create or replace function app.plus_of(p_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = app, public
as $$
  select x from unnest(p_ids) x where app.is_plus(x);
$$;
revoke execute on function app.plus_of(uuid[]) from public, anon;
grant execute on function app.plus_of(uuid[]) to authenticated;

-- 2. Juniors ask their parent --------------------------------------------------------------
create table app.plus_requests (
  child_id     uuid primary key references app.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  answered_at  timestamptz
);
alter table app.plus_requests enable row level security;
revoke all on app.plus_requests from public, anon, authenticated;

-- A minor never starts a purchase. The app calls this before it shows the store.
create or replace function app.begin_purchase()
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if app.uid() is null then raise exception 'sign in first'; end if;
  if exists (select 1 from app.profiles where id = app.uid() and adult_at > current_date) then
    raise exception 'Your parent buys Plus for you. Ask them from Profile.';
  end if;
  return app.uid();
end;
$$;
revoke execute on function app.begin_purchase() from public, anon;
grant execute on function app.begin_purchase() to authenticated;

create or replace function app.request_plus_from_parent()
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_name text;
  g record;
begin
  select display_name into v_name from app.profiles where id = app.uid() and adult_at > current_date;
  if v_name is null then raise exception 'only a junior asks a parent'; end if;
  if app.is_plus(app.uid()) then return; end if;
  insert into app.plus_requests (child_id) values (app.uid())
  on conflict (child_id) do update set requested_at = now(), answered_at = null;
  for g in select guardian_user_id from app.guardian_links
            where minor_profile_id = app.uid() and verified_at is not null and revoked_at is null and guardian_user_id is not null loop
    perform app.enqueue(g.guardian_user_id, 'plus_request', v_name || ' asked for Hits Plus',
                        'One plan covers every child you manage. $4.99 a month.', jsonb_build_object('plus', true));
  end loop;
end;
$$;
revoke execute on function app.request_plus_from_parent() from public, anon;
grant execute on function app.request_plus_from_parent() to authenticated;

-- For the family view: which children asked, and are still without it.
create or replace function app.guardian_plus_requests()
returns table (child_id uuid, child_name text, requested_at timestamptz)
language sql
stable
security definer
set search_path = app, public
as $$
  select r.child_id, p.display_name, r.requested_at
    from app.plus_requests r
    join app.profiles p on p.id = r.child_id
   where app.is_guardian_of(r.child_id) and r.answered_at is null and not app.is_plus(r.child_id)
   order by r.requested_at desc;
$$;
revoke execute on function app.guardian_plus_requests() from public, anon;
grant execute on function app.guardian_plus_requests() to authenticated;

-- 3. The free plan's limits ------------------------------------------------------------------
-- Three open invitations at once. A doubles game counts once, however many it invites.
create or replace function app.guard_plus_cap()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_open int;
begin
  if app.is_plus(new.from_profile_id) then return new; end if;
  -- Joining a game already started is not a new invitation for the cap.
  if new.match_id is not null and exists (select 1 from app.hit_requests h where h.match_id = new.match_id and h.id <> new.id) then
    return new;
  end if;
  select count(distinct coalesce(h.match_id, h.id)) into v_open
    from app.hit_requests h
   where h.from_profile_id = new.from_profile_id and h.state in ('pending', 'countered') and h.id <> new.id;
  if v_open >= 3 then
    raise exception 'plus_required:invites You have three invitations waiting on a reply. Plus sends as many as you like.';
  end if;
  return new;
end;
$$;
revoke execute on function app.guard_plus_cap() from public, anon, authenticated;
create trigger hit_requests_plus_cap
  before insert on app.hit_requests
  for each row execute function app.guard_plus_cap();

-- "I'm free this week" lasts three days free, seven on Plus. Clamped rather than refused.
create or replace function app.clamp_looking()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if new.looking_to_hit_until is not null then
    new.looking_to_hit_until := least(new.looking_to_hit_until,
      now() + (case when app.is_plus(new.id) then interval '7 days' else interval '3 days' end) + interval '5 minutes');
  end if;
  return new;
end;
$$;
revoke execute on function app.clamp_looking() from public, anon, authenticated;
create trigger profiles_clamp_looking
  before insert or update of looking_to_hit_until on app.profiles
  for each row execute function app.clamp_looking();

-- 4. The fuller card -------------------------------------------------------------------------
alter table app.profiles
  add column play_style               text check (play_style in ('baseliner', 'all_court', 'serve_volley', 'counterpuncher')),
  add column handedness               text check (handedness in ('left', 'right')),
  add column bio                      text check (bio is null or length(bio) <= 160),
  add column action_photo_url         text,
  add column action_photo_pending_url text;

grant select (play_style, handedness, bio, action_photo_url) on app.profiles to authenticated;

-- Writing them is Plus. What is already written stays when a plan lapses.
create or replace function app.guard_plus_card()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if current_user = 'service_role' then return new; end if;
  if (new.play_style is distinct from old.play_style and new.play_style is not null)
     or (new.handedness is distinct from old.handedness and new.handedness is not null)
     or (new.bio is distinct from old.bio and new.bio is not null) then
    if not app.is_plus(new.id) then
      raise exception 'plus_required:card Your playing style, hand and a line about you are part of Plus.';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function app.guard_plus_card() from public, anon, authenticated;
create trigger profiles_plus_card
  before update of play_style, handedness, bio on app.profiles
  for each row execute function app.guard_plus_card();

-- The action photo takes the same road as the face: a junior's waits for the parent.
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
  elsif app.profile_band(app.uid()) = 'minor' then
    update app.profiles set action_photo_pending_url = p_url where id = app.uid();
  else
    update app.profiles set action_photo_url = p_url, action_photo_pending_url = null where id = app.uid();
  end if;
end;
$$;
revoke execute on function app.set_my_action_photo(text) from public, anon;
grant execute on function app.set_my_action_photo(text) to authenticated;

create or replace function app.guardian_approve_action_photo(p_child uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if not app.is_guardian_of(p_child) then raise exception 'not your child'; end if;
  if p_approve then
    update app.profiles set action_photo_url = coalesce(action_photo_pending_url, action_photo_url), action_photo_pending_url = null where id = p_child;
  else
    update app.profiles set action_photo_pending_url = null, action_photo_url = null where id = p_child;
  end if;
end;
$$;
revoke execute on function app.guardian_approve_action_photo(uuid, boolean) from public, anon;
grant execute on function app.guardian_approve_action_photo(uuid, boolean) to authenticated;

-- 5. Discovery: the advanced filters ---------------------------------------------------------
-- The nine-argument discover is renamed and closed to clients rather than dropped (the hosted
-- SQL tool holds any DROP for a person). The new one wraps it, applies the Plus filters, and
-- keeps the old one's order. court_players and suggest_doubles resolve the name at run time
-- and so call this one.
alter function app.discover(int, numeric, numeric, int, boolean, interval, int, int, int) rename to discover_v2;
revoke execute on function app.discover_v2(int, numeric, numeric, int, boolean, interval, int, int, int) from public, anon, authenticated;

create function app.discover(
  p_radius_m       int default 40234,
  p_level_lo       numeric default null,
  p_level_hi       numeric default null,
  p_availability   int default 0,
  p_only_looking   boolean default false,
  p_active_within  interval default interval '30 days',
  p_limit          int default 50,
  p_offset         int default 0,
  p_age_gap        int default null,
  p_play_style     text default null,
  p_handedness     text default null,
  p_min_reply_rate numeric default null,
  p_indoor_only    boolean default false,
  p_format         text default null
)
returns table (
  profile_id        uuid,
  display_name      text,
  last_initial      text,
  photo_url         text,
  level_value       numeric,
  level_source      app.level_source,
  level_verified    boolean,
  level_delta       numeric,
  distance_bucket   text,
  home_court_id     uuid,
  availability_mask int,
  looking_to_hit    boolean,
  last_active_at    timestamptz,
  response_rate     numeric,
  accept_rate       numeric,
  hits_confirmed    int,
  prefers           text,
  age               int
)
language plpgsql
stable
security definer
set search_path = app, public
as $$
#variable_conflict use_column
declare
  v_plus boolean := app.is_plus(app.uid());
  v_advanced boolean := p_play_style is not null or p_handedness is not null or p_min_reply_rate is not null
                        or coalesce(p_indoor_only, false) or p_format in ('singles', 'doubles');
  v_n int := least(greatest(coalesce(p_limit, 50), 1), 1000);
begin
  if v_advanced and not v_plus then
    raise exception 'plus_required:filters Playing style, hand, reply rate, indoor and singles-or-doubles filters are part of Plus.';
  end if;
  -- The whole "looking this week" list is Plus; free sees the top five.
  if coalesce(p_only_looking, false) and not v_plus then
    v_n := least(v_n, 5);
  end if;
  return query
  select d.profile_id, d.display_name, d.last_initial, d.photo_url, d.level_value, d.level_source, d.level_verified,
         d.level_delta, d.distance_bucket, d.home_court_id, d.availability_mask, d.looking_to_hit, d.last_active_at,
         d.response_rate, d.accept_rate, d.hits_confirmed, d.prefers, d.age
    from app.discover_v2(p_radius_m, p_level_lo, p_level_hi, p_availability, p_only_looking, p_active_within, 1000, 0, p_age_gap)
         with ordinality as d
    join app.profiles p on p.id = d.profile_id
    left join app.courts c on c.id = p.home_court_id
   where (p_play_style is null or p.play_style = p_play_style)
     and (p_handedness is null or p.handedness = p_handedness)
     and (p_min_reply_rate is null or coalesce(d.response_rate, 0) >= p_min_reply_rate)
     and (not coalesce(p_indoor_only, false) or coalesce(c.indoor, false))
     and (p_format not in ('singles', 'doubles') or p_format is null or p.play_format in (p_format, 'either'))
   order by d.ordinality
   limit v_n offset greatest(coalesce(p_offset, 0), 0);
end;
$$;
revoke execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int, int, text, text, numeric, boolean, text) from public, anon;
grant execute on function app.discover(int, numeric, numeric, int, boolean, interval, int, int, int, text, text, numeric, boolean, text) to authenticated;

-- 6. Stats ---------------------------------------------------------------------------------------
-- Your level over time, kept from here on: one row each time it changes.
create table app.level_history (
  profile_id  uuid not null references app.profiles(id) on delete cascade,
  level_value numeric not null,
  recorded_at timestamptz not null default now()
);
create index level_history_idx on app.level_history (profile_id, recorded_at);
alter table app.level_history enable row level security;
revoke all on app.level_history from public, anon, authenticated;

create or replace function app.record_level()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if new.level_value is not null and (tg_op = 'INSERT' or new.level_value is distinct from old.level_value) then
    insert into app.level_history (profile_id, level_value) values (new.id, new.level_value);
  end if;
  return null;
end;
$$;
revoke execute on function app.record_level() from public, anon, authenticated;
create trigger profiles_record_level
  after insert or update of level_value on app.profiles
  for each row execute function app.record_level();

insert into app.level_history (profile_id, level_value, recorded_at)
select id, level_value, created_at from app.profiles where level_value is not null;

-- Hits per month, who you play most, your level over time. Plus.
create or replace function app.my_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = app, public
as $$
declare
  v_me uuid := app.uid();
begin
  if not app.is_plus(v_me) then
    raise exception 'plus_required:stats Your hitting history and stats are part of Plus.';
  end if;
  return jsonb_build_object(
    'months', coalesce((
      select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'), 'hits', coalesce(n, 0)) order by m)
        from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') m
        left join (
          select date_trunc('month', window_start) mo, count(*) n
            from app.hit_requests
           where v_me in (from_profile_id, to_profile_id) and state = 'completed'
           group by 1
        ) h on h.mo = m
    ), '[]'::jsonb),
    'partners', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.other, 'name', p.display_name, 'initial', p.last_initial, 'photo', p.photo_url, 'hits', x.n, 'last', x.last) order by x.n desc, x.last desc)
        from (
          select case when from_profile_id = v_me then to_profile_id else from_profile_id end other, count(*) n, max(window_start) last
            from app.hit_requests
           where v_me in (from_profile_id, to_profile_id) and state = 'completed'
           group by 1 order by 2 desc, 3 desc limit 5
        ) x
        join app.profiles p on p.id = x.other
    ), '[]'::jsonb),
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object('at', recorded_at, 'level', level_value) order by recorded_at)
        from (select recorded_at, level_value from app.level_history where profile_id = v_me order by recorded_at desc limit 24) l
    ), '[]'::jsonb),
    'total', (select count(*) from app.hit_requests where v_me in (from_profile_id, to_profile_id) and state = 'completed'),
    'invited', (select count(*) from app.hit_requests where from_profile_id = v_me),
    'received', (select count(*) from app.hit_requests where to_profile_id = v_me)
  );
end;
$$;
revoke execute on function app.my_stats() from public, anon;
grant execute on function app.my_stats() to authenticated;

-- 7. Private notes on partners ------------------------------------------------------------------
create table app.partner_notes (
  owner_id   uuid not null references app.profiles(id) on delete cascade,
  player_id  uuid not null references app.profiles(id) on delete cascade,
  -- Null once the note is cleared; the row stays (the hosted tool holds deletes for a person).
  text       text check (text is null or length(text) between 1 and 280),
  updated_at timestamptz not null default now(),
  primary key (owner_id, player_id)
);
alter table app.partner_notes enable row level security;
revoke all on app.partner_notes from public, anon, authenticated;

create or replace function app.set_partner_note(p_player uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_text text := nullif(btrim(coalesce(p_text, '')), '');
begin
  if not app.is_plus(app.uid()) then
    raise exception 'plus_required:notes Private notes on your partners are part of Plus.';
  end if;
  if v_text is not null and length(v_text) > 280 then raise exception 'keep it under 280 characters'; end if;
  insert into app.partner_notes (owner_id, player_id, text) values (app.uid(), p_player, v_text)
  on conflict (owner_id, player_id) do update set text = excluded.text, updated_at = now();
end;
$$;
revoke execute on function app.set_partner_note(uuid, text) from public, anon;
grant execute on function app.set_partner_note(uuid, text) to authenticated;

create or replace function app.get_partner_note(p_player uuid)
returns text
language plpgsql
stable
security definer
set search_path = app, public
as $$
begin
  if not app.is_plus(app.uid()) then
    raise exception 'plus_required:notes Private notes on your partners are part of Plus.';
  end if;
  return (select text from app.partner_notes where owner_id = app.uid() and player_id = p_player and text is not null);
end;
$$;
revoke execute on function app.get_partner_note(uuid) from public, anon;
grant execute on function app.get_partner_note(uuid) to authenticated;

-- 8. Saved searches, with a daily alert ---------------------------------------------------------
create table app.saved_searches (
  id          uuid primary key default uuid_generate_v4(),
  owner_id    uuid not null references app.profiles(id) on delete cascade,
  name        text not null check (length(name) between 1 and 40),
  filters     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  last_run_at timestamptz,
  removed_at  timestamptz
);
create index saved_searches_owner_idx on app.saved_searches (owner_id) where removed_at is null;
alter table app.saved_searches enable row level security;
revoke all on app.saved_searches from public, anon, authenticated;

create or replace function app.save_search(p_name text, p_filters jsonb)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_id uuid;
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
begin
  if not app.is_plus(app.uid()) then
    raise exception 'plus_required:searches Saved searches, and a push when someone new fits, are part of Plus.';
  end if;
  if v_name is null then raise exception 'name the search'; end if;
  if (select count(*) from app.saved_searches where owner_id = app.uid() and removed_at is null) >= 5 then
    raise exception 'five saved searches is the most; remove one first';
  end if;
  insert into app.saved_searches (owner_id, name, filters) values (app.uid(), left(v_name, 40), coalesce(p_filters, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function app.save_search(text, jsonb) from public, anon;
grant execute on function app.save_search(text, jsonb) to authenticated;

create or replace function app.remove_search(p_id uuid)
returns void
language sql
security definer
set search_path = app, public
as $$
  update app.saved_searches set removed_at = now() where id = p_id and owner_id = app.uid() and removed_at is null;
$$;
revoke execute on function app.remove_search(uuid) from public, anon;
grant execute on function app.remove_search(uuid) to authenticated;

create or replace function app.my_searches()
returns table (id uuid, name text, filters jsonb, created_at timestamptz, last_run_at timestamptz)
language sql
stable
security definer
set search_path = app, public
as $$
  select id, name, filters, created_at, last_run_at from app.saved_searches where owner_id = app.uid() and removed_at is null order by created_at;
$$;
revoke execute on function app.my_searches() from public, anon;
grant execute on function app.my_searches() to authenticated;

-- Server-side jobs act as a player. Transaction-local; the job sets it per owner.
create or replace function app.act_as(p_user uuid)
returns void
language sql
security definer
set search_path = app, public
as $$
  select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), true),
         set_config('request.jwt.claims', case when p_user is null then '' else jsonb_build_object('sub', p_user::text, 'role', 'authenticated')::text end, true);
$$;
revoke execute on function app.act_as(uuid) from public, anon, authenticated;

-- And back to whoever was calling, so an RPC that used a job's path keeps its caller.
create or replace function app.act_back(p_sub text, p_claims text)
returns void
language sql
security definer
set search_path = app, public
as $$
  select set_config('request.jwt.claim.sub', coalesce(p_sub, ''), true),
         set_config('request.jwt.claims', coalesce(p_claims, ''), true);
$$;
revoke execute on function app.act_back(text, text) from public, anon, authenticated;

-- Once a day: for each saved search, anyone who joined in the last day and fits it.
create or replace function app.run_saved_searches()
returns int
language plpgsql
security definer
set search_path = app, public
as $$
declare
  s record;
  v_n int;
  v_sent int := 0;
  f jsonb;
begin
  for s in select * from app.saved_searches where removed_at is null order by owner_id loop
    if not app.is_plus(s.owner_id) then continue; end if;
    perform app.act_as(s.owner_id);
    f := s.filters;
    begin
      select count(*) into v_n
        from app.discover(
          p_radius_m => coalesce((f->>'radius_m')::int, 16093),
          p_level_lo => (f->>'level_lo')::numeric, p_level_hi => (f->>'level_hi')::numeric,
          p_availability => coalesce((f->>'availability')::int, 0),
          p_age_gap => (f->>'age_gap')::int,
          p_play_style => f->>'play_style', p_handedness => f->>'handedness',
          p_min_reply_rate => (f->>'min_reply_rate')::numeric,
          p_indoor_only => coalesce((f->>'indoor_only')::boolean, false),
          p_format => f->>'format', p_limit => 1000) d
        join app.profiles p on p.id = d.profile_id
       where p.created_at > coalesce(s.last_run_at, now() - interval '1 day');
    exception when others then
      v_n := 0;
    end;
    if v_n > 0 then
      perform app.enqueue(s.owner_id, 'saved_search',
        case when v_n = 1 then 'Someone new fits "' || s.name || '"' else v_n || ' new players fit "' || s.name || '"' end,
        'Tap to see who.', jsonb_build_object('search', s.id));
      v_sent := v_sent + 1;
    end if;
    update app.saved_searches set last_run_at = now() where id = s.id;
  end loop;
  perform app.act_as(null);
  return v_sent;
end;
$$;
revoke execute on function app.run_saved_searches() from public, anon, authenticated;
grant execute on function app.run_saved_searches() to service_role;

-- 9. Auto-match -----------------------------------------------------------------------------------
-- "Find me a hit Saturday 9am, 8 to 9, within 10 miles." Hits invites the best fit; if they
-- pass or let it expire, the next; stops when one says yes or the time passes. Every
-- invitation goes through the ordinary path, so every rule (age gap, band, blocks, parent
-- approval, the court) holds exactly as it does when you send one yourself.
create table app.auto_matches (
  id                 uuid primary key default uuid_generate_v4(),
  owner_id           uuid not null references app.profiles(id) on delete cascade,
  window_start       timestamptz not null,
  window_end         timestamptz not null,
  level_lo           numeric,
  level_hi           numeric,
  radius_m           int not null default 16093,
  format             text not null default 'singles' check (format in ('singles', 'doubles')),
  court_id           uuid references app.courts(id),
  state              text not null default 'active' check (state in ('active', 'done', 'expired', 'cancelled')),
  tried              uuid[] not null default '{}',
  current_request_id uuid references app.hit_requests(id) on delete set null,
  matched_request_id uuid references app.hit_requests(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (window_end > window_start)
);
create index auto_matches_active_idx on app.auto_matches (state) where state = 'active';
alter table app.auto_matches enable row level security;
revoke all on app.auto_matches from public, anon, authenticated;

-- The slot a window falls in, the way the week grid counts them.
create or replace function app.slot_bit(p_at timestamptz)
returns int
language sql
immutable
set search_path = app, public
as $$
  select (case when extract(isodow from p_at) >= 6 then 8 else 1 end)
       << (case when extract(hour from p_at) < 12 then 0 when extract(hour from p_at) < 17 then 1 else 2 end);
$$;
revoke execute on function app.slot_bit(timestamptz) from public, anon, authenticated;

-- Send the next invitation for one auto-match. Runs as the owner. Returns the new request,
-- or null when nobody is left.
create or replace function app.auto_match_next(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare
  a app.auto_matches%rowtype;
  v_cand uuid;
  v_court uuid;
  v_market uuid;
  v_hit uuid;
  v_prev_sub text := current_setting('request.jwt.claim.sub', true);
  v_prev_claims text := current_setting('request.jwt.claims', true);
begin
  select * into a from app.auto_matches where id = p_id and state = 'active';
  if a.id is null then return null; end if;
  perform app.act_as(a.owner_id);
  select market_id, coalesce(a.court_id, home_court_id) into v_market, v_court from app.profiles where id = a.owner_id;
  select d.profile_id into v_cand
    from app.discover(p_radius_m => a.radius_m, p_level_lo => a.level_lo, p_level_hi => a.level_hi,
                      p_availability => app.slot_bit(a.window_start), p_format => a.format, p_limit => 1000) d
   where not d.profile_id = any(a.tried)
     and not exists (select 1 from app.hit_requests h
                      where h.state in ('pending', 'countered', 'accepted', 'confirmed') and h.window_end > now()
                        and ((h.from_profile_id = a.owner_id and h.to_profile_id = d.profile_id)
                          or (h.to_profile_id = a.owner_id and h.from_profile_id = d.profile_id)))
   order by d.looking_to_hit desc, d.level_delta
   limit 1;
  if v_cand is null or v_court is null then
    perform app.act_back(v_prev_sub, v_prev_claims);
    return null;
  end if;
  if not app.can_request_hit(a.owner_id, v_cand)
     or not exists (select 1 from app.courts c where c.id = v_court and c.is_active and c.access <> 'private'
                      and (app.profile_band(a.owner_id) = 'adult' or c.access in ('public', 'club'))) then
    update app.auto_matches set tried = tried || v_cand, updated_at = now() where id = a.id;
    perform app.act_back(v_prev_sub, v_prev_claims);
    return app.auto_match_next(p_id);
  end if;
  insert into app.hit_requests (market_id, from_profile_id, to_profile_id, court_id, window_start, window_end, note, awaiting_profile_id, expires_at,
                                format, doubles_role)
  values (v_market, a.owner_id, v_cand, v_court, a.window_start, a.window_end,
          'Hits matched us: I am free then and we are close in level. Up for it?', v_cand,
          least(now() + interval '24 hours', a.window_start),
          a.format, case when a.format = 'doubles' then 'partner' end)
  returning id into v_hit;
  update app.auto_matches set tried = tried || v_cand, current_request_id = v_hit, updated_at = now() where id = a.id;
  perform app.act_back(v_prev_sub, v_prev_claims);
  return v_hit;
end;
$$;
revoke execute on function app.auto_match_next(uuid) from public, anon, authenticated;

create or replace function app.auto_match(p_start timestamptz, p_end timestamptz, p_level_lo numeric, p_level_hi numeric,
                                          p_radius_m int default 16093, p_format text default 'singles', p_court uuid default null)
returns uuid
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_id uuid;
  v_hit uuid;
begin
  if not app.is_plus(app.uid()) then
    raise exception 'plus_required:automatch Auto-match is part of Plus: Hits invites players for you, one at a time, until one says yes.';
  end if;
  if not app.is_participating(app.uid()) then raise exception 'finish setting up your profile first'; end if;
  if exists (select 1 from app.profiles where id = app.uid() and adult_at > current_date)
     and not exists (select 1 from app.guardian_links where minor_profile_id = app.uid() and verified_at is not null and revoked_at is null) then
    raise exception 'inviting unlocks when your parent says yes';
  end if;
  if p_start is null or p_start < now() + interval '1 hour' then raise exception 'pick a time at least an hour away'; end if;
  if p_start > now() + interval '14 days' then raise exception 'pick a time in the next two weeks'; end if;
  if p_end is null or p_end <= p_start or p_end > p_start + interval '4 hours' then raise exception 'a hit is up to four hours'; end if;
  if p_format not in ('singles', 'doubles') then raise exception 'singles or doubles'; end if;
  if exists (select 1 from app.auto_matches where owner_id = app.uid() and state = 'active') then
    raise exception 'one auto-match at a time; cancel the other first';
  end if;
  insert into app.auto_matches (owner_id, window_start, window_end, level_lo, level_hi, radius_m, format, court_id)
  values (app.uid(), p_start, p_end, p_level_lo, p_level_hi,
          (case when p_radius_m <= 8047 then 8047 when p_radius_m <= 16093 then 16093 when p_radius_m <= 24140 then 24140 else 40234 end),
          p_format, p_court)
  returning id into v_id;
  v_hit := app.auto_match_next(v_id);
  if v_hit is null then
    update app.auto_matches set state = 'expired', updated_at = now() where id = v_id;
    raise exception 'nobody near your level is free then; widen the level or the distance';
  end if;
  return v_id;
end;
$$;
revoke execute on function app.auto_match(timestamptz, timestamptz, numeric, numeric, int, text, uuid) from public, anon;
grant execute on function app.auto_match(timestamptz, timestamptz, numeric, numeric, int, text, uuid) to authenticated;

create or replace function app.cancel_auto_match(p_id uuid)
returns void
language plpgsql
security definer
set search_path = app, public
as $$
declare
  v_req uuid;
begin
  select current_request_id into v_req from app.auto_matches where id = p_id and owner_id = app.uid() and state = 'active';
  if not found then return; end if;
  update app.auto_matches set state = 'cancelled', updated_at = now() where id = p_id;
  update app.hit_requests set state = 'cancelled', awaiting_profile_id = null where id = v_req and state in ('pending', 'countered');
end;
$$;
revoke execute on function app.cancel_auto_match(uuid) from public, anon;
grant execute on function app.cancel_auto_match(uuid) to authenticated;

create or replace function app.my_auto_match()
returns table (id uuid, window_start timestamptz, window_end timestamptz, level_lo numeric, level_hi numeric, radius_m int,
               format text, court_id uuid, state text, tried int, current_request_id uuid, matched_request_id uuid, created_at timestamptz)
language sql
stable
security definer
set search_path = app, public
as $$
  select id, window_start, window_end, level_lo, level_hi, radius_m, format, court_id, state,
         coalesce(array_length(tried, 1), 0), current_request_id, matched_request_id, created_at
    from app.auto_matches
   where owner_id = app.uid() and (state = 'active' or updated_at > now() - interval '2 days')
   order by state = 'active' desc, updated_at desc
   limit 1;
$$;
revoke execute on function app.my_auto_match() from public, anon;
grant execute on function app.my_auto_match() to authenticated;

-- Every ten minutes: move each active auto-match along.
create or replace function app.advance_auto_matches()
returns int
language plpgsql
security definer
set search_path = app, public
as $$
declare
  a record;
  v_state app.hit_state;
  v_next uuid;
  v_moved int := 0;
begin
  for a in select * from app.auto_matches where state = 'active' loop
    select state into v_state from app.hit_requests where id = a.current_request_id;
    if v_state in ('accepted', 'confirmed', 'completed') then
      update app.auto_matches set state = 'done', matched_request_id = a.current_request_id, updated_at = now() where id = a.id;
      v_moved := v_moved + 1;
    elsif a.window_start < now() + interval '30 minutes' then
      update app.hit_requests set state = 'cancelled', awaiting_profile_id = null where id = a.current_request_id and state in ('pending', 'countered');
      update app.auto_matches set state = 'expired', updated_at = now() where id = a.id;
      perform app.enqueue(a.owner_id, 'automatch', 'Nobody could make it',
        to_char(a.window_start, 'Dy HH12am') || ' came and went without a yes. Try another time.', jsonb_build_object('automatch', a.id));
      v_moved := v_moved + 1;
    elsif v_state is null or v_state in ('declined', 'cancelled', 'expired') then
      v_next := app.auto_match_next(a.id);
      if v_next is null then
        update app.auto_matches set state = 'expired', updated_at = now() where id = a.id;
        perform app.enqueue(a.owner_id, 'automatch', 'Nobody left to ask',
          'Everyone who fits ' || to_char(a.window_start, 'Dy HH12am') || ' has been asked. Widen the level or the distance.', jsonb_build_object('automatch', a.id));
      end if;
      v_moved := v_moved + 1;
    end if;
  end loop;
  return v_moved;
end;
$$;
revoke execute on function app.advance_auto_matches() from public, anon, authenticated;
grant execute on function app.advance_auto_matches() to service_role;

-- 10. Schedules -----------------------------------------------------------------------------------
do $cron$
begin
  if to_regclass('pg_catalog.pg_extension') is null then return; end if;
  begin
    create extension if not exists pg_cron;
  exception when others then
    raise notice 'pg_cron unavailable here; skipping schedules';
    return;
  end;
  perform cron.unschedule(jobname) from cron.job where jobname in ('hits-saved-searches', 'hits-auto-match');
  perform cron.schedule('hits-saved-searches', '0 16 * * *',   $$select app.run_saved_searches()$$);
  perform cron.schedule('hits-auto-match',     '*/10 * * * *', $$select app.advance_auto_matches()$$);
end $cron$;

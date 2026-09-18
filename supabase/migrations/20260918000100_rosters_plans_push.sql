-- Rosters (one code brings a team), the planning window, push tokens, guardian-side
-- blocking, guardian link tracking, and the assurance a parent can honestly be given.

-- Guardian-side block: a verified guardian may block on their child's behalf. The row
-- is the child's, so it works exactly like the child having pressed the button.
create policy blocks_insert_guardian on app.blocks
  for insert to authenticated
  with check (app.is_guardian_of(blocker_id));

-- Guardian link speed: we send SMS and email, and record when the parent opened it so the
-- kid's screen can show the parent's side moving.
alter table app.guardian_links
  add column opened_at   timestamptz,
  add column sms_sent_at timestamptz,
  add column email_sent_at timestamptz;

alter table app.hit_guardian_approvals add column seen_at timestamptz;

-- The planning window: small one-tap choices the kids make while the parents decide.
alter table app.hit_requests add column plan jsonb not null default '{}'::jsonb;

-- Push tokens live with the private data: never readable by another client.
alter table app.profiles_private add column push_token text;

create or replace function app.set_push_token(p_token text)
returns void language plpgsql security definer set search_path = app, public as $$
begin
  insert into app.profiles_private (profile_id, push_token) values (app.uid(), p_token)
  on conflict (profile_id) do update set push_token = excluded.push_token, updated_at = now();
end; $$;
grant execute on function app.set_push_token(text) to authenticated;

-- Rosters ------------------------------------------------------------------------------
-- A coach, captain or academy creates one code with a name and a cap. Anyone redeeming it
-- joins tagged to the roster. Rosters carry NO visibility privilege (same rule as clubs):
-- they are a seeding and attribution mechanism, so density can be read by source.
create table app.rosters (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null check (length(name) between 2 and 60),
  code        citext not null unique,
  cap         int not null default 20 check (cap between 1 and 200),
  market_id   uuid references app.markets(id) on delete set null,
  created_by  uuid references app.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table app.profiles add column roster_id uuid references app.rosters(id) on delete set null;
alter table app.invites add column roster_id uuid references app.rosters(id) on delete set null;
create index profiles_roster_idx on app.profiles (roster_id);

alter table app.rosters enable row level security;
grant select on app.rosters to authenticated;
create policy rosters_select_own on app.rosters for select to authenticated
  using (created_by = app.uid() or id = (select roster_id from app.profiles where id = app.uid()));

create or replace function app.create_roster(p_name text, p_cap int default 20)
returns app.rosters language plpgsql security definer set search_path = app, public as $$
declare r app.rosters; v_code text; tries int := 0;
begin
  if not app.is_participating(app.uid()) then raise exception 'not participating'; end if;
  loop
    v_code := upper(regexp_replace(p_name, '[^A-Za-z]', '', 'g'));
    v_code := substr(v_code, 1, 5) || lpad((floor(random() * 90) + 10)::int::text, 2, '0');
    exit when not exists (select 1 from app.rosters x where x.code = v_code) or tries > 20;
    tries := tries + 1;
  end loop;
  insert into app.rosters (name, code, cap, market_id, created_by)
  select p_name, v_code, p_cap, p.market_id, p.id from app.profiles p where p.id = app.uid()
  returning * into r;
  return r;
end; $$;
grant execute on function app.create_roster(text, int) to authenticated;

create or replace function app.check_roster_code(p_code text)
returns table (valid boolean, roster_name text)
language sql stable security definer set search_path = app, public as $$
  select (count(p.id) < r.cap) as valid, r.name::text
    from app.rosters r left join app.profiles p on p.roster_id = r.id
   where r.code = p_code
   group by r.id, r.cap, r.name;
$$;
grant execute on function app.check_roster_code(text) to anon, authenticated;

create or replace function app.redeem_roster_code(p_code text)
returns void language plpgsql security definer set search_path = app, public as $$
declare rid uuid;
begin
  select r.id into rid from app.rosters r
   where r.code = p_code and (select count(*) from app.profiles p where p.roster_id = r.id) < r.cap;
  if rid is null then raise exception 'That code is full or unknown.'; end if;
  update app.profiles set roster_id = rid where id = app.uid() and roster_id is null;
end; $$;
grant execute on function app.redeem_roster_code(text) to authenticated;

-- Assurance ------------------------------------------------------------------------------
-- What a parent can honestly be told about the other side without identifying anyone:
-- tenure, track record, a clean report history. Aggregates only; only a verified guardian
-- of a participant may ask.
create or replace function app.hit_assurance(p_hit uuid)
returns table (
  other_guardian_verified boolean, other_guardian_months int, other_guardian_approvals int,
  other_player_hits int, other_player_reports int, other_player_member_months int,
  other_player_level_verified boolean, both_minors boolean
)
language plpgsql stable security definer set search_path = app, public as $$
declare h app.hit_requests; child uuid; other uuid; g app.guardian_links;
begin
  select * into h from app.hit_requests where id = p_hit;
  if h.id is null then return; end if;
  if app.is_guardian_of(h.from_profile_id) then child := h.from_profile_id; other := h.to_profile_id;
  elsif app.is_guardian_of(h.to_profile_id) then child := h.to_profile_id; other := h.from_profile_id;
  else raise exception 'not a guardian of a participant'; end if;

  select * into g from app.guardian_links gl
   where gl.minor_profile_id = other and gl.verified_at is not null and gl.revoked_at is null
   order by gl.verified_at limit 1;

  return query
  select
    g.id is not null,
    case when g.id is null then null else (extract(epoch from (now() - g.verified_at)) / 2629800)::int end,
    (select count(*)::int from app.hit_guardian_approvals a where a.guardian_user_id = g.guardian_user_id and a.decision is true),
    (select p.hits_confirmed from app.profiles p where p.id = other),
    (select count(*)::int from app.reports r where r.reported_profile_id = other and r.state <> 'dismissed'),
    (select (extract(epoch from (now() - p.created_at)) / 2629800)::int from app.profiles p where p.id = other),
    (select p.level_source = 'utr_verified' from app.profiles p where p.id = other),
    (app.profile_band(child) = 'minor' and app.profile_band(other) = 'minor');
end; $$;
grant execute on function app.hit_assurance(uuid) to authenticated;

-- Notification outbox ----------------------------------------------------------------------
-- Relevant only: request received, request accepted, guardian approval needed / given,
-- hit tomorrow. Rows are written by triggers; the notify edge function delivers them.
create table app.notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null,
  kind        text not null,
  title       text not null,
  body        text not null,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index notifications_unsent_idx on app.notifications (created_at) where sent_at is null;
alter table app.notifications enable row level security;   -- service_role only

create or replace function app.enqueue(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language sql as $$
  insert into app.notifications (user_id, kind, title, body, data) values (p_user, p_kind, p_title, p_body, p_data);
$$;

create or replace function app.notify_on_request()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare who text; court text;
begin
  select display_name into who from app.profiles where id = new.from_profile_id;
  select name into court from app.courts where id = new.court_id;
  perform app.enqueue(new.to_profile_id, 'request_received', who || ' wants to hit', to_char(new.window_start, 'Dy HH12am') || ' · ' || court, jsonb_build_object('hit', new.id));
  return null;
end; $$;
create trigger hit_requests_notify_new after insert on app.hit_requests for each row execute function app.notify_on_request();

create or replace function app.notify_on_state()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare who text; court text; a record;
begin
  select name into court from app.courts where id = new.court_id;
  if new.state = 'accepted' and old.state is distinct from 'accepted' then
    select display_name into who from app.profiles where id = new.to_profile_id;
    perform app.enqueue(new.from_profile_id, 'request_accepted', who || '''s in', 'Waiting on a parent to lock it in.', jsonb_build_object('hit', new.id));
    for a in select ga.guardian_user_id, p.display_name from app.hit_guardian_approvals ga join app.profiles p on p.id = ga.minor_profile_id where ga.hit_request_id = new.id loop
      perform app.enqueue(a.guardian_user_id, 'approval_needed', a.display_name || ' has a hit to approve', court || ' · ' || to_char(new.window_start, 'Dy HH12am'), jsonb_build_object('hit', new.id));
    end loop;
  elsif new.state = 'confirmed' and old.state is distinct from 'confirmed' then
    perform app.enqueue(new.from_profile_id, 'confirmed', 'It''s on.', court || ' · ' || to_char(new.window_start, 'Dy HH12am'), jsonb_build_object('hit', new.id));
    perform app.enqueue(new.to_profile_id, 'confirmed', 'It''s on.', court || ' · ' || to_char(new.window_start, 'Dy HH12am'), jsonb_build_object('hit', new.id));
  end if;
  return null;
end; $$;
create trigger hit_requests_notify_state after update of state on app.hit_requests for each row execute function app.notify_on_state();

-- "Hit tomorrow" is enqueued by a scheduled job (pg_cron or the edge function on a
-- schedule): confirmed hits whose window starts in 20-28 hours and have no reminder yet.
create or replace function app.enqueue_tomorrow_reminders()
returns int language plpgsql security definer set search_path = app, public as $$
declare n int := 0; h record;
begin
  for h in select r.*, c.name as court from app.hit_requests r join app.courts c on c.id = r.court_id
            where r.state = 'confirmed' and r.window_start between now() + interval '20 hours' and now() + interval '28 hours'
              and not exists (select 1 from app.notifications n where n.kind = 'hit_tomorrow' and (n.data->>'hit')::uuid = r.id) loop
    perform app.enqueue(h.from_profile_id, 'hit_tomorrow', 'Hit tomorrow', to_char(h.window_start, 'HH12am') || ' · ' || h.court, jsonb_build_object('hit', h.id));
    perform app.enqueue(h.to_profile_id, 'hit_tomorrow', 'Hit tomorrow', to_char(h.window_start, 'HH12am') || ' · ' || h.court, jsonb_build_object('hit', h.id));
    n := n + 1;
  end loop;
  return n;
end; $$;

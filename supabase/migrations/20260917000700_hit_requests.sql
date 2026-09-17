-- Hit requests, threads, guardian approvals and confirmations.

create table app.hit_requests (
  id                 uuid primary key default uuid_generate_v4(),
  market_id          uuid not null references app.markets(id) on delete restrict,
  from_profile_id    uuid not null references app.profiles(id) on delete cascade,
  to_profile_id      uuid not null references app.profiles(id) on delete cascade,
  court_id           uuid not null references app.courts(id) on delete restrict,
  window_start       timestamptz not null,
  window_end         timestamptz not null,
  note               text,
  state              app.hit_state not null default 'pending',
  -- Whose turn it is. Flips on every counter, so "waiting on you" is a column rather
  -- than something the client has to infer.
  awaiting_profile_id uuid references app.profiles(id) on delete set null,
  -- Requests expire so the feed does not fill with zombies.
  expires_at         timestamptz not null default now() + interval '72 hours',
  responded_at       timestamptz,
  confirmed_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (from_profile_id <> to_profile_id),
  check (window_end > window_start)
);

create index hit_requests_to_idx on app.hit_requests (to_profile_id, state);
create index hit_requests_from_idx on app.hit_requests (from_profile_id, state);
create index hit_requests_open_idx on app.hit_requests (expires_at)
  where state in ('pending', 'countered');

-- Counters rewrite court/window on the row; the log keeps the negotiation auditable
-- (and lets a guardian see what changed after they approved).
create table app.hit_request_revisions (
  id              uuid primary key default uuid_generate_v4(),
  hit_request_id  uuid not null references app.hit_requests(id) on delete cascade,
  by_profile_id   uuid not null references app.profiles(id) on delete cascade,
  court_id        uuid not null references app.courts(id),
  window_start    timestamptz not null,
  window_end      timestamptz not null,
  created_at      timestamptz not null default now()
);

-- Threads are scoped to a hit, not a permanent inbox. Messaging exists to close a
-- request, not to host conversations.
create table app.hit_messages (
  id                uuid primary key default uuid_generate_v4(),
  hit_request_id    uuid not null references app.hit_requests(id) on delete cascade,
  sender_profile_id uuid not null references app.profiles(id) on delete cascade,
  body              text not null check (length(body) between 1 and 2000),
  created_at        timestamptz not null default now()
);

create index hit_messages_thread_idx on app.hit_messages (hit_request_id, created_at);

-- The one required guardian action, at exactly one point: immediately before a
-- real-world meeting. One row per minor participant.
create table app.hit_guardian_approvals (
  hit_request_id   uuid not null references app.hit_requests(id) on delete cascade,
  minor_profile_id uuid not null references app.profiles(id) on delete cascade,
  guardian_user_id uuid not null,
  decision         boolean,
  decided_at       timestamptz,
  created_at       timestamptz not null default now(),
  primary key (hit_request_id, minor_profile_id)
);

create table app.hit_confirmations (
  hit_request_id uuid not null references app.hit_requests(id) on delete cascade,
  profile_id     uuid not null references app.profiles(id) on delete cascade,
  did_play       boolean not null,
  created_at     timestamptz not null default now(),
  primary key (hit_request_id, profile_id)
);

-- Participation predicates ------------------------------------------------------------

create or replace function app.is_hit_participant(p_hit uuid)
returns boolean
language sql stable security definer set search_path = app, public
as $$
  select exists (
    select 1 from app.hit_requests h
     where h.id = p_hit
       and app.uid() in (h.from_profile_id, h.to_profile_id)
  );
$$;

create or replace function app.is_hit_guardian(p_hit uuid)
returns boolean
language sql stable security definer set search_path = app, public
as $$
  select exists (
    select 1 from app.hit_requests h
     where h.id = p_hit
       and (app.is_guardian_of(h.from_profile_id) or app.is_guardian_of(h.to_profile_id))
  );
$$;

-- Guardian approval gate ---------------------------------------------------------------
--
-- A hit reaches 'confirmed' only when every minor participant has an approved guardian
-- row. Enforced by trigger rather than by the client, because the client is not the
-- place to enforce the one rule a parent is trusting the product with.
create or replace function app.all_guardian_approvals_present(p_hit uuid)
returns boolean
language sql stable security definer set search_path = app, public
as $$
  select not exists (
    select 1
      from app.hit_requests h
      join app.profiles p
        on p.id in (h.from_profile_id, h.to_profile_id)
     where h.id = p_hit
       and p.adult_at > current_date                       -- p is a minor
       and not exists (
         select 1 from app.hit_guardian_approvals a
          where a.hit_request_id = h.id
            and a.minor_profile_id = p.id
            and a.decision is true
       )
  );
$$;

create or replace function app.guard_hit_state()
returns trigger
language plpgsql
security definer
set search_path = app, public
as $$
begin
  if new.state = 'confirmed' and old.state is distinct from 'confirmed' then
    if not app.all_guardian_approvals_present(new.id) then
      raise exception 'hit cannot be confirmed until every minor participant has guardian approval';
    end if;
    new.confirmed_at := now();
  end if;

  -- A counter after approval invalidates that approval: the guardian approved a
  -- specific court and time, not a blank cheque.
  if (new.court_id is distinct from old.court_id
      or new.window_start is distinct from old.window_start
      or new.window_end is distinct from old.window_end) then
    delete from app.hit_guardian_approvals where hit_request_id = new.id;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger hit_requests_guard_state
  before update on app.hit_requests
  for each row execute function app.guard_hit_state();

-- Ghost-suppression signals -------------------------------------------------------------
--
-- Response and accept rates are derived from the request lifecycle, never self-reported.

create or replace function app.bump_requests_received()
returns trigger language plpgsql security definer set search_path = app, public as $$
begin
  update app.profiles
     set requests_received = requests_received + 1
   where id = new.to_profile_id;
  return new;
end;
$$;

create trigger hit_requests_bump_received
  after insert on app.hit_requests
  for each row execute function app.bump_requests_received();

create or replace function app.bump_response_stats()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  responder uuid;
  minutes   int;
begin
  if old.state in ('pending', 'countered')
     and new.state in ('accepted', 'declined', 'countered')
     and new.state is distinct from old.state then
    responder := coalesce(old.awaiting_profile_id, new.to_profile_id);
    minutes := greatest(0, (extract(epoch from (now() - old.created_at)) / 60)::int);

    update app.profiles
       set requests_responded = requests_responded + 1,
           requests_accepted = requests_accepted + (case when new.state = 'accepted' then 1 else 0 end),
           median_response_minutes = case
             when median_response_minutes is null then minutes
             else ((median_response_minutes + minutes) / 2)::int   -- running approximation
           end
     where id = responder;

    new.responded_at := coalesce(new.responded_at, now());
  end if;
  return new;
end;
$$;

create trigger hit_requests_bump_response
  before update on app.hit_requests
  for each row execute function app.bump_response_stats();

-- A hit counts only when both sides say it happened. This is the one metric:
-- confirmed hits per active user per month.
create or replace function app.apply_hit_confirmation()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  both_confirmed boolean;
begin
  select count(*) filter (where did_play) = 2
    into both_confirmed
    from app.hit_confirmations where hit_request_id = new.hit_request_id;

  if both_confirmed then
    update app.hit_requests set state = 'completed' where id = new.hit_request_id;
    update app.profiles p
       set hits_confirmed = hits_confirmed + 1
      from app.hit_requests h
     where h.id = new.hit_request_id
       and p.id in (h.from_profile_id, h.to_profile_id);
  end if;
  return new;
end;
$$;

create trigger hit_confirmations_apply
  after insert on app.hit_confirmations
  for each row execute function app.apply_hit_confirmation();

-- Approval rows are created by the server the moment a hit is accepted, one per minor
-- participant, addressed to their verified guardian. The guardian never has to go
-- looking for anything: accepting a hit is what puts the decision in front of them.
create or replace function app.seed_guardian_approvals()
returns trigger language plpgsql security definer set search_path = app, public as $$
begin
  insert into app.hit_guardian_approvals (hit_request_id, minor_profile_id, guardian_user_id)
  select new.id, p.id, g.guardian_user_id
    from app.profiles p
    join app.guardian_links g
      on g.minor_profile_id = p.id
     and g.verified_at is not null
     and g.revoked_at is null
     and g.guardian_user_id is not null
   where p.id in (new.from_profile_id, new.to_profile_id)
     and p.adult_at > current_date
  on conflict (hit_request_id, minor_profile_id) do nothing;

  -- An adult-only hit has no approvals outstanding, so it confirms immediately. A hit
  -- with a minor waits here -- accepted, but not confirmed, and the court and time are
  -- not presented as locked until a guardian says so.
  if app.all_guardian_approvals_present(new.id) then
    update app.hit_requests set state = 'confirmed' where id = new.id;
  end if;
  return null;
end;
$$;

create trigger hit_requests_seed_approvals
  after update of state on app.hit_requests
  for each row when (new.state = 'accepted' and old.state is distinct from 'accepted')
  execute function app.seed_guardian_approvals();

create or replace function app.apply_guardian_decision()
returns trigger language plpgsql security definer set search_path = app, public as $$
begin
  if new.decision is not null and new.decided_at is null then
    new.decided_at := now();
  end if;
  return new;
end;
$$;

create trigger hit_guardian_approvals_stamp
  before update on app.hit_guardian_approvals
  for each row execute function app.apply_guardian_decision();

create or replace function app.maybe_confirm_hit()
returns trigger language plpgsql security definer set search_path = app, public as $$
begin
  if new.decision is true and app.all_guardian_approvals_present(new.hit_request_id) then
    update app.hit_requests
       set state = 'confirmed'
     where id = new.hit_request_id and state = 'accepted';
  elsif new.decision is false then
    update app.hit_requests
       set state = 'declined'
     where id = new.hit_request_id and state in ('accepted', 'pending', 'countered');
  end if;
  return null;
end;
$$;

create trigger hit_guardian_approvals_confirm
  after update on app.hit_guardian_approvals
  for each row execute function app.maybe_confirm_hit();

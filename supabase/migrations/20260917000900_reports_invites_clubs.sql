-- Moderation, invites, and the reserved club shape.

create table app.reports (
  id                  uuid primary key default uuid_generate_v4(),
  reporter_profile_id uuid not null references app.profiles(id) on delete set null,
  reported_profile_id uuid not null references app.profiles(id) on delete cascade,
  hit_request_id      uuid references app.hit_requests(id) on delete set null,
  reason              app.report_reason not null,
  body                text,
  state               app.report_state not null default 'open',
  -- Reports touching a minor's thread are priority. A report button with nobody behind
  -- it is worse than no report button: it manufactures false confidence.
  involves_minor      boolean not null default false,
  reviewed_by         uuid,
  reviewed_at         timestamptz,
  resolution          text,
  created_at          timestamptz not null default now()
);

create index reports_queue_idx on app.reports (state, involves_minor desc, created_at);
create index reports_reported_idx on app.reports (reported_profile_id);

create or replace function app.flag_report_minor()
returns trigger language plpgsql security definer set search_path = app, public as $$
begin
  new.involves_minor := (
    app.profile_band(new.reporter_profile_id) = 'minor'
    or app.profile_band(new.reported_profile_id) = 'minor'
  );
  return new;
end;
$$;

create trigger reports_flag_minor
  before insert on app.reports
  for each row execute function app.flag_report_minor();

-- Auto-protective hiding. Erring toward false positives is correct here: the cost of
-- wrongly hiding a profile for a day is an annoyed user, and the cost of the other
-- error is not comparable.
create or replace function app.auto_hide_reported()
returns trigger language plpgsql security definer set search_path = app, public as $$
declare
  recent_reporters int;
begin
  select count(distinct reporter_profile_id) into recent_reporters
    from app.reports
   where reported_profile_id = new.reported_profile_id
     and created_at > now() - interval '30 days';

  if recent_reporters >= 3 then
    update app.profiles set status = 'suspended'
     where id = new.reported_profile_id and status = 'active';
  end if;
  return new;
end;
$$;

create trigger reports_auto_hide
  after insert on app.reports
  for each row execute function app.auto_hide_reported();

-- Invite codes. Not primarily a growth gimmick: this is the density mechanism. Codes
-- propagate along real tennis networks (teams, clubs, junior circuits), which is how a
-- market gets local liquidity instead of a thin national spread.
create table app.invites (
  code                citext primary key,
  issued_by_profile_id uuid references app.profiles(id) on delete set null,
  market_id           uuid references app.markets(id) on delete set null,
  -- Codes are issued into a cohort so junior recruiting and adult recruiting stay
  -- separately measurable (see docs/06-seeding-strategy.md).
  intended_band       app.age_band,
  redeemed_by_profile_id uuid references app.profiles(id) on delete set null,
  redeemed_at         timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz not null default now()
);

create index invites_issuer_idx on app.invites (issued_by_profile_id);

-- Reserved shape, no privilege. Club-scoped cross-band visibility is the best long-term
-- relaxation of the separation rule, but it is downstream of real club verification:
-- until verified_at is set by an actual verification flow, "same club" would be a
-- self-declared text field, and a self-declared affiliation that unlocks contact with
-- minors is the most dangerous thing that could ship. These tables grant nothing in v1.
create table app.clubs (
  id          uuid primary key default uuid_generate_v4(),
  market_id   uuid references app.markets(id) on delete set null,
  name        text not null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table app.club_memberships (
  club_id     uuid not null references app.clubs(id) on delete cascade,
  profile_id  uuid not null references app.profiles(id) on delete cascade,
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (club_id, profile_id)
);

comment on table app.club_memberships is
  'v1: carries NO visibility privilege. Reserved for post-verification cross-band relaxation.';

alter table app.reports           enable row level security;
alter table app.invites           enable row level security;
alter table app.clubs             enable row level security;
alter table app.club_memberships  enable row level security;

grant select, insert on app.reports to authenticated;
grant select on app.invites to authenticated;
grant select on app.clubs, app.club_memberships to authenticated;

-- You can always report someone, including someone you can no longer see.
create policy reports_insert_own on app.reports
  for insert to authenticated
  with check (reporter_profile_id = app.uid());

-- Reporters see their own reports and nothing else. The queue is service_role only:
-- the moderation surface is not a client feature.
create policy reports_select_own on app.reports
  for select to authenticated
  using (reporter_profile_id = app.uid());

create policy invites_select_own on app.invites
  for select to authenticated
  using (issued_by_profile_id = app.uid() or redeemed_by_profile_id = app.uid());

create policy clubs_select_all on app.clubs
  for select to authenticated using (true);

create policy club_memberships_select_own on app.club_memberships
  for select to authenticated using (profile_id = app.uid());

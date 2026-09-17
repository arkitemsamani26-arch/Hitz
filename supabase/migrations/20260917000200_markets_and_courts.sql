-- Markets and the court directory.
--
-- A market is a first-class object, not a config constant, because Hits launches one
-- market at a time and each one has to prove its own density before discovery opens.

create table app.markets (
  id          uuid primary key default uuid_generate_v4(),
  slug        citext not null unique,
  name        text not null,
  center      geography(Point, 4326) not null,
  radius_m    int not null default 40234,          -- ~25 miles
  timezone    text not null default 'America/New_York',
  created_at  timestamptz not null default now()
);

-- Density is measured and gated PER COHORT, never per market.
--
-- See docs/06-seeding-strategy.md. Adult signups must not be able to open discovery for
-- juniors: a junior whose first session shows eleven people does not come back, and that
-- first impression is only spent once. Each (market, age_band) clears its own bar.
create table app.market_cohorts (
  market_id          uuid not null references app.markets(id) on delete cascade,
  age_band           app.age_band not null,
  min_active_players int not null default 200,     -- configurable per cohort, on purpose
  discovery_open     boolean not null default false,
  opened_at          timestamptz,
  primary key (market_id, age_band)
);

create table app.courts (
  id          uuid primary key default uuid_generate_v4(),
  market_id   uuid not null references app.markets(id) on delete restrict,
  name        text not null,
  point       geography(Point, 4326) not null,
  access      app.court_access not null default 'public',
  surface     text,
  indoor      boolean not null default false,
  address     text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index courts_point_idx on app.courts using gist (point);
create index courts_market_idx on app.courts (market_id) where is_active;

-- Hit locations are drawn from this directory only; free-text locations are never
-- accepted. Residences are not courts. 'private' exists so the enum does not need
-- changing later, but nothing in v1 may reference a private court.
comment on table app.courts is
  'Curated public/club court directory. Never contains residential addresses.';

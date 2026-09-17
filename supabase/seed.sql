-- Boston metro seed: the launch market.
--
-- Anchored on Wellesley/Babson. Both cohorts start CLOSED -- discovery opens per cohort
-- only when that cohort clears its own density threshold, so adult signups can never
-- open the feed for juniors. See docs/06-seeding-strategy.md.

insert into app.markets (id, slug, name, center, radius_m, timezone)
values (
  '11111111-1111-1111-1111-111111111111',
  'boston',
  'Boston Metro',
  ST_SetSRID(ST_MakePoint(-71.2920, 42.2960), 4326)::geography,  -- Wellesley
  40234,                                                          -- ~25 miles
  'America/New_York'
)
on conflict (slug) do nothing;

insert into app.market_cohorts (market_id, age_band, min_active_players, discovery_open)
values
  -- The wedge. Recruited through academies, high school teams and USTA New England
  -- junior circuits -- in clusters, a whole team at a time.
  ('11111111-1111-1111-1111-111111111111', 'minor', 200, false),
  -- Parallel and self-funding, seeded through the Babson team and its opponents.
  -- Opens on its own count, whenever that happens.
  ('11111111-1111-1111-1111-111111111111', 'adult', 200, false)
on conflict (market_id, age_band) do nothing;

-- Court directory. Public and club facilities only -- never a residential address.
-- Indoor coverage matters here: Boston's junior season runs through the winter.
insert into app.courts (market_id, name, point, access, surface, indoor) values
  ('11111111-1111-1111-1111-111111111111', 'Wellesley High School Courts',
   ST_SetSRID(ST_MakePoint(-71.2856, 42.2968), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Babson College Courts',
   ST_SetSRID(ST_MakePoint(-71.2650, 42.2970), 4326)::geography, 'club', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Needham High School Courts',
   ST_SetSRID(ST_MakePoint(-71.2360, 42.2790), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Weston Town Courts',
   ST_SetSRID(ST_MakePoint(-71.3030, 42.3670), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Newton Commonwealth Courts',
   ST_SetSRID(ST_MakePoint(-71.2100, 42.3400), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Dover-Sherborn Regional Courts',
   ST_SetSRID(ST_MakePoint(-71.2820, 42.2460), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Natick High School Courts',
   ST_SetSRID(ST_MakePoint(-71.3490, 42.2830), 4326)::geography, 'public', 'hard', false),
  ('11111111-1111-1111-1111-111111111111', 'Brookline High Courts',
   ST_SetSRID(ST_MakePoint(-71.1220, 42.3320), 4326)::geography, 'public', 'hard', false)
on conflict do nothing;

-- NOTE: court coordinates above are approximate placeholders for local development.
-- Verify every location against the real facility before the directory ships -- a hit
-- request sends two people to a physical place, so a wrong pin is a real-world problem.

-- Palo Alto / Peninsula seed: the launch market.
--
-- Extremely dense junior tennis, year-round outdoor play, and a lot of high-level players
-- packed into a small radius. The cohort threshold is 150 actives inside a default 10-mile
-- circle (Menlo Park to Sunnyvale) -- density x activity, not headcount. Both cohorts
-- start CLOSED; each opens on its own count. See docs/06-seeding-strategy.md.

insert into app.markets (id, slug, name, center, radius_m, timezone)
values (
  '22222222-2222-2222-2222-222222222222',
  'palo-alto',
  'Palo Alto',
  ST_SetSRID(ST_MakePoint(-122.1430, 37.4419), 4326)::geography,   -- downtown Palo Alto
  16093,                                                            -- 10 miles
  'America/Los_Angeles'
)
on conflict (slug) do nothing;

insert into app.market_cohorts (market_id, age_band, min_active_players, discovery_open) values
  ('22222222-2222-2222-2222-222222222222', 'minor', 150, false),
  ('22222222-2222-2222-2222-222222222222', 'adult', 150, false)
on conflict (market_id, age_band) do nothing;

-- Court directory. Public parks and known centers only -- never a residence.
insert into app.courts (market_id, name, point, access, surface, indoor) values
  ('22222222-2222-2222-2222-222222222222', 'Rinconada Park',          ST_SetSRID(ST_MakePoint(-122.1500, 37.4460), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Mitchell Park',           ST_SetSRID(ST_MakePoint(-122.1090, 37.4210), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Cubberley Courts',        ST_SetSRID(ST_MakePoint(-122.1030, 37.4160), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Burgess Park',            ST_SetSRID(ST_MakePoint(-122.1830, 37.4520), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Nealon Park',             ST_SetSRID(ST_MakePoint(-122.1970, 37.4420), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Stanford Taube Courts',   ST_SetSRID(ST_MakePoint(-122.1600, 37.4340), 4326)::geography, 'club',   'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Cuesta Park',             ST_SetSRID(ST_MakePoint(-122.0790, 37.3800), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Sunnyvale Tennis Center', ST_SetSRID(ST_MakePoint(-122.0270, 37.3650), 4326)::geography, 'club',   'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Los Altos Hills Courts',  ST_SetSRID(ST_MakePoint(-122.1370, 37.3790), 4326)::geography, 'public', 'hard', false),
  ('22222222-2222-2222-2222-222222222222', 'Cupertino Tennis Center', ST_SetSRID(ST_MakePoint(-122.0560, 37.3120), 4326)::geography, 'club',   'hard', false)
on conflict do nothing;

-- NOTE: coordinates are approximate placeholders. Verify each pin against the real facility
-- before the directory ships: a hit request sends two people to a physical place.

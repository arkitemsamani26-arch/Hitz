-- Test fixtures. Applied as the owner, so RLS is bypassed while seeding.
--
-- Cast:
--   a01 junior A (16), guardian-verified
--   a02 junior B (16), guardian-verified
--   a03 junior C (15), NO verified guardian -- must be invisible and unable to act
--   b01 adult A (25)
--   b02 adult B (30)
--   c01 guardian user, verified guardian of a01 and a02
--   d01 Boston (both cohorts open)  d02 Seedling (minor cohort closed)

set search_path = app, public;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'juniora@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'juniorb@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'juniorc@example.test'),
  ('00000000-0000-0000-0000-0000000000b1', 'adulta@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'adultb@example.test'),
  ('00000000-0000-0000-0000-0000000000c1', 'guardian@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'juniord@example.test');

insert into app.markets (id, slug, name, center) values
  ('00000000-0000-0000-0000-0000000000d1', 'boston', 'Boston Metro',
   ST_SetSRID(ST_MakePoint(-71.2920, 42.2960), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000d2', 'seedling', 'Seedling Market',
   ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326)::geography);

insert into app.market_cohorts (market_id, age_band, min_active_players, discovery_open) values
  ('00000000-0000-0000-0000-0000000000d1', 'minor', 200, true),
  ('00000000-0000-0000-0000-0000000000d1', 'adult', 200, true),
  -- The junior cohort here has not cleared its threshold: members get an honest
  -- waiting state, not a thin feed.
  ('00000000-0000-0000-0000-0000000000d2', 'minor', 200, false),
  ('00000000-0000-0000-0000-0000000000d2', 'adult', 200, true);

insert into app.courts (id, market_id, name, point, access) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1',
   'Wellesley Town Courts', ST_SetSRID(ST_MakePoint(-71.2920, 42.2960), 4326)::geography, 'public'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d1',
   'Babson Indoor', ST_SetSRID(ST_MakePoint(-71.2650, 42.2970), 4326)::geography, 'club'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d1',
   'Private Estate Court', ST_SetSRID(ST_MakePoint(-71.3000, 42.3000), 4326)::geography, 'private');

insert into app.profiles
  (id, market_id, display_name, last_initial, date_of_birth, level_value, level_source,
   home_court_id, availability_mask, phone_verified_at, looking_to_hit_until)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1',
   'Junior', 'A', current_date - interval '16 years', 8.50, 'utr_self',
   '00000000-0000-0000-0000-0000000000e1', 8, now(), now() + interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d1',
   'Junior', 'B', current_date - interval '16 years', 8.70, 'utr_self',
   '00000000-0000-0000-0000-0000000000e1', 8, now(), now() + interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000d1',
   'Junior', 'C', current_date - interval '15 years', 5.00, 'estimated',
   '00000000-0000-0000-0000-0000000000e1', 8, now(), null),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000d2',
   'Junior', 'D', current_date - interval '16 years', 8.40, 'utr_self',
   null, 8, now(), null),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1',
   'Adult', 'A', current_date - interval '25 years', 9.00, 'utr_self',
   '00000000-0000-0000-0000-0000000000e1', 8, now(), null),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d1',
   'Adult', 'B', current_date - interval '30 years', 8.60, 'utr_self',
   '00000000-0000-0000-0000-0000000000e1', 8, now(), null);

-- Real locations, a few miles apart around Wellesley. The trigger derives snapped_point.
insert into app.profiles_private (profile_id, exact_point) values
  ('00000000-0000-0000-0000-0000000000a1', ST_SetSRID(ST_MakePoint(-71.2920, 42.2960), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000a2', ST_SetSRID(ST_MakePoint(-71.2731, 42.3012), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000a3', ST_SetSRID(ST_MakePoint(-71.3100, 42.2800), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000a4', ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000b1', ST_SetSRID(ST_MakePoint(-71.2850, 42.2990), 4326)::geography),
  ('00000000-0000-0000-0000-0000000000b2', ST_SetSRID(ST_MakePoint(-71.2600, 42.3100), 4326)::geography);

-- a01 and a02 have verified guardians; a03 deliberately does not.
insert into app.guardian_links
  (minor_profile_id, guardian_user_id, guardian_email, relationship, verified_at)
values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1',
   'guardian@example.test', 'parent', now()),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1',
   'guardian@example.test', 'parent', now());

insert into app.guardian_links (minor_profile_id, guardian_email, relationship) values
  ('00000000-0000-0000-0000-0000000000a3', 'unverified@example.test', 'parent');

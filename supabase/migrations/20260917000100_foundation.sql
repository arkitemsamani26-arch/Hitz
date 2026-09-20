-- Foundation: extensions, private schema, enums.
--
-- `app` is the private schema. Helper functions live here as SECURITY DEFINER so they
-- can be called from RLS policies on the very tables they read without recursing.
-- Nothing in `app` is granted to anon/authenticated except the explicit RPCs.

create extension if not exists postgis;
create extension if not exists "uuid-ossp";
create extension if not exists citext;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

create type app.age_band as enum ('minor', 'adult');

-- Where a rating came from. Present from day one so UTR linking is a data migration
-- later, not a schema change. v1 only ever writes 'utr_self' or 'estimated'.
create type app.level_source as enum ('utr_verified', 'utr_self', 'estimated');

create type app.profile_status as enum ('active', 'paused', 'suspended', 'deleted');

create type app.court_access as enum ('public', 'club', 'private');

-- The hit request state machine.
--   pending   -> accepted | declined | countered | cancelled | expired
--   countered -> accepted | declined | countered | cancelled | expired
--   accepted  -> confirmed (only once every minor participant has guardian approval)
--   confirmed -> completed | cancelled
--
-- 'accepted' vs 'confirmed' is the core product thesis in schema form: the players
-- accept, the guardian confirms. Nothing tells a minor where to be and when until a
-- guardian has approved that specific meeting.
create type app.hit_state as enum (
  'pending', 'countered', 'accepted', 'confirmed',
  'declined', 'cancelled', 'expired', 'completed'
);

create type app.report_reason as enum (
  'fake_profile', 'inappropriate_messages', 'age_misrepresentation',
  'no_show', 'safety_concern', 'other'
);

create type app.report_state as enum ('open', 'reviewing', 'actioned', 'dismissed');

-- Availability is a coarse bitmask, not a calendar. Calendars are where scheduling
-- apps go to die.
--   1 = weekday mornings, 2 = weekday afternoons, 4 = weekday evenings,
--   8 = weekend mornings, 16 = weekend afternoons, 32 = weekend evenings
create domain app.availability_mask as int
  check (value >= 0 and value < 64);

-- Ratings are stored on the UTR scale (1.00-16.50) regardless of source.
create domain app.level_value as numeric(4,2)
  check (value >= 1.00 and value <= 16.50);

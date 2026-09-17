-- Guardian links and blocks.
--
-- Guardian approves the hit, not the conversation. That sentence is the product thesis,
-- so it is worth being precise about what this table does and does not gate:
--
--   * A verified guardian link is required before a minor is discoverable or can send
--     anything at all. No link, no participation.
--   * Once linked, the kids browse, request, accept and chat without an adult in the
--     loop. The fast, fun part stays theirs.
--   * The guardian has full visibility (profile, requests, threads) and exactly one
--     required action: approving the specific hit before it is confirmed -- the moment
--     immediately before a real-world meeting.
--
-- Parents stop being the coordination layer and become the approval layer.

create table app.guardian_links (
  id                 uuid primary key default uuid_generate_v4(),
  minor_profile_id   uuid not null references app.profiles(id) on delete cascade,
  guardian_user_id   uuid,                            -- = auth.users.id once they sign up
  guardian_email     citext not null,
  guardian_phone     text,
  relationship       text,
  invited_at         timestamptz not null default now(),
  verified_at        timestamptz,
  revoked_at         timestamptz,
  created_at         timestamptz not null default now()
);

create unique index guardian_links_active_idx
  on app.guardian_links (minor_profile_id, guardian_email)
  where revoked_at is null;
create index guardian_links_guardian_idx
  on app.guardian_links (guardian_user_id) where verified_at is not null and revoked_at is null;
create index guardian_links_minor_idx on app.guardian_links (minor_profile_id);

-- One guardian may link multiple children; revocation is a timestamp rather than a
-- delete so that a revoked link remains auditable.

create table app.blocks (
  blocker_id  uuid not null references app.profiles(id) on delete cascade,
  blocked_id  uuid not null references app.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on app.blocks (blocked_id);

-- Blocking is bidirectional in effect: each disappears from the other's discovery and
-- neither can reach the other, regardless of who pressed the button.
comment on table app.blocks is
  'Effect is symmetric even though the row is directional.';

# Hits

**Find your next tennis match.**

UTR solved "how good is this player, really." Nobody solved "how do I actually find
that player and get on a court with them this week." Hits is that layer: discovery
and connection for tennis players, built on top of ratings that already exist.

The core loop is one sentence long:

> Open the app → see good players near you at your level → send a hit request → it's on the calendar.

Anything that doesn't serve that loop is not v1.

## What Hits is not

- **Not a rating system.** UTR (or a self-reported level) is an *input*. We will never
  compute a competing number. Rebuilding UTR is both a losing fight and beside the point.
- **Not tournament or league management.** Draws, brackets, scheduling engines — no.
- **Not a stats tracker.** We are not trying to be Strava for tennis. Light "hits this
  month" texture, yes; a dashboard of your winners and unforced errors, no.
- **Not a DM app.** Messaging exists to close a hit request, not to host conversations.

## The one metric

**Confirmed hits per active user per month.**

Not signups. Not DAU. Not messages sent. A hit that both sides confirmed happened.
Above ~1.5 in a seeded market, Hits works; below 0.5, no amount of design saves it.

Secondary diagnostics: request→accept rate, time-to-first-reply, and the percentage of
users who get a reply *at all* — that last one is the loneliness metric, and it's the one
that kills marketplaces quietly.

## Status

The app (Expo), schema, RLS policies and the safety test suite are in. The docs, in order:

| Doc | What's in it |
| --- | --- |
| [`docs/01-product-scope.md`](docs/01-product-scope.md) | MVP (core loop) vs. full vision, and what gets deliberately cut |
| [`docs/02-design-directions.md`](docs/02-design-directions.md) | Three distinct visual/motion directions with reasoning, plus a recommendation |
| [`docs/03-tech-stack.md`](docs/03-tech-stack.md) | Recommended stack, alternatives considered, data model sketch |
| [`docs/04-safety-by-design.md`](docs/04-safety-by-design.md) | Minor-safety architecture — designed in, not bolted on |
| [`docs/05-open-questions.md`](docs/05-open-questions.md) | UTR API findings, payments call, and the decisions that need your input |

| [`docs/06-seeding-strategy.md`](docs/06-seeding-strategy.md) | Resolving the strict-separation vs. seed-network contradiction |
| [`docs/07-build-notes.md`](docs/07-build-notes.md) | First build: decisions, compromises |
| [`docs/08-center-court-pass.md`](docs/08-center-court-pass.md) | Redesign to Center Court, Palo Alto, and the open items |
| [`docs/09-supabase-setup.md`](docs/09-supabase-setup.md) | Standing up a live project |

Read `01` and `04` first — they constrain everything else.

## Repo layout

```
supabase/migrations/   schema, RLS policies, triggers, discovery RPC
supabase/tests/        pgTAP suite -- the RLS policy tests are the point
supabase/seed.sql      Palo Alto market, cohorts (both closed), court directory
supabase/functions/    notify edge function (push delivery)
scripts/db-test.sh     apply migrations to a scratch DB and run the suite
```

## See it running

**In a browser, no setup:** the demo build is published as an artifact (link in the
session). It runs against an in-memory backend seeded with Palo Alto players; other
players reply on a short delay so the whole loop closes. Any phone number works, the
code is `000000`, and the team code `PALY26` works. Enter a birthday under 18 to see the guardian flow; the You tab has
demo controls for the parent's view and the cohort-closed state.

**Locally:**

```bash
npm install
npm run demo        # Expo web, demo backend, opens in your browser
npm start           # then scan the QR with Expo Go on your phone (demo backend)
```

**Against Supabase:** a live project exists and has the schema, seed and edge functions
(`docs/09-supabase-setup.md`). Finish the dashboard steps there (expose the `app` schema,
turn on phone auth), then:

```bash
cp .env.example .env && npm start
```

The Supabase client's RPC and column names are pinned by `supabase/tests/08_app_contract.sql`,
so a rename on either side fails CI rather than a phone.

## Running the tests

A minor-safety rule that isn't tested isn't a rule, so the RLS policies have an
adversarial test suite that runs in CI and blocks the branch on failure. It needs
PostgreSQL 16 with PostGIS and pgTAP:

```bash
sudo apt-get install -y postgresql-16 postgresql-16-postgis-3 postgresql-16-pgtap
./scripts/db-test.sh
```

The suite asks the hostile version of each question — not "does the UI hide minors from
adults" but "can an adult's session reach a minor's row by *any* query the client can
construct."

## Current state of the build

| Step | Status |
| --- | --- |
| 1. Schema, PostGIS, RLS (incl. no-client-select coordinates) | done, 109 assertions passing, applied to the live project |
| 2. Auth, DOB gate, guardian linking | app built; Supabase wiring untested against a live project |
| 3. Profile, home court, availability | done |
| 4. Court directory | done (Boston seed coordinates need verifying) |
| 5. Discovery feed (level delta first, distance second) | done: swipe stack + list, filters, cohort countdown |
| 6. Hit requests, accept/decline/counter, per-hit thread | done, incl. the waiting-on-parent state |
| 7. Confirmation, ghost-suppression signals | done |
| 8. Block/report + moderation queue | block/report in app, guardian-side block; reviewer surface pending |
| 9. Roster codes | done |
| 10. Match-found animation | done (Center Court) |
| Push notifications | outbox + edge function deployed + app registration; unverified on device |
| Phone sharing | per confirmed hit, opt-in, revocable |
| Photos | onboarding step + change in You; a minor's photo is parent-approved |
| Sound | strike on lock-in, pop on send; toggle in You |
| Share card | story-sized image of the confirmed moment |
| Guardian link lifecycle | magic link accept, opened tracking, revoke |
| UTR linking | OAuth flow + edge function deployed; waiting on UTR partner credentials |
| Level input | ladder, UTR self-entry, or USTA NTRP mapped to the UTR scale |

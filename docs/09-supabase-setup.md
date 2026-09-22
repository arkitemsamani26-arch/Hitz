# 9. Supabase — the live project

**Project:** `Hits` (`pvkzcbgpbebllnzmxxwg`, us-west-1, free tier, $0/month), created 2026-09-19
in your Supabase org. URL `https://pvkzcbgpbebllnzmxxwg.supabase.co`; publishable key in
`.env.example`. Never put the `service_role` key in the app.

## Done, from here

- All migrations applied (`hits_01` … `hits_05`), Palo Alto market + both cohorts (closed,
  threshold 150) + 10 courts seeded.
- Security advisor run; the actionable findings fixed (`search_path` pinned on every
  function, PostGIS's anon-executable helper revoked). What remains is informational:
  `profiles_private` and `notifications` have RLS with no policies — that is the design.
- Live smoke test of the separation rule under Supabase's real `auth.uid()`: an adult
  session sees zero minor rows and cannot view a minor; sees the other adults. Rolled back.
- Edge functions deployed: `notify` (push delivery + tomorrow reminders + request expiry)
  and `guardian-invite` (parent SMS/email with a magic link). Both require a JWT.

### Not yet applied to the live project

`20260922000400_invites.sql` and `20260922000500_moderation.sql` are in the repo and green
against a scratch Postgres (`npm run db:test`), but have **not** been pushed to the live
project. Apply them when you want the invite field and the one-call review path live;
neither touches an existing row.

## What only the dashboard can do (about 10 minutes)

1. **Settings → API → Exposed schemas: `app`, and remove `public`.** Without `app`, every
   client call 404s. Removing `public` is the other half: Hits never reads it, and leaving
   it exposed is what puts PostGIS's `spatial_ref_sys` table and its anon-callable
   `st_estimatedextent` function on the security advisor. Neither can be fixed from SQL --
   they are owned by the platform -- so this one setting closes both, and anything PostGIS
   adds later. (Platform config; not settable from SQL or the MCP.)
2. **Authentication → Providers → Phone:** enable with Twilio (trial is fine). OTP length 6.
   Also **Email** provider on, for the parent's magic link.
3. **Authentication → URL configuration:** add `hits://guardian/link` and your web URL to
   the redirect allow-list.
4. **Edge Functions → Secrets:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`,
   `RESEND_API_KEY`, `APP_URL`.
5. **Edge Functions → Schedules:** `notify` every minute.
6. **Database → Webhooks:** on INSERT into `app.guardian_links`, POST to `guardian-invite`
   with header `Authorization: Bearer <anon key>`.
7. **Run the RLS suite against it once** with the database password from Settings →
   Database: `PGHOST=<pooler host> PGPORT=6543 PGUSER=postgres.pvkzcbgpbebllnzmxxwg PGPASSWORD=… ./scripts/db-test.sh`.
   That's the safety model; a failure there means stop.

Then `cp .env.example .env` and `npm start`.

## Moderation

`supabase/moderation.sql` is the reviewer's whole desk: run it in the SQL editor daily.
Reports involving a minor sort first.

A decision is one call, whichever way it goes:

```sql
select app.review_report('<report id>', 'suspend', 'suspended: repeated abuse in thread');
select app.review_report('<report id>', 'dismiss', 'no basis; counterparty misread a joke');
```

It is service-role only — there is no path from a signed-in user to any of it, and test 16
is what keeps that true. Suspending also cancels every live hit that profile is in and
tells the other side theirs is off, and returns how many it cancelled so the blast radius
is visible. Either way the reporter is told their report was read, because "goes to a
person, same day" is a promise the report button makes on your behalf.

The list that has to reach zero every day is `app.moderation_auto_hidden`: three distinct
reporters in thirty days hides a profile with no human involved, which is the right
default only if somebody clears it. If all the reports against a hidden player turn out to
be nothing, pass `true` as the fourth argument when you dismiss the last one and they go
back up in the same statement.

## Invite codes

Two kinds, one field, one code space. A captain makes a team code in You; any player mints
a personal one. `app.check_code` is anon, because the field runs before sign-in, and it
returns the team's name or the inviter's first name — which is why personal codes are
eight characters of entropy rather than something speakable.

Neither kind grants anything. Redeeming a code does not make anyone visible to anyone; it
records who brought whom. `select * from app.invite_funnel;` is where that becomes a
number, and it is the only honest answer to "where did this market come from".

## UTR: two roads to the same badge

The verified level is the most valuable thing in the product, so it does not wait on a
paid API application. There are two ways a player gets it, and neither lets them grant it
to themselves -- both write through a service-role-only function.

### 1. Review (live now, no subscription)

A player states their UTR, the link to their UTR profile, and the name on that profile
(`/verify-utr` in the app). That files a claim; it does **not** grant anything. Their
number shows as self-reported in the meantime.

You review it in the SQL editor with `supabase/utr-review.sql`:

```sql
select * from app.utr_review_queue;             -- who is waiting, with their profile link
select app.review_utr_claim('<claim_id>', true);         -- approve at the number they claimed
select app.review_utr_claim('<claim_id>', true, 8.42);   -- approve at the number you saw
select app.review_utr_claim('<claim_id>', false, null, 'That profile is a different name.');
```

Open their profile link, check the name matches, check the rating matches within about
0.2, check it is a real playing record. Be stricter for anyone under 18: the level decides
who they are matched with, and an inflated number puts a fourteen-year-old across the net
from a college player. A rejection's note is shown to the player, so write it as an
instruction rather than a verdict.

`app.profiles.utr_verified_by` records `'review'` for these and `'api'` for the OAuth
path, so the two are always distinguishable -- which matters if UTR ever asks.

Taking a badge back: `select app.retire_utr('<profile_id>');`

### 2. Engage API (when the credential lands)

`Link UTR` on the You tab starts an OAuth round trip: `begin_utr_link` -> UTR -> the
`utr-link` edge function -> `apply_utr`, which only the server can call. Tokens never
reach a client (test 10). What is missing is the partner credential: apply at
https://www.utrsports.net/pages/engage-api (there is a $250 application fee without an
existing partnership). Then:

1. Set the function secrets `UTR_CLIENT_ID`, `UTR_CLIENT_SECRET`, `UTR_TOKEN_URL`,
   `UTR_PROFILE_URL`, `APP_URL`, and in the app `EXPO_PUBLIC_UTR_AUTH_URL` and
   `EXPO_PUBLIC_UTR_CLIENT_ID`.
2. Deploy the callback **without JWT verification** -- it is a browser redirect from
   UTR's domain and arrives with no Supabase token:
   `supabase functions deploy utr-link --no-verify-jwt`
3. Deploy `utr-sync` and schedule it hourly. It refreshes each stored token and rewrites
   the rating, so a verified badge tracks UTR instead of freezing on the day it was
   issued. It is a no-op until the secrets are set.
4. If the profile response field names differ from the guesses, set `UTR_PROFILE_FIELDS`
   on both functions rather than redeploying:
   `id=playerId,rating=singlesUtr,status=ratingStatus`
5. Add the callback URL to Authentication -> URL configuration.

Nothing about the review path has to be turned off when this lands. It stays as the
fallback for players the API cannot match.

USTA has no public API for NTRP; the level step takes an NTRP rating directly and maps it
onto the UTR scale as a self-reported starting point.

## Checking it is all actually wired up

```
npm run check:backend
```

Asks the live project the same questions the app asks, in the same order: is the key
accepted, is the `app` schema exposed, does the court directory read, are the RPCs
callable, is phone sign-in on, are the edge functions deployed. It names the dashboard
setting to change for each failure. The app falls back to the in-memory demo when
Supabase is not configured, which is the right default and a terrible way to discover a
misconfiguration, so run this after any dashboard change.

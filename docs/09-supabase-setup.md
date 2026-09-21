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

## What only the dashboard can do (about 10 minutes)

1. **Settings → API → Exposed schemas: add `app`.** Without this every client call 404s.
   (This is platform config; it isn't settable from SQL or the MCP.)
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

`supabase/moderation.sql` is the queue: run it in the SQL editor daily. Reports involving a
minor sort first.

## UTR / USTA

The accurate level comes from UTR, and the app is built for it: `Link UTR` on the You tab
starts an OAuth round trip (`begin_utr_link` → UTR → the `utr-link` edge function →
`apply_utr`, which only the server can call). A rated player's number becomes their
`utr_verified` level; tokens never reach a client (test 10). What is missing is the
partner credential: apply at https://www.utrsports.net/pages/engage-api (the $250
application fee applies without an existing partnership), then set the secrets
`UTR_CLIENT_ID`, `UTR_CLIENT_SECRET`, `UTR_AUTH_URL`, `UTR_TOKEN_URL`, `UTR_PROFILE_URL` on
the function and `EXPO_PUBLIC_UTR_AUTH_URL` / `EXPO_PUBLIC_UTR_CLIENT_ID` in the app. The
profile field names in `utr-link/index.ts` are marked for adjustment against the docs.

USTA has no public API for NTRP; the level step now takes an NTRP rating directly and maps
it onto the UTR scale as a self-reported starting point.

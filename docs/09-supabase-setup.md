# 9. Standing up Supabase

1. **Create a project** at supabase.com (free tier is fine). From Settings → API, note the
   Project URL and the `anon` key. Never put the `service_role` key in the app.
2. **Expose the schema.** Settings → API → Exposed schemas: add `app`. Without this every
   call 404s.
3. **Phone auth.** Authentication → Providers → Phone: enable, with Twilio (a trial account
   works for beta). OTP length 6.
4. **Apply the migrations.** `brew install supabase/tap/supabase`, then in the repo:
   `supabase link --project-ref <ref>` and `supabase db push` — applies everything in
   `supabase/migrations` in order.
5. **Seed.** Paste `supabase/seed.sql` into the SQL editor (Palo Alto market, both cohorts
   closed, courts). Verify the court pins against the real facilities before beta.
6. **Run the RLS suite against it once** — that's the safety model, and a failure there
   means stop: `PGHOST=<pooler host> PGPORT=6543 PGUSER=postgres.<ref> PGPASSWORD=… ./scripts/db-test.sh`
   (the local shim is skipped automatically when `auth.uid()` already exists).
7. **Push delivery.** `supabase functions deploy notify --no-verify-jwt`, then schedule it
   every minute (Edge Functions → Schedules). It drains `app.notifications` and enqueues the
   tomorrow reminders.
8. **Guardian messages.** The SMS/email to a parent is not sent by the app; it needs a
   small edge function on `guardian_links` insert (Twilio + Resend). Lead with "your kid
   finds the hit, you approve the meeting", link to `/guardian/link?token=…`, and set
   `opened_at` on the link's first hit.
9. **Run the app against it:** `.env` with `EXPO_PUBLIC_SUPABASE_URL` and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then `npm start`. First things to verify: `discover()`'s
   return shape, realtime events on the three tables, `stamp_phone_verified` after the first
   profile insert, and that `create_roster` returns a row through PostgREST.

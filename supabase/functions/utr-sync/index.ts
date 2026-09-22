// Keeps verified UTR ratings current.
//
// A badge that froze on the day it was issued is worse than no badge: UTR moves every
// week, and the whole promise of "UTR verified" is that the number is live. This walks
// the links that have not been checked in a day, refreshes each OAuth token and writes
// the rating back through apply_utr.
//
// Run it on a schedule (Edge Functions -> Schedules), hourly is plenty. Service role
// only: it reads refresh tokens.
//
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, UTR_CLIENT_ID, UTR_CLIENT_SECRET,
// UTR_TOKEN_URL, UTR_PROFILE_URL, and optionally UTR_PROFILE_FIELDS (same format as
// utr-link: id=playerId,rating=singlesUtr,status=ratingStatus).
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });

const FIELDS = Object.fromEntries(
  (Deno.env.get('UTR_PROFILE_FIELDS') ?? '').split(',').filter(Boolean)
    .map(pair => pair.split('=').map(x => x.trim())),
) as Record<string, string>;

const pick = (o: Record<string, unknown>, key: string, guesses: string[]) => {
  const named = FIELDS[key];
  if (named && o[named] != null) return o[named];
  for (const g of guesses) if (o[g] != null) return o[g];
  return null;
};

const configured = () => !!(Deno.env.get('UTR_TOKEN_URL') && Deno.env.get('UTR_PROFILE_URL') && Deno.env.get('UTR_CLIENT_ID'));

Deno.serve(async () => {
  // Before the partner credential lands this is a no-op rather than a pile of 500s.
  if (!configured()) return Response.json({ skipped: 'UTR credentials not set' });

  const { data: due } = await sb.rpc('utr_due_for_sync', { p_limit: 100 });
  let synced = 0, retired = 0, failed = 0;

  for (const link of due ?? []) {
    try {
      const tok = await fetch(Deno.env.get('UTR_TOKEN_URL')!, {
        method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token', refresh_token: link.refresh_token,
          client_id: Deno.env.get('UTR_CLIENT_ID')!, client_secret: Deno.env.get('UTR_CLIENT_SECRET')!,
        }),
      });
      // A revoked or expired grant is the player disconnecting us. Retire the badge
      // rather than leaving a stale one standing.
      if (tok.status === 400 || tok.status === 401) {
        await sb.rpc('retire_utr', { p_profile: link.profile_id });
        retired++;
        continue;
      }
      if (!tok.ok) { failed++; continue; }
      const t = await tok.json();

      const prof = await fetch(Deno.env.get('UTR_PROFILE_URL')!, { headers: { Authorization: `Bearer ${t.access_token}` } });
      if (!prof.ok) { failed++; continue; }
      const p = await prof.json();

      const rating = pick(p, 'rating', ['singlesUtr', 'utr', 'rating', 'singlesUtrDisplay']);
      const status = pick(p, 'status', ['ratingStatus', 'status']) ?? (rating ? 'rated' : 'unrated');
      const numeric = rating == null ? null : Number(rating);

      const { error } = await sb.rpc('apply_utr', {
        p_profile: link.profile_id,
        p_player_id: link.utr_player_id,
        p_rating: numeric != null && Number.isFinite(numeric) ? numeric : null,
        p_status: String(status).toLowerCase(),
        p_access: t.access_token ?? null,
        // Some providers rotate the refresh token, some do not. Keep the old one if not.
        p_refresh: t.refresh_token ?? link.refresh_token,
      });
      if (error) failed++; else synced++;
    } catch {
      failed++;
    }
  }

  return Response.json({ synced, retired, failed, considered: due?.length ?? 0 });
});

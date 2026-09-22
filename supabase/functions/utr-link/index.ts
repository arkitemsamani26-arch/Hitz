// UTR Engage API OAuth callback.
//
// Flow: the app calls app.begin_utr_link() for a state, opens
//   ${UTR_AUTH_URL}?client_id=...&redirect_uri=<this function>&state=<state>&response_type=code
// UTR redirects here with ?code&state. We exchange the code, read the player's rating, and
// call app.apply_utr (service role only). Then we bounce back into the app.
//
// Secrets: UTR_CLIENT_ID, UTR_CLIENT_SECRET, UTR_AUTH_URL, UTR_TOKEN_URL, UTR_PROFILE_URL,
// APP_URL. The endpoint paths come from the partner docs once the application is approved;
// this function is the whole client side of that integration.
//
// DEPLOY WITH --no-verify-jwt. UTR's browser redirect arrives with no Supabase JWT, so
// the default verification 401s before this ever runs:
//   supabase functions deploy utr-link --no-verify-jwt
//
// UTR_PROFILE_FIELDS lets the field names be corrected from the dashboard without a
// redeploy, for the day the real docs land and the guesses below turn out wrong. Format:
//   id=playerId,rating=singlesUtr,status=ratingStatus
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
// Trailing slashes gave `hits:///you?utr=linked`, which nothing routes.
const APP_URL = (Deno.env.get('APP_URL') ?? 'hits://').replace(/\/+$/, '');

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

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const code = u.searchParams.get('code'), state = u.searchParams.get('state');
  const back = (q: string) => Response.redirect(`${APP_URL}/you?utr=${q}`, 302);
  if (!code || !state) return back('missing');

  const { data: st } = await sb.from('utr_oauth_states').select('profile_id').eq('state', state).maybeSingle();
  if (!st) return back('expired');

  const tok = await fetch(Deno.env.get('UTR_TOKEN_URL')!, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code', code, client_id: Deno.env.get('UTR_CLIENT_ID')!, client_secret: Deno.env.get('UTR_CLIENT_SECRET')!,
      redirect_uri: `${Deno.env.get('SUPABASE_URL')}/functions/v1/utr-link`,
    }),
  });
  if (!tok.ok) return back('token');
  const t = await tok.json();

  const prof = await fetch(Deno.env.get('UTR_PROFILE_URL')!, { headers: { Authorization: `Bearer ${t.access_token}` } });
  if (!prof.ok) return back('profile');
  const p = await prof.json();
  // Field names are guesses until the partner docs are in hand; UTR_PROFILE_FIELDS
  // overrides each one without a redeploy.
  const rawId = pick(p, 'id', ['id', 'playerId', 'memberId', 'playerid']);
  // utr_player_id is unique, so String(undefined) once wrote the literal "undefined" and
  // the second player to link collided with it.
  if (rawId == null || String(rawId) === '') return back('profile');
  const playerId = String(rawId);
  const rating = pick(p, 'rating', ['singlesUtr', 'utr', 'rating', 'singlesUtrDisplay']);
  const status = pick(p, 'status', ['ratingStatus', 'status']) ?? (rating ? 'rated' : 'unrated');

  const numeric = rating == null ? null : Number(rating);
  const { error } = await sb.rpc('apply_utr', {
    p_profile: st.profile_id, p_player_id: playerId,
    p_rating: numeric != null && Number.isFinite(numeric) ? numeric : null,
    p_status: String(status).toLowerCase(),
    p_access: t.access_token ?? null, p_refresh: t.refresh_token ?? null,
  });
  await sb.from('utr_oauth_states').delete().eq('state', state);
  return back(error ? 'failed' : 'linked');
});

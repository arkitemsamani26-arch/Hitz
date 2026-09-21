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
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
const APP_URL = Deno.env.get('APP_URL') ?? 'hits://';

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
  // Field names per the Engage API docs; adjust once the partner docs are in hand.
  const playerId = String(p.id ?? p.playerId ?? p.memberId);
  const rating = p.singlesUtr ?? p.utr ?? p.rating ?? null;
  const status = p.ratingStatus ?? (rating ? 'rated' : 'unrated');

  const { error } = await sb.rpc('apply_utr', { p_profile: st.profile_id, p_player_id: playerId, p_rating: rating, p_status: String(status).toLowerCase(), p_access: t.access_token ?? null, p_refresh: t.refresh_token ?? null });
  await sb.from('utr_oauth_states').delete().eq('state', state);
  return back(error ? 'failed' : 'linked');
});

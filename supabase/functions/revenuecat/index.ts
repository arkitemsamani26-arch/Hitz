// RevenueCat's webhook: the one way a subscription reaches the database.
//
// Deploy: supabase functions deploy revenuecat --no-verify-jwt
// RevenueCat does not carry a Supabase JWT; it authenticates with the Authorization header
// you set in its dashboard (Project -> Integrations -> Webhooks -> Authorization header).
// Put the same value in this function's secrets as REVENUECAT_WEBHOOK_SECRET. With the
// secret unset, every call is refused: a webhook that accepts anything would let anyone on
// the internet grant themselves Plus.
//
// The app user id RevenueCat sends is the Supabase auth user id (the app configures it
// that way), which is the profile id for a player and the sign-in for a parent. Each event
// is folded into one row per user through app.apply_subscription, which only the service
// role may call.
import { createClient } from 'npm:@supabase/supabase-js@2';

type Status = 'active' | 'grace' | 'cancelled' | 'expired' | 'billing_issue';

// What each RevenueCat event means for access. CANCELLATION keeps access until the period
// ends, so it stays 'active' with the expiry RevenueCat gives; EXPIRATION ends it.
function statusFor(type: string, expiresMs: number | null): Status | null {
  switch (type) {
    case 'INITIAL_PURCHASE': case 'RENEWAL': case 'UNCANCELLATION': case 'PRODUCT_CHANGE': case 'NON_RENEWING_PURCHASE': case 'TRANSFER':
      return 'active';
    case 'CANCELLATION':
      return expiresMs != null && expiresMs > Date.now() ? 'active' : 'cancelled';
    case 'BILLING_ISSUE':
      return expiresMs != null && expiresMs > Date.now() ? 'grace' : 'billing_issue';
    case 'EXPIRATION':
      return 'expired';
    case 'SUBSCRIPTION_PAUSED':
      return 'cancelled';
    case 'TEST':
      return null;
    default:
      return null;
  }
}

function sourceFor(store: string | undefined): 'apple' | 'google' | 'promo' {
  if (store === 'APP_STORE' || store === 'MAC_APP_STORE') return 'apple';
  if (store === 'PLAY_STORE' || store === 'AMAZON') return 'google';
  return 'promo';
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('POST only', { status: 405 });
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');
  if (!secret) return new Response('webhook secret not configured', { status: 401 });
  const auth = req.headers.get('authorization') ?? '';
  if (auth !== secret && auth !== `Bearer ${secret}`) return new Response('unauthorized', { status: 401 });

  let body: any;
  try { body = await req.json(); } catch { return new Response('bad json', { status: 400 }); }
  const ev = body?.event;
  if (!ev?.type) return new Response('no event', { status: 400 });

  const userId: string | undefined = ev.app_user_id ?? ev.original_app_user_id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return new Response('not a Hits user id', { status: 200 });
  const expiresMs: number | null = typeof ev.expiration_at_ms === 'number' ? ev.expiration_at_ms : null;
  const status = statusFor(String(ev.type), expiresMs);
  if (!status) return new Response(JSON.stringify({ ignored: ev.type }), { status: 200, headers: { 'content-type': 'application/json' } });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
  const { error } = await sb.rpc('apply_subscription', {
    p_user: userId,
    p_status: status,
    p_expires_at: expiresMs != null ? new Date(expiresMs).toISOString() : null,
    p_source: sourceFor(ev.store),
    p_txn: ev.original_transaction_id ?? ev.transaction_id ?? null,
  });
  // A 500 makes RevenueCat retry, which is what we want for a transient database error.
  if (error) return new Response(`apply_subscription: ${error.message}`, { status: 500 });
  return new Response(JSON.stringify({ ok: true, status }), { status: 200, headers: { 'content-type': 'application/json' } });
});

// Sends the parent's SMS and email the moment a child adds them, and records that it did.
//
// Wire it as a Database Webhook on INSERT to app.guardian_links (Database -> Webhooks),
// or call it from the notify schedule. Secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
// TWILIO_FROM, RESEND_API_KEY, APP_URL (e.g. https://hits.app), SUPABASE_SERVICE_ROLE_KEY.
//
// The message leads with the one sentence that makes parents say yes, and the link opens
// a page that is only the what-you-control screen and one button. No account first: the
// magic link signs them in.
import { createClient } from 'npm:@supabase/supabase-js@2';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
const APP_URL = Deno.env.get('APP_URL') ?? 'https://hits.app';

async function magicLink(email: string, linkId: string): Promise<string> {
  // A magic link that lands on the guardian page with the link id attached.
  const { data, error } = await sb.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo: `${APP_URL}/guardian/link?link=${linkId}` } });
  if (error) throw error;
  return data.properties?.action_link ?? `${APP_URL}/guardian/link?link=${linkId}`;
}

async function sms(to: string, body: string) {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID'), tok = Deno.env.get('TWILIO_AUTH_TOKEN'), from = Deno.env.get('TWILIO_FROM');
  if (!sid || !tok || !from) return false;
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST', headers: { Authorization: 'Basic ' + btoa(`${sid}:${tok}`), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: from, Body: body }),
  });
  return r.ok;
}

async function email(to: string, subject: string, html: string) {
  const key = Deno.env.get('RESEND_API_KEY'); if (!key) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'Hits <hello@hits.app>', to, subject, html }),
  });
  return r.ok;
}

Deno.serve(async (req) => {
  // Accept a webhook payload ({ record }) or run over anything unsent.
  let ids: string[] = [];
  try { const body = await req.json(); if (body?.record?.id) ids = [body.record.id]; } catch { /* scheduled run */ }
  const q = sb.from('guardian_links').select('id, guardian_email, guardian_phone, sms_sent_at, email_sent_at, profiles:minor_profile_id(display_name)').is('revoked_at', null).is('verified_at', null);
  const { data: links } = ids.length ? await q.in('id', ids) : await q.is('email_sent_at', null).limit(50);

  let n = 0;
  for (const l of links ?? []) {
    const kid = (l as any).profiles?.display_name ?? 'Your kid';
    const url = await magicLink(l.guardian_email, l.id);
    const lead = `${kid} found a hitting partner on Hits. You approve the meetups — nothing else changes.`;
    const patch: Record<string, string> = {};
    if (l.guardian_phone && !l.sms_sent_at && await sms(l.guardian_phone, `${lead} One tap to say yes: ${url}`)) patch.sms_sent_at = new Date().toISOString();
    if (!l.email_sent_at && await email(l.guardian_email, `${kid} added you on Hits`,
      `<p style="font:16px/1.5 -apple-system,sans-serif">${lead}</p><p><a href="${url}" style="display:inline-block;padding:12px 20px;background:#2E6FCB;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">See what you control — 30 seconds</a></p><p style="color:#4A5470;font-size:13px">Under-18s only see under-18s on Hits. Meetups happen at public courts. Other players see a rough distance, never a pin.</p>`)) patch.email_sent_at = new Date().toISOString();
    if (Object.keys(patch).length) { await sb.from('guardian_links').update(patch).eq('id', l.id); n++; }
  }
  return new Response(String(n));
});

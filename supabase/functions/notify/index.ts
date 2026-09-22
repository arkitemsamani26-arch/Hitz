// Delivers queued notifications through Expo's push service.
//
// Deploy: supabase functions deploy notify        (JWT verification ON -- see below)
// It also enqueues the "hit tomorrow" reminders and expires stale requests on each run.
//
// SCHEDULING IS NOT OPTIONAL AND IS NOT DONE FROM HERE. Nothing in this repo can create
// the schedule, because it needs the service_role key, which never belongs in a file. On
// the live project there is no schedule at all -- pg_cron is not even installed -- so the
// outbox fills up and nobody is ever pushed to. Either:
//
//   Dashboard -> Edge Functions -> notify -> Schedules, every minute; or
//   create extension pg_cron; create extension pg_net;
//   select cron.schedule('notify', '* * * * *', $$
//     select net.http_post('<function url>',
//       headers => jsonb_build_object('Authorization', 'Bearer <service role key>'))
//   $$);
//
// The Authorization header is required: this function verifies JWTs. Deploying it with
// --no-verify-jwt instead would let anyone on the internet drain the outbox.
//
// Every call here is checked, and the function returns 500 with a body naming what broke.
// It used to discard all of it, which is how it ran for days in production doing nothing:
// a hardening migration revoked the only EXECUTE grant the two RPCs had, both calls started
// coming back 403, and a function that never looks at an error and always returns 200 has
// no way to say so. The grants are fixed (see migration 20260922000600 and test 17); this
// is the other half, so the next thing to break is noisy about it.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
  const problems: string[] = [];

  // Housekeeping. A failure here does not stop delivery -- the outbox may still have work
  // from the triggers -- but it must not pass silently either.
  for (const job of ['enqueue_tomorrow_reminders', 'expire_requests'] as const) {
    const { error } = await sb.rpc(job);
    if (error) problems.push(`${job}: ${error.message}`);
  }

  const { data: rows, error: readErr } = await sb.from('notifications')
    .select('*').is('sent_at', null).order('created_at').limit(100);
  // An unreadable outbox is not an empty outbox, and the difference matters: one is a
  // quiet night, the other is every notification in the product silently not arriving.
  if (readErr) return fail([...problems, `read outbox: ${readErr.message}`]);
  if (!rows?.length) return done(problems, 0);

  const ids = [...new Set(rows.map(r => r.user_id))];
  const { data: tokens, error: tokErr } = await sb.from('profiles_private')
    .select('profile_id, push_token').in('profile_id', ids).not('push_token', 'is', null);
  if (tokErr) return fail([...problems, `read tokens: ${tokErr.message}`]);
  const byUser = new Map((tokens ?? []).map(t => [t.profile_id, t.push_token as string]));

  // Anyone with no token has nothing to receive. Their rows are still settled, or they
  // pile up forever and every run re-reads the same hundred.
  const sendable = rows.filter(r => byUser.has(r.user_id));
  const settled = rows.filter(r => !byUser.has(r.user_id)).map(r => r.id);

  if (sendable.length) {
    const messages = sendable.map(r => ({
      to: byUser.get(r.user_id), title: r.title, body: r.body, data: r.data,
      sound: 'default', channelId: 'hits',
    }));
    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(messages),
      });
      if (!res.ok) {
        problems.push(`expo HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      } else {
        // Expo answers with one ticket per message, in order. Only the accepted ones are
        // delivered; marking the rest sent would drop them on the floor, so they stay in
        // the outbox for the next run.
        const tickets = (await res.json())?.data ?? [];
        const dead: string[] = [];
        sendable.forEach((r, i) => {
          const t = tickets[i];
          if (!t || t.status === 'ok') { settled.push(r.id); return; }
          if (t.details?.error === 'DeviceNotRegistered') {
            // The app was uninstalled or the token rotated. Retrying forever cannot fix
            // that, so drop the token and settle the row.
            dead.push(byUser.get(r.user_id)!);
            settled.push(r.id);
          } else {
            problems.push(`push ${r.id}: ${t.message ?? t.status}`);
          }
        });
        if (dead.length) {
          const { error } = await sb.from('profiles_private')
            .update({ push_token: null }).in('push_token', [...new Set(dead)]);
          if (error) problems.push(`clear dead tokens: ${error.message}`);
        }
      }
    } catch (e) {
      problems.push(`expo unreachable: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (settled.length) {
    const { error } = await sb.from('notifications')
      .update({ sent_at: new Date().toISOString() }).in('id', settled);
    if (error) return fail([...problems, `settle outbox: ${error.message}`]);
  }
  return done(problems, settled.length);
});

const done = (problems: string[], sent: number) =>
  problems.length ? fail(problems, sent) : new Response(String(sent));

// 500 so whatever is calling this on a schedule can show it as a failed run. A body
// nobody reads is still better than a 200 that means nothing.
const fail = (problems: string[], sent = 0) => {
  console.error('notify:', problems.join(' | '));
  return new Response(JSON.stringify({ sent, problems }), {
    status: 500, headers: { 'content-type': 'application/json' },
  });
};

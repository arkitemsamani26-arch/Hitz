// Delivers queued notifications through Expo's push service.
//
// Deploy: supabase functions deploy notify --no-verify-jwt
// Schedule: every minute via the dashboard (Edge Functions -> Schedules) or pg_cron:
//   select cron.schedule('notify', '* * * * *', $$ select net.http_post('<function url>', '{}'::jsonb) $$);
// It also enqueues the "hit tomorrow" reminders and expires stale requests on each run.
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { db: { schema: 'app' } });
  await sb.rpc('enqueue_tomorrow_reminders');
  await sb.rpc('expire_requests');

  const { data: rows } = await sb.from('notifications').select('*').is('sent_at', null).order('created_at').limit(100);
  if (!rows?.length) return new Response('0');

  const ids = [...new Set(rows.map(r => r.user_id))];
  const { data: tokens } = await sb.from('profiles_private').select('profile_id, push_token').in('profile_id', ids).not('push_token', 'is', null);
  const byUser = new Map((tokens ?? []).map(t => [t.profile_id, t.push_token as string]));

  const messages = rows.filter(r => byUser.has(r.user_id)).map(r => ({
    to: byUser.get(r.user_id), title: r.title, body: r.body, data: r.data, sound: 'default', channelId: 'hits',
  }));
  if (messages.length) {
    await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(messages) });
  }
  await sb.from('notifications').update({ sent_at: new Date().toISOString() }).in('id', rows.map(r => r.id));
  return new Response(String(messages.length));
});

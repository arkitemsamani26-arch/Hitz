#!/usr/bin/env node
// Is the backend actually wired up?
//
// The app falls back to the in-memory demo whenever Supabase is not configured, which is
// the right default and a terrible way to find out your project is misconfigured. This
// asks the live project the same questions the app will ask, in the same order, and says
// plainly which one failed.
//
//   npm run check:backend              what a phone can see
//   npm run check:backend -- --service  what only the server can see
//
// The default pass uses the publishable key and asks exactly what the app asks. That is
// the right default and it is also blind in one direction: three separate bugs this
// project has had -- the cron functions losing their EXECUTE grant, the realtime
// publication being empty, `notify` having no schedule -- are all invisible from outside,
// because the app degrades quietly and the REST API answers anyway.
//
// --service reads SUPABASE_SERVICE_ROLE_KEY from the environment (never from a file that
// is committed) and asks app.ops_health() the questions only the inside can answer. Run
// it after any deploy, and after any migration that touches grants.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const env = { ...process.env };
  for (const name of ['.env', '.env.example']) {
    const p = resolve(root, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].trim();
    }
    if (name === '.env') break;   // a real .env wins outright
  }
  return env;
}

const env = loadEnv();
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const SERVICE = process.argv.includes('--service');
// Deliberately not from loadEnv(): the service key must be passed in for the one command
// that needs it, never picked up from a file sitting in the repo.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const pass = [], fail = [], warn = [];
const ok = (m) => { pass.push(m); console.log(`  ok    ${m}`); };
const bad = (m, fix) => { fail.push(m); console.log(`  FAIL  ${m}`); if (fix) console.log(`        ${fix}`); };
const note = (m, fix) => { warn.push(m); console.log(`  warn  ${m}`); if (fix) console.log(`        ${fix}`); };

// A corporate proxy, a VPN or a sandbox can refuse the host outright. That is not a
// misconfigured project, and reporting it as one sends you to the wrong dashboard page.
function blocked(r) {
  return r.status === 0 || (r.status === 403 && /allowlist|egress|proxy|forbidden by/i.test(r.body));
}

async function get(path, headers = {}) {
  try {
    const r = await fetch(`${URL_}${path}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, ...headers } });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    return { status: 0, body: String(e?.message ?? e) };
  }
}

console.log('\nHits backend check\n');


// Everything below needs the service_role key, and is the half that a phone -- and so the
// default pass above -- cannot see at all.
async function insideTheSystem() {
  // 7. The half a phone cannot see.
  if (!SERVICE) {
    console.log('\n  Everything above is what a phone can reach. Three bugs this project has had');
    console.log('  were invisible from here. To check those too:\n');
    console.log('    SUPABASE_SERVICE_ROLE_KEY=... npm run check:backend -- --service\n');
    return;
  }
  if (!SERVICE_KEY) {
    bad('--service needs the service_role key',
        'SUPABASE_SERVICE_ROLE_KEY=... npm run check:backend -- --service   (never commit it)');
    return;
  }

  console.log('\n  Inside the system\n');
  let h;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/ops_health`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`,
                 'content-type': 'application/json', 'Content-Profile': 'app' },
      body: '{}',
    });
    const body = await res.text();
    if (res.status === 404) {
      return bad('app.ops_health() is missing', 'Apply supabase/migrations/20260922000900_ops_health.sql.');
    }
    if (res.status === 401 || res.status === 403) {
      return bad(`the service_role key was refused (HTTP ${res.status})`, 'Settings -> API -> service_role. Copy it again.');
    }
    if (!res.ok) return bad(`ops_health returned HTTP ${res.status}: ${body.slice(0, 160)}`);
    h = (JSON.parse(body) ?? [])[0];
  } catch (e) {
    return note(`Could not reach ops_health from this machine: ${e?.message ?? e}`);
  }
  if (!h) return bad('ops_health returned nothing');

  // The grant that took the scheduled jobs down when PUBLIC was revoked out from under them.
  if (h.jobs_executable) ok('the server can run the scheduled jobs');
  else bad('service_role cannot execute the scheduled jobs, so nothing expires and nobody is reminded',
           'Apply supabase/migrations/20260922000600_execute_surface.sql.');

  // A subscription to an empty publication is a subscription that never fires.
  if (h.realtime_tables === 3) ok('realtime carries the three tables the app subscribes to');
  else bad(`realtime carries ${h.realtime_tables} of the 3 tables the app subscribes to, so live updates never arrive`,
           'Apply supabase/migrations/20260922000700_realtime.sql.');

  // The claim docs/01 makes about the schema, checked rather than asserted.
  if (h.anon_executable === 5) ok('anon can execute exactly the five pre-sign-in RPCs');
  else bad(`anon can execute ${h.anon_executable} functions in app, not the 5 that run before sign-in`,
           'Apply supabase/migrations/20260922000600_execute_surface.sql, then run npm run db:test.');

  // Nothing is ever pushed without a schedule, and nothing says so.
  if (!h.cron_ready) {
    note('pg_cron is not installed, so notify() can only be scheduled from the dashboard',
         'Dashboard -> Edge Functions -> notify -> Schedules, every minute. Or install pg_cron and pg_net.');
  } else if (h.cron_jobs > 0) {
    ok(`pg_cron is installed with ${h.cron_jobs} schedule${h.cron_jobs === 1 ? '' : 's'}`);
  } else {
    bad('pg_cron is installed but nothing is scheduled, so the outbox is never drained',
        "select cron.schedule('notify', '* * * * *', ...) -- see supabase/functions/notify/index.ts");
  }

  // The symptom, whatever the cause: is the outbox actually moving?
  const mins = Math.round(h.outbox_oldest_seconds / 60);
  if (h.outbox_waiting === 0) ok('the notification outbox is empty');
  else if (h.outbox_oldest_seconds < 180) ok(`${h.outbox_waiting} waiting in the outbox, oldest ${h.outbox_oldest_seconds}s -- moving`);
  else bad(`${h.outbox_waiting} notifications waiting, oldest ${mins} minutes -- nobody is being notified of anything`,
           'notify() is not running, or is failing. Check its schedule and then its logs.');
}

if (!URL_ || !KEY) {
  bad('No Supabase URL or key', 'cp .env.example .env  -- without these the app runs the in-memory demo.');
} else if (env.EXPO_PUBLIC_DEMO === '1') {
  note('EXPO_PUBLIC_DEMO=1, so the app will run the demo whatever the project says.',
       'Set EXPO_PUBLIC_DEMO=0 in .env to use the live backend.');
}

if (URL_ && KEY) {
  console.log(`  project ${URL_}\n`);

  // 1. Is the project awake and is the key valid?
  const root_ = await get('/rest/v1/');
  if (blocked(root_)) {
    note(`This machine cannot reach ${URL_}`,
         `Something between here and Supabase is refusing the host: ${root_.body.slice(0, 120)}`);
    console.log('\n  Nothing below this line means anything until that is sorted.\n');
  }
  if (blocked(root_)) { /* already reported; claiming anything else would be a guess */ }
  else if (root_.status === 401) bad('The publishable key was rejected', 'Settings -> API -> copy the publishable (anon) key into .env.');
  else if (root_.status >= 500) bad(`The project is not answering (HTTP ${root_.status})`, 'A free-tier project pauses when idle. Open the dashboard once to wake it.');
  else ok('The project answers and the key is accepted');

  // 2. The single most common misconfiguration: the app schema is not exposed.
  const courts = await get('/rest/v1/courts?select=id,name&limit=3', { 'Accept-Profile': 'app' });
  if (blocked(courts)) {
    note('Could not reach the court directory from this machine');
  } else if (courts.status === 404 || /schema must be one of/i.test(courts.body)) {
    bad('The `app` schema is not exposed to the API, so every call 404s',
        'Dashboard -> Settings -> API -> Exposed schemas: add `app`. This cannot be set from SQL.');
  } else if (courts.status !== 200) {
    bad(`Reading the court directory failed (HTTP ${courts.status}): ${courts.body.slice(0, 160)}`);
  } else {
    const rows = JSON.parse(courts.body);
    if (rows.length === 0) bad('The court directory is empty', 'Run supabase/seed.sql against the project.');
    else ok(`The court directory reads (${rows[0].name} …)`);
  }

  // 2b. The other half: `public` should not be exposed at all. Hits never reads it, and
  //     leaving it on is what puts PostGIS's tables and helpers on the security advisor.
  const pub = await get('/rest/v1/spatial_ref_sys?select=srid&limit=1');
  if (blocked(pub)) {
    // Unreachable tells us nothing either way; say nothing rather than a false all-clear.
  } else if (pub.status === 200) {
    note('The `public` schema is exposed to the API as well as `app`',
         'Settings -> API -> Exposed schemas: remove `public`. Hits never reads it, and leaving it on exposes PostGIS\'s tables and helpers.');
  } else {
    ok('`public` is not exposed, so PostGIS is out of reach');
  }

  // 3. The RPCs the app cannot work without.
  for (const [rpc, args] of [
    ['peek_cohort', { p_dob: '2000-01-01', p_level: 6 }],
    // The onboarding code field is anon and takes either kind of code.
    ['check_code', { p_code: 'NOPE00' }],
  ]) {
    let r;
    try {
      const res = await fetch(`${URL_}/rest/v1/rpc/${rpc}`, {
        method: 'POST',
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'content-type': 'application/json', 'Content-Profile': 'app' },
        body: JSON.stringify(args),
      });
      r = { status: res.status, body: await res.text() };
    } catch (e) { r = { status: 0, body: String(e?.message ?? e) }; }
    if (r.status === 200) ok(`rpc ${rpc} is callable`);
    else if (blocked(r)) note(`Could not reach rpc ${rpc} from this machine`);
    else if (r.status === 404) bad(`rpc ${rpc} is missing`, 'Apply the migrations in supabase/migrations.');
    else bad(`rpc ${rpc} returned HTTP ${r.status}: ${r.body.slice(0, 160)}`);
  }

  // 4. Sign-in is by phone, and phone auth needs an SMS provider wired up.
  const settings = await get('/auth/v1/settings');
  if (settings.status === 200) {
    const s = JSON.parse(settings.body);
    if (s.external?.phone) ok('Phone sign-in is enabled');
    else bad('Phone sign-in is disabled, so nobody can sign in',
             'Dashboard -> Authentication -> Providers -> Phone. Twilio trial is enough to test.');
    if (s.external?.email) ok('Email sign-in is enabled (the parent magic link needs it)');
    else note('Email sign-in is off, so the parent magic link will not send',
              'Dashboard -> Authentication -> Providers -> Email.');
  } else if (blocked(settings)) {
    note('Could not reach the auth settings from this machine');
  } else {
    note(`Could not read auth settings (HTTP ${settings.status})`);
  }

  // 5. Edge functions. A 401 means deployed-and-guarded, which is the right answer for
  //    the two that require a JWT.
  for (const [fn, wantsJwt] of [['notify', true], ['guardian-invite', true], ['utr-link', false], ['utr-sync', true]]) {
    const r = await get(`/functions/v1/${fn}`);
    if (blocked(r)) { note(`Could not reach edge function ${fn} from this machine`); continue; }
    if (r.status === 404) {
      if (fn.startsWith('utr')) note(`edge function ${fn} is not deployed (only needed once UTR access lands)`,
                                     `supabase functions deploy ${fn}${fn === 'utr-link' ? ' --no-verify-jwt' : ''}`);
      else bad(`edge function ${fn} is not deployed`, `supabase functions deploy ${fn}`);
    } else if (r.status === 401 && !wantsJwt) {
      bad(`edge function ${fn} requires a JWT, but it is an OAuth redirect target`,
          'supabase functions deploy utr-link --no-verify-jwt');
    } else {
      ok(`edge function ${fn} is deployed`);
    }
  }

  // 6. UTR, client half.
  if (env.EXPO_PUBLIC_UTR_AUTH_URL && env.EXPO_PUBLIC_UTR_CLIENT_ID) ok('UTR client credentials are set');
  else note('UTR is not configured, so "Link UTR" says so instead of opening a broken flow',
            'Set EXPO_PUBLIC_UTR_AUTH_URL and EXPO_PUBLIC_UTR_CLIENT_ID once Engage API access is approved.');

  await insideTheSystem();

}

console.log(`\n  ${pass.length} ok, ${warn.length} to look at, ${fail.length} blocking\n`);
if (fail.length) {
  console.log('  The app will still run -- it falls back to the in-memory demo -- but it is not talking to your backend.\n');
  process.exit(1);
}

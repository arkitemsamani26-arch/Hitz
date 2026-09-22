#!/usr/bin/env node
// Accessibility audit across the app's screens, against the exported web build.
//
// This was run by hand twice and the result written into docs/08 as a claim. A claim
// nobody can re-check is a claim that quietly stops being true, so it lives here now.
//
//   npm run export:web && npm run a11y
//
// Screens that need state to exist (a profile, an open request) get it seeded straight
// into the demo layer's storage, which is the only way to reach the second half of the
// app without walking eleven onboarding steps per route.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const DIST = 'dist';
const PORT = Number(process.env.A11Y_PORT ?? 8111);
const require_ = createRequire(import.meta.url);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav',
};

// Expo exports a single index.html; every route is resolved client-side.
const serve = () => createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = join(DIST, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  const hit = await stat(file).catch(() => null);
  if (!hit?.isFile()) file = join(DIST, 'index.html');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404).end('no'); }
}).listen(PORT);

const day = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
const iso = d => d.toISOString();

// A junior with a linked parent, one open request they have to answer, and one confirmed
// hit: enough state that no screen renders its empty case by accident.
const seeded = () => ({
  session: { userId: 'me', phone: '6505550137', isGuardian: false },
  profile: {
    displayName: 'Sam', lastInitial: 'R', dateOfBirth: '2009-04-02', levelValue: 8.5,
    levelSource: 'utr_self', homeCourtId: 'c-rinconada', availabilityMask: 8 | 16,
    lookingToHitUntil: iso(day(7, 9)), lastActiveAt: iso(new Date()),
    guardianEmail: 'parent@example.test', guardianPhone: '6505550101', guardianVerified: true,
    guardianSentAt: iso(day(-2, 9)), guardianOpenedAt: iso(day(-2, 10)), rosterName: null,
  },
  rosters: [], invites: [], pushToken: null, reports: [], utrClaim: null, messages: [],
  blocked: [], cohortOpen: true, listMode: null, seenConfirmed: [],
  requests: [{
    id: 'r1', fromId: 'p-maya', toId: 'me', courtId: 'c-stanford',
    windowStart: iso(day(2, 9)), windowEnd: iso(day(2, 10)), note: 'Sets?',
    state: 'pending', awaitingId: 'me', expiresAt: iso(day(3, 9)), createdAt: iso(day(0, 8)),
    confirmedAt: null, declineReason: null, approvals: [], confirmations: {},
    plan: { ballsById: null, format: null, meetAt: null, lateById: null },
  }],
});

const SCREENS = [
  ['sign in', '/'],
  ['hits', '/(tabs)'],
  ['you', '/(tabs)/you'],
  ['filters', '/filters'],
  ['player', '/player/p-maya'],
  ['request', '/request/p-maya'],
  ['counter', '/request/x?counter=r1'],
  ['hit', '/hit/r1'],
  ['verify utr', '/verify-utr'],
  ['guardian link', '/guardian/link'],
];

const main = async () => {
  let chromium;
  try { ({ chromium } = require_('playwright')); }
  catch { console.error('playwright is not installed here. npm i -D playwright, then re-run.'); process.exit(2); }
  const axeSource = await readFile(require_.resolve('axe-core/axe.min.js'), 'utf8')
    .catch(() => { console.error('axe-core is not installed here. npm i -D axe-core, then re-run.'); process.exit(2); });

  const server = serve();
  const browser = await chromium.launch(
    process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => localStorage.setItem('hits.demo.v4', JSON.stringify(s)), seeded());

  let violations = 0;
  for (const [name, path] of SCREENS) {
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2200);
    await page.addScriptTag({ content: axeSource });
    const r = await page.evaluate(async () =>
      await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    if (!r.violations.length) { console.log(`  ok    ${name}`); continue; }
    violations += r.violations.length;
    console.log(`  FAIL  ${name}`);
    for (const v of r.violations) {
      console.log(`        ${v.id} (${v.impact}) — ${v.help}`);
      for (const n of v.nodes.slice(0, 3)) console.log(`          ${n.html.slice(0, 160)}`);
    }
  }
  await browser.close();
  server.close();
  console.log(violations ? `\n${violations} violations` : `\nclean: ${SCREENS.length} screens, zero violations`);
  process.exit(violations ? 1 : 0);
};

main();

#!/usr/bin/env node
// App Store and Play Store screenshots from the exported demo build.
//
//   npm run export:web && TZ=America/Los_Angeles node scripts/store-shots.mjs docs/store
//
// 430 x 932 points at 3x is 1290 x 2796, the 6.7-inch iPhone size both stores accept.
// The data is the demo's sample players, so nothing here is a real person; the listing
// should say the screenshots use sample profiles.
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const DIST = 'dist', OUT = process.argv[2] ?? 'docs/store', PORT = 8140;
const require_ = createRequire(import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  let file = join(DIST, normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, ''));
  if (!(await stat(file).catch(() => null))?.isFile()) file = join(DIST, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file));
}).listen(PORT);

const day = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(Math.floor(h), (h % 1) * 60, 0, 0); return d; };
const iso = d => d.toISOString();
const plan = { ballsById: null, format: null, meetAt: null, lateById: null };
const req = o => ({ note: null, expiresAt: iso(day(3, 9)), createdAt: iso(day(0, 8)), confirmedAt: null, declineReason: null, approvals: [], confirmations: {}, plan, ...o });
// The next weekday evening, so "Both usually free" lines up with the sample week.
const nextWeekday = () => { for (let i = 1; i < 8; i++) { const d = day(i, 18); if (d.getDay() > 0 && d.getDay() < 6) return i; } return 1; };
const wd = nextWeekday();
const seed = {
  session: { userId: 'me', phone: '6505550137', isGuardian: false },
  profile: { displayName: 'Arki', lastInitial: 'T', dateOfBirth: '1999-04-02', levelValue: 10.1, levelSource: 'utr_self', homeCourtId: 'c-rinconada', availabilityMask: 4 | 32,
    lookingToHitUntil: iso(day(7, 9)), lastActiveAt: iso(new Date()), guardianEmail: null, guardianVerified: false, guardianSentAt: null, guardianOpenedAt: null, rosterName: null, prefers: 'Practice sets' },
  rosters: [], invites: [], pushToken: null, reports: [], utrClaim: null, messages: [
    { id: 'm1', hitId: 'on1', senderId: 'p-victor', body: 'Court 3 is usually free after 5. I will bring a new can.', createdAt: iso(day(0, 9)) },
    { id: 'm2', hitId: 'on1', senderId: 'me', body: 'Perfect. Warm up then sets?', createdAt: iso(day(0, 9.2)) },
  ], blocked: [], cohortOpen: true, listMode: null, seenConfirmed: ['on1'],
  requests: [
    req({ id: 'in1', fromId: 'p-kenji', toId: 'me', courtId: 'c-rinconada', windowStart: iso(day(wd + 1, 18)), windowEnd: iso(day(wd + 1, 19.5)), note: 'Sets after work?', state: 'pending', awaitingId: 'me' }),
    req({ id: 'on1', fromId: 'me', toId: 'p-victor', courtId: 'c-stanford', windowStart: iso(day(wd + 2, 17.5)), windowEnd: iso(day(wd + 2, 19)), state: 'confirmed', awaitingId: null, confirmedAt: iso(day(-1, 9)), plan: { ballsById: 'p-victor', format: 'both', meetAt: 'court', lateById: null } }),
  ],
};

const SHOTS = [
  ['1-discover', '/(tabs)'],
  ['2-invite', '/request/p-elena-r'],
  ['3-my-hits', '/(tabs)/hits'],
  ['4-its-on', '/hit/on1'],
  ['5-club-card', '/(tabs)/you'],
  ['6-player', '/player/p-elena-r'],
];

const { chromium } = require_('playwright');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: 'light', timezoneId: 'America/Los_Angeles' });
await page.goto(`http://localhost:${PORT}/`);
await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hits.demo.v4', JSON.stringify(s)); }, seed);
for (const [name, path] of SHOTS) {
  await page.goto(`http://localhost:${PORT}${path}`);
  await page.waitForTimeout(2000);
  await page.evaluate(() => document.fonts?.ready);
  // Demo-only notes ("Demo mode. Nobody real receives this.") describe this build, not
  // the app people download, so they stay out of the listing.
  await page.evaluate(() => { for (const el of document.querySelectorAll('div')) if (el.childElementCount === 0 && /^Demo mode\b/.test(el.textContent ?? '')) el.style.visibility = 'hidden'; });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log('wrote', name);
}
await browser.close();
server.close();

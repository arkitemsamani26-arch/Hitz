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
const ago = m => new Date(Date.now() - m * 60000).toISOString();
const seed = {
  session: { userId: 'me', phone: '6505550137', isGuardian: false },
  profile: { displayName: 'Arki', lastInitial: 'T', dateOfBirth: '1999-04-02', levelValue: 10.1, levelSource: 'utr_self', homeCourtId: 'c-rinconada', availabilityMask: 4 | 32,
    lookingToHitUntil: iso(day(7, 9)), lastActiveAt: iso(new Date()), guardianEmail: null, guardianVerified: false, guardianSentAt: null, guardianOpenedAt: null, rosterName: null, prefers: 'Practice sets' },
  rosters: [], invites: [], pushToken: null, reports: [], utrClaim: null, messages: [
    { id: 'm1', hitId: 'on1', senderId: 'p-victor', body: 'Court 3 is usually free after 5.', createdAt: ago(190) },
    { id: 'm2', hitId: 'on1', senderId: 'p-victor', body: 'Want to warm up first, then play a set?', createdAt: ago(189) },
    { id: 'm3', hitId: 'on1', senderId: 'me', body: 'Perfect. I have a new can of balls.', createdAt: ago(140) },
    { id: 'm4', hitId: 'on1', senderId: 'p-victor', body: 'See you Thursday', createdAt: ago(12) },
    { id: 'm5', hitId: 'in1', senderId: 'p-kenji', body: 'Happy to do 6:30 if that is easier', createdAt: ago(40) },
  ], reads: { on1: ago(1) }, blocked: [], cohortOpen: true, listMode: null, seenConfirmed: ['on1'],
  requests: [
    req({ id: 'in1', fromId: 'p-kenji', toId: 'me', courtId: 'c-rinconada', windowStart: iso(day(wd + 1, 18)), windowEnd: iso(day(wd + 1, 19.5)), note: 'Sets after work?', state: 'pending', awaitingId: 'me' }),
    req({ id: 'on1', fromId: 'me', toId: 'p-victor', courtId: 'c-stanford', windowStart: iso(day(wd + 2, 17.5)), windowEnd: iso(day(wd + 2, 19)), state: 'confirmed', awaitingId: null, confirmedAt: iso(day(-1, 9)), plan: { ballsById: 'me', format: 'both', meetAt: 'court', lateById: null }, shares: ['p-victor'] }),
  ],
};

// The parent's family view: a 13-year-old with a linked parent, signed in as the parent.
const family = {
  ...seed,
  session: { userId: 'guardian-me', phone: '6505550100', isGuardian: true },
  profile: { ...seed.profile, displayName: 'Maya', lastInitial: 'R', dateOfBirth: '2013-03-14', levelValue: 7.8, homeCourtId: 'c-mitchell',
    guardianEmail: 'parent@example.com', guardianVerified: true, guardianSentAt: ago(9000), guardianOpenedAt: ago(9000), maxPartnerAgeGap: 2 },
  messages: [],
  requests: [req({ id: 'f1', fromId: 'p-clara', toId: 'me', courtId: 'c-mitchell', windowStart: iso(day(wd + 3, 10)), windowEnd: iso(day(wd + 3, 11.5)), note: 'Rally Saturday?', state: 'accepted', awaitingId: null,
    approvals: [{ hitId: 'f1', minorId: 'me', minorName: 'Maya', guardianUserId: 'guardian-me', decision: null, decidedAt: null, createdAt: ago(30) }, { hitId: 'f1', minorId: 'p-clara', minorName: 'Clara', guardianUserId: 'g', decision: true, decidedAt: ago(20) }] })],
};

// A coach with coach tools on and juniors verified, for the coach dashboard.
const coach = { ...seed, coaching: { academy: 'Peninsula Tennis Academy', code: 'PENIN86', verifyAt: ago(600) },
  coachPairs: [{ id: 'cp1', aId: 'p-kenji', bId: 'p-elena-r', courtId: 'c-rinconada', windowStart: iso(day(wd + 1, 18)), windowEnd: iso(day(wd + 1, 19.5)), note: 'Work on returns.', state: 'sent', hitState: 'confirmed', createdAt: ago(2000) }] };

const SHOTS = [
  ['1-discover', '/(tabs)', seed],
  ['2-player-card', '/player/p-elena-r', seed],
  ['3-messages', '/chat/on1', seed],
  ['4-court', '/court/c-rinconada', seed],
  ['5-its-on', '/hit/on1', seed],
  ['6-inbox', '/(tabs)/messages', seed],
  ['7-family', '/guardian', family],
  ['8-coach', '/coach', coach],
];

const { chromium } = require_('playwright');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const page = await browser.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: 'light', timezoneId: 'America/Los_Angeles' });
for (const [name, path, state] of SHOTS) {
  await page.goto(`http://localhost:${PORT}/`);
  await page.evaluate(s => { localStorage.clear(); localStorage.setItem('hits.demo.v4', JSON.stringify(s)); }, state);
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

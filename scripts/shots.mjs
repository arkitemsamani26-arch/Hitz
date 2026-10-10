#!/usr/bin/env node
// Screenshots of the main screens at the widths the design was checked at, in both
// appearances. Reads the exported web build in dist/ and writes PNGs to the given folder.
//
//   npm run export:web && node scripts/shots.mjs out/
import { createServer } from 'node:http';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const DIST = 'dist';
const PORT = Number(process.env.SHOT_PORT ?? 8113);
const OUT = process.argv[2] ?? 'shots';
const require_ = createRequire(import.meta.url);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const serve = () => createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = join(DIST, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  const hit = await stat(file).catch(() => null);
  if (!hit?.isFile()) file = join(DIST, 'index.html');
  try { res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }); res.end(await readFile(file)); }
  catch { res.writeHead(404).end('no'); }
}).listen(PORT);

const day = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
const iso = d => d.toISOString();
const seeded = () => ({
  session: { userId: 'me', phone: '6505550137', isGuardian: false },
  profile: { displayName: 'Arki', lastInitial: 'T', dateOfBirth: '1999-04-02', levelValue: 10.5, levelSource: 'utr_self', homeCourtId: 'c-rinconada', availabilityMask: 4 | 32,
    lookingToHitUntil: iso(day(7, 9)), lastActiveAt: iso(new Date()), guardianEmail: null, guardianVerified: false, guardianSentAt: null, guardianOpenedAt: null, rosterName: null, prefers: 'Rally & practice sets' },
  rosters: [], invites: [], pushToken: null, reports: [], utrClaim: null, messages: [], blocked: [], cohortOpen: true, listMode: null, seenConfirmed: [],
  requests: [
    { id: 'r1', fromId: 'me', toId: 'p-elena-r', courtId: 'c-rinconada', windowStart: iso(day(2, 18)), windowEnd: iso(day(2, 19.5)), note: 'Warm up, then practice sets', state: 'pending', awaitingId: 'p-elena-r', expiresAt: iso(day(3, 9)), createdAt: iso(day(0, 8)), confirmedAt: null, declineReason: null, approvals: [], confirmations: {}, plan: { ballsById: null, format: null, meetAt: null, lateById: null } },
    { id: 'r2', fromId: 'p-kenji', toId: 'me', courtId: 'c-rinconada', windowStart: iso(day(4, 18)), windowEnd: iso(day(4, 19.5)), note: 'Sets?', state: 'pending', awaitingId: 'me', expiresAt: iso(day(5, 9)), createdAt: iso(day(0, 8)), confirmedAt: null, declineReason: null, approvals: [], confirmations: {}, plan: { ballsById: null, format: null, meetAt: null, lateById: null } },
    { id: 'r3', fromId: 'me', toId: 'p-dan', courtId: 'c-stanford', windowStart: iso(day(6, 9)), windowEnd: iso(day(6, 10.5)), note: null, state: 'confirmed', awaitingId: null, expiresAt: iso(day(7, 9)), createdAt: iso(day(-1, 8)), confirmedAt: iso(day(-1, 9)), declineReason: null, approvals: [], confirmations: {}, plan: { ballsById: 'me', format: 'both', meetAt: 'court', lateById: null } },
  ],
});

const SCREENS = [
  ['discover', '/(tabs)'], ['hits', '/(tabs)/hits'], ['club-card', '/(tabs)/you'], ['invite', '/request/p-elena-r'], ['hit-confirmed', '/hit/r3'],
  ['hit-pending', '/hit/r1'], ['preview', '/preview'], ['filters', '/filters'], ['player', '/player/p-elena-r'], ['sign-in', '/onboarding/phone'],
];
const WIDTHS = [390, 402, 320, 430, 1024];

const main = async () => {
  const { chromium } = require_('playwright');
  const server = serve();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const scheme of ['light', 'dark']) {
    for (const width of WIDTHS) {
      if (scheme === 'dark' && width !== 390) continue;
      const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 844 }, colorScheme: scheme, deviceScaleFactor: 2 });
      await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(s => localStorage.setItem('hits.demo.v4', JSON.stringify(s)), seeded());
      for (const [name, path] of SCREENS) {
        if (width !== 390 && width !== 402 && !['discover', 'hits', 'club-card', 'invite'].includes(name)) continue;
        await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1600);
        await page.evaluate(() => document.fonts?.ready);
        await page.screenshot({ path: join(OUT, `${name}-${width}-${scheme}.png`), fullPage: name !== 'discover' && name !== 'preview' });
        if (name === 'discover' || name === 'preview') await page.screenshot({ path: join(OUT, `${name}-${width}-${scheme}-full.png`), fullPage: true });
      }
      const fonts = await page.evaluate(() => [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.style}`).filter((v, i, a) => a.indexOf(v) === i));
      if (scheme === 'light' && width === 390) console.log('fonts loaded:', fonts.join(', '));
      await page.close();
    }
  }
  await browser.close();
  server.close();
  console.log('shots in', OUT);
};
main().catch(e => { console.error(e); process.exit(1); });

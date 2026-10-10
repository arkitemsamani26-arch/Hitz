#!/usr/bin/env node
// Press every button on every screen and report what breaks.
//
//   npm run export:web && npm run crawl
//
// Written because "some of the buttons aren't working" took three attempts to reproduce by
// hand. The first two crawlers gave false negatives -- stale element handles after a
// re-render, and wrapper nodes that report a role but sit behind the thing that actually
// receives the tap. This one re-navigates before every press and taps at the element's
// centre point through the mouse, which is what a finger does and what a floating tab bar
// can intercept.
//
// It is deliberately blunt: it does not know what any button is supposed to do. It knows
// whether pressing it throws, logs an error, or silently does nothing at all -- and
// "nothing at all" is the failure mode that made the app feel broken.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createRequire } from 'node:module';

const DIST = 'dist';
const PORT = Number(process.env.CRAWL_PORT ?? 8112);
const require_ = createRequire(import.meta.url);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wav': 'audio/wav',
};

const serve = () => createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = join(DIST, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ''));
  const hit = await stat(file).catch(() => null);
  if (!hit?.isFile()) file = join(DIST, 'index.html');
  try {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404).end('no'); }
}).listen(PORT);

const day = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d; };
const iso = d => d.toISOString();

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
  ['discover', '/(tabs)'],
  ['my hits', '/(tabs)/hits'],
  ['you', '/(tabs)/you'],
  ['preview', '/preview'],
  ['filters', '/filters'],
  ['player', '/player/p-maya'],
  ['request', '/request/p-maya'],
  ['hit', '/hit/r1'],
  ['verify utr', '/verify-utr'],
  ['delete account', '/delete-account'],
  ['guardian link', '/guardian/link'],
];

// Buttons whose whole job is to leave, reset or destroy. Pressing them tells us nothing
// about the screen under test and wrecks the seeded state for every button after them.
const SKIP = /^(sign out|reset demo|delete my account|open the parent's view)$/i;

const main = async () => {
  let chromium;
  try { ({ chromium } = require_('playwright')); }
  catch { console.error('playwright is not installed here. npm i -D playwright, then re-run.'); process.exit(2); }

  const server = serve();
  const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const page = await browser.newPage({ viewport: { width: 414, height: 896 } });

  const problems = [];
  let errors = [];
  page.on('pageerror', e => errors.push(`threw: ${String(e).split('\n')[0].slice(0, 180)}`));
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // React's dev warnings about keys and act() are noise here; anything else is not.
    if (/Download the React DevTools|useNativeDriver|was not wrapped in act/.test(t)) return;
    errors.push(`console: ${t.slice(0, 180)}`);
  });

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => localStorage.setItem('hits.demo.v4', JSON.stringify(s)), seeded());

  // Toggle state, as one string, so flipping a switch counts as something happening.
  const CHECKS = `window.checkState = () => [...document.querySelectorAll('[role=switch],[aria-checked],input[type=checkbox]')]
      .map(e => (e.getAttribute('aria-checked') ?? (e.checked ? 'true' : 'false'))).join(',');`;
  await page.addInitScript(CHECKS);

  const land = async path => {
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.evaluate(CHECKS);
  };

  // Every pressable, as the DOM sees it, with the label a person would read.
  //
  // This tags each one with its index as it goes, and is the ONLY place that decides what
  // counts as a pressable. An earlier version had a second, slightly different filter for
  // re-finding elements after re-navigating; it left out the visibility check, so the
  // indices drifted whenever a hidden modal was in the tree and the script pressed the
  // wrong element and reported a working button as dead. One definition, used twice.
  const TAG = `(() => {
    const out = [];
    for (const el of document.querySelectorAll('[role=button], [role=link], [role=switch], button, a')) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0) continue;
      if (el.closest('[aria-hidden="true"]')) continue;   // decoration, not a control
      // A pressable wrapping another pressable is a wrapper, not the target.
      if (el.querySelector('[role=button], [role=link], button, a')) continue;
      const label = (el.getAttribute('aria-label') || el.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60);
      el.setAttribute('data-crawl', String(out.length));
      out.push({ i: out.length, key: label || ('#' + out.length), w: r.width, h: r.height,
                 disabled: el.getAttribute('aria-disabled') === 'true', label,
                 role: el.getAttribute('role') || el.tagName.toLowerCase() });
    }
    window.crawlFind = k => k.startsWith('#')
      ? document.querySelector('[data-crawl="' + k.slice(1) + '"]')
      : [...document.querySelectorAll('[data-crawl]')].find(e =>
          ((e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 60)) === k);
    return out;
  })()`;
  const inventory = () => page.evaluate(TAG);

  for (const [screen, path] of SCREENS) {
    await land(path);
    const items = await inventory();
    console.log(`\n=== ${screen}  (${items.length} pressables)`);
    if (!items.length) { problems.push([screen, '(none)', 'no pressables found at all']); console.log('  !! nothing pressable'); continue; }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const name = it.label || `unlabelled ${it.role} #${it.i}`;
      if (!it.key) { console.log(`  gone  ${name}`); continue; }
      if (SKIP.test(it.label)) { console.log(`  skip  ${name}`); continue; }

      // Re-land first: a press from the previous iteration may have navigated or
      // re-rendered, and a coordinate from a stale layout is how the last two crawlers
      // produced false results.
      await land(path);
      await page.evaluate(TAG);

      // Scroll it into view first. A button below the fold is not a broken button, and the
      // first version of this script reported nine of them as failures.
      // Scroll, settle, THEN measure. Measuring in the same evaluate as the scroll read a
      // rect the browser had not finished applying, which is how this script reported
      // seven working court tokens as dead twice over.
      await page.evaluate(k => window.crawlFind(k)?.scrollIntoView({ block: 'center' }), it.key);
      await page.waitForTimeout(450);
      const spot = await page.evaluate(k => {
        const el = window.crawlFind(k);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const x = r.x + r.width / 2, y = r.y + r.height / 2;
        const at = document.elementFromPoint(x, y);
        // What is actually on top at the point a finger would land.
        const owner = at && at.closest('[role=button], [role=link], [role=switch], button, a');
        return { x, y, w: r.width, h: r.height, offscreen: y < 0 || y > innerHeight,
                 covered: owner !== el && !el.contains(at),
                 coveredBy: owner ? ((owner.getAttribute('aria-label') || owner.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'unlabelled')
                                  : (at ? at.tagName.toLowerCase() : 'nothing') };
      }, it.key);
      if (!spot) { console.log(`  gone  ${name}`); continue; }

      const before = await page.evaluate(() => ({ url: location.pathname + location.search, text: document.body.innerText.length, checks: checkState() }));
      errors = [];
      let popped = false;
      const onPopup = () => { popped = true; };
      page.on('popup', onPopup);

      // Tap at the point, through the mouse, so anything painted on top of it intercepts
      // the press exactly as it would on a phone.
      // Two presses, and only a button that ignores both is dead.
      //
      // A held press (down, wait, up) is what a finger does, and it catches a control that
      // shrinks or moves out from under the pointer before the release. A plain click is
      // what a synthetic test does. They are not interchangeable: on the court screen a
      // held press at the left of the canvas is swallowed by something in the gesture
      // layer, so seven working tokens read as dead for three runs of this script. Rather
      // than pick the lenient one and go blind, try the realistic press first and fall back.
      const press = async held => {
        await page.mouse.move(spot.x, spot.y);
        if (!held) { await page.mouse.click(spot.x, spot.y); await page.waitForTimeout(900); return; }
        await page.waitForTimeout(40);
        await page.mouse.down();
        await page.waitForTimeout(90);
        await page.mouse.up();
        await page.waitForTimeout(900);
      };
      const reading = async () => page.evaluate(() => ({ url: location.pathname + location.search, text: document.body.innerText.length, checks: checkState() }));

      await press(true);
      let after = await reading();
      let heldOnly = false;
      if (after.url === before.url && Math.abs(after.text - before.text) <= 12
          && after.checks === before.checks && !popped) {
        await land(path);
        await page.evaluate(TAG);
        await press(false);
        const second = await reading();
        if (second.url !== before.url || Math.abs(second.text - before.text) > 12
            || second.checks !== before.checks || popped) { after = second; heldOnly = true; }
      }

      page.off('popup', onPopup);

      const moved = after.url !== before.url;
      // Three ways a press can be doing its job: it navigated, it changed what is on the
      // screen, it flipped a toggle, or it opened something outside the app.
      const changed = Math.abs(after.text - before.text) > 12
        || after.checks !== before.checks || popped;
      const flags = [];
      if (errors.length) flags.push(...errors);
      // Covered is the finding that matters: the button is there, it is on screen, and
      // something else is taking the press. That is what "the buttons aren't working" was.
      // A disabled control lets the press through to its parent on web; that is the
      // platform, not a bug, so only a live control can be covered.
      if (spot.covered && !it.disabled) flags.push(`COVERED by "${spot.coveredBy}" -- the press never reaches it`);
      else if (spot.offscreen) flags.push('could not be scrolled into view');
      else if (!moved && !changed && !it.disabled) flags.push('nothing happened');
      if (!it.label) flags.push('no accessible label');
      if (spot.w < 44 || spot.h < 44) flags.push(`target is ${Math.round(spot.w)}x${Math.round(spot.h)}, under 44x44`);

      if (flags.length) {
        console.log(`  FAIL  ${name}`);
        for (const f of flags) { console.log(`        ${f}`); problems.push([screen, name, f]); }
      } else {
        console.log(`  ok    ${name}${it.disabled ? ' (disabled, as expected)' : ''}${heldOnly ? ' (only on a plain click -- see note)' : ''}${moved ? ` -> ${after.url}` : ''}`);
      }
    }
  }

  await browser.close();
  server.close();

  console.log('\n' + '-'.repeat(70));
  if (!problems.length) { console.log('every button on every screen did something, and threw nothing.'); process.exit(0); }
  console.log(`${problems.length} problems:`);
  for (const [s, b, f] of problems) console.log(`  ${s} · ${b} · ${f}`);
  process.exit(1);
};

main();

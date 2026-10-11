#!/usr/bin/env node
// Renders the app icon set from one drawing, so every size is the same mark.
//
//   node scripts/icons.mjs
//
// The mark is the Clubhouse wordmark on the deep green, with the court drawn faintly
// behind it, the same as the player card. "Hits" is set in Liberation Sans Bold, which is
// metrically identical to Arial Bold (the wordmark's face) and licensed for this
// (SIL Open Font License). Output goes straight into assets/.
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';

const require_ = createRequire(import.meta.url);
const FONT = readFileSync('/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf').toString('base64');

const GREEN = '#173D2B', CREAM = '#F3EFDB', DOT = '#DFFF4F', DOT_LINE = '#36593D', ART = 'rgba(178,195,156,0.30)';

// The court outline, as in src/ui/CourtArt.tsx: alleys at 13%, service lines at 24%, the
// net at half, rotated 22 degrees and cropped by the edge.
const court = (W, color, line) => {
  const w = W * 0.4, h = w * 230 / 140;
  const b = `position:absolute;border:${line}px solid ${color}`;
  return `<div style="position:absolute;width:${w}px;height:${h}px;right:${-W * 0.12}px;top:${-W * 0.12}px;transform:rotate(22deg)">
    <div style="${b};inset:0"></div>
    <div style="${b};top:0;bottom:0;left:13%;right:13%;border-top:0;border-bottom:0"></div>
    <div style="${b};top:24%;bottom:24%;left:13%;right:13%;border-left:0;border-right:0"></div>
    <div style="${b};left:0;right:0;top:50%;height:0;border-bottom:0;border-left:0;border-right:0"></div>
    <div style="${b};top:24%;bottom:24%;left:50%;width:0;border-top:0;border-bottom:0;border-right:0"></div>
  </div>`;
};

// The wordmark as the app lays it out (src/ui/Wordmark.tsx): 31px type, -1.8 tracking,
// a 9px dot 3px after the s, sitting on the baseline. Everything scales from the size.
const word = (S, color, dotColor = DOT, ring = true) => `
  <div style="display:flex;align-items:flex-end;font-family:Mark;font-weight:700;font-size:${S}px;line-height:1;letter-spacing:${-S * 1.8 / 31}px;color:${color}">
    <span>Hits</span>
    <span style="display:inline-block;width:${S * 9 / 31}px;height:${S * 9 / 31}px;border-radius:50%;background:${dotColor};${ring ? `box-shadow:0 0 0 ${Math.max(1, S / 31)}px ${DOT_LINE};` : ''}margin-left:${S * 3 / 31}px;margin-bottom:${S * 0.04}px"></span>
  </div>`;

const page = (W, H, bg, inner, art = '') => `<!doctype html><html><head><style>
  @font-face { font-family: Mark; src: url(data:font/ttf;base64,${FONT}); font-weight: 700; }
  html, body { margin: 0; background: transparent; }
  #c { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; ${bg ? `background:${bg};` : ''} display: flex; align-items: center; justify-content: center; }
</style></head><body><div id="c">${art}${inner}</div></body></html>`;

const JOBS = [
  // iOS and the store listing: full bleed, no transparency.
  { file: 'assets/icon.png', w: 1024, h: 1024, html: page(1024, 1024, GREEN, word(300, CREAM), court(1024, ART, 3)) },
  // Android adaptive: the background carries the court, the foreground the mark inside
  // the 66% safe circle, the monochrome a single-colour silhouette for themed icons.
  { file: 'assets/android-icon-background.png', w: 512, h: 512, html: page(512, 512, GREEN, '', court(512, ART, 2)) },
  { file: 'assets/android-icon-foreground.png', w: 512, h: 512, html: page(512, 512, null, word(108, CREAM)) },
  { file: 'assets/android-icon-monochrome.png', w: 432, h: 432, html: page(432, 432, null, word(92, '#FFFFFF', '#FFFFFF', false)) },
  // Splash: the green wordmark on the paper colour app.json sets behind it.
  { file: 'assets/splash-icon.png', w: 1024, h: 1024, html: page(1024, 1024, null, word(170, GREEN)) },
  { file: 'assets/favicon.png', w: 48, h: 48, html: page(48, 48, GREEN, word(15, CREAM, DOT, false)) },
];

const { chromium } = require_('playwright');
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
for (const j of JOBS) {
  const page = await browser.newPage({ viewport: { width: j.w, height: j.h }, deviceScaleFactor: 1 });
  await page.setContent(j.html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const png = await page.locator('#c').screenshot({ omitBackground: true });
  writeFileSync(j.file, png);
  console.log('wrote', j.file, `${j.w}x${j.h}`);
  await page.close();
}
await browser.close();

#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:5173/our-wedding-day/' },
    out: { type: 'string', default: 'scripts/screenshots/run' },
  },
});

const URL_BASE = values.url.replace(/\/$/, '') + '/';
const OUT_BASE = values.out;

const VIEWPORTS = [
  { name: 'iphone-15-pro-zoomed', width: 320, height: 693, dpr: 3 },
  { name: 'iphone-mini', width: 375, height: 667, dpr: 2 },
  { name: 'iphone-15-pro', width: 393, height: 852, dpr: 3 },
];

const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

async function captureViewport(browser, vp) {
  const outDir = join(OUT_BASE, vp.name);
  await mkdir(outDir, { recursive: true });

  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dpr,
    isMobile: true,
    hasTouch: true,
    userAgent: IOS_UA,
  });
  const page = await context.newPage();

  try {
    // Opening (intro splash) — pristine, no scroll
    await page.goto(URL_BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: join(outDir, 'opening.png') });
    console.log(`  ✓ opening`);

    // Card opened — scroll past intro to trigger opened state
    await page.evaluate(() => {
      const intro = document.getElementById('home');
      if (!intro) return;
      const target = intro.offsetTop + intro.offsetHeight - window.innerHeight;
      window.scrollTo(0, target);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(outDir, 'card-opened.png') });
    console.log(`  ✓ card-opened`);

    // Gallery — scroll the gallery section into center
    await page.evaluate(() => {
      const el = document.getElementById('gallery');
      el?.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(900);
    // Pause auto-rotation by hovering the gallery
    const gallery = await page.$('.gallery-stage');
    if (gallery) await gallery.hover();
    await page.waitForTimeout(300);

    // Find current active index, then advance to 'portrait' via clicks
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const isPortraitActive = await page.$('figure[data-gallery-id="portrait"].is-active');
      if (isPortraitActive) break;
      const nextBtn = await page.$('.gallery-nav--next');
      if (nextBtn) await nextBtn.click();
      await page.waitForTimeout(280);
    }

    // Wait for Ken Burns to play out (9s animation; capture near end at most extreme crop)
    await page.waitForTimeout(8500);
    const portraitSlide = await page.$('figure[data-gallery-id="portrait"]');
    if (portraitSlide) {
      await portraitSlide.screenshot({ path: join(outDir, 'gallery-portrait-end.png') });
      console.log(`  ✓ gallery-portrait-end`);
    } else {
      console.warn(`  ! portrait slide not found`);
    }

    // Also: gallery overall view (whatever slide is currently active after our advances)
    if (gallery) {
      await gallery.screenshot({ path: join(outDir, 'gallery-stage.png') });
      console.log(`  ✓ gallery-stage`);
    }
  } finally {
    await context.close();
  }
}

async function main() {
  console.log(`URL:  ${URL_BASE}`);
  console.log(`Out:  ${OUT_BASE}`);
  const browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n▶ ${vp.name} (${vp.width}×${vp.height} @${vp.dpr}x)`);
      await captureViewport(browser, vp);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

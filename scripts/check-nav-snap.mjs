#!/usr/bin/env node
import { chromium, webkit } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const URL_BASE = 'http://localhost:4173/our-wedding-day/';
const OUT = 'scripts/screenshots/nav-snap';

async function main() {
  await mkdir(OUT, { recursive: true });
  const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
  console.log(`Using engine: ${engine === webkit ? 'webkit (Safari)' : 'chromium'}`);
  const browser = await engine.launch();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  // First scroll past intro to "open" state
  await page.evaluate(() => {
    const intro = document.getElementById('home');
    if (!intro) return;
    const target = intro.offsetTop + intro.offsetHeight - window.innerHeight;
    window.scrollTo(0, target);
  });
  await page.waitForTimeout(1500);

  const sectionIds = ['gallery', 'venue', 'account', 'guestbook'];

  for (const id of sectionIds) {
    console.log(`\n--- Clicking nav link for #${id} ---`);
    const before = await page.evaluate(() => window.scrollY);
    await page.click(`header.site-nav a[data-section-id="${id}"]`);
    // Wait for scroll to finish
    await page.waitForTimeout(2000);
    const after = await page.evaluate(() => window.scrollY);
    const expected = await page.evaluate((sectionId) => {
      const el = document.getElementById(sectionId);
      return el ? el.offsetTop : null;
    }, id);
    const viewportTop = await page.evaluate(() => window.scrollY);
    const actualOffsetFromTop = await page.evaluate((sectionId) => {
      const el = document.getElementById(sectionId);
      if (!el) return null;
      return el.getBoundingClientRect().top;
    }, id);
    console.log(`  before=${before}, after=${after}`);
    console.log(`  expected section.offsetTop=${expected}`);
    console.log(`  actual section.getBoundingClientRect().top=${actualOffsetFromTop} (should be small positive, ~76 due to scroll-padding-top)`);

    await page.screenshot({ path: join(OUT, `click-${id}.png`) });
  }

  await context.close();
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

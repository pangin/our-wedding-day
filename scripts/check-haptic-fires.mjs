#!/usr/bin/env node
import { chromium } from '@playwright/test';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    window.__vibrateCalls = [];
    const origVibrate = navigator.vibrate ? navigator.vibrate.bind(navigator) : null;
    navigator.vibrate = (pattern) => {
      window.__vibrateCalls.push({ at: Date.now(), pattern });
      return origVibrate ? origVibrate(pattern) : true;
    };
  });

  await page.goto('http://localhost:4173/our-wedding-day/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  await page.evaluate(() => {
    const intro = document.getElementById('home');
    if (intro) window.scrollTo(0, intro.offsetTop + intro.offsetHeight - window.innerHeight);
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__vibrateCalls = []; });

  console.log('Scrolling through sections via mouse wheel...');
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(0, 200);
    await page.waitForTimeout(80);
  }
  await page.waitForTimeout(800);

  const calls = await page.evaluate(() => window.__vibrateCalls);
  console.log(`vibrate calls during wheel scroll: ${calls.length}`);
  console.log('First few:', JSON.stringify(calls.slice(0, 5)));

  console.log('\nClicking nav -> venue');
  await page.evaluate(() => { window.__vibrateCalls = []; });
  await page.click('header.site-nav a[data-section-id="venue"]');
  await page.waitForTimeout(1500);
  const clickCalls = await page.evaluate(() => window.__vibrateCalls);
  console.log(`vibrate calls during click: ${clickCalls.length}`);

  await context.close();
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

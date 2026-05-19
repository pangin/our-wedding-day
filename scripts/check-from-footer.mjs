#!/usr/bin/env node
import { chromium } from '@playwright/test';

const URL_BASE = 'http://localhost:4173/our-wedding-day/';

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Force-open the invitation
  await page.evaluate(() => {
    const intro = document.getElementById('home');
    if (intro) window.scrollTo(0, intro.offsetTop + intro.offsetHeight - window.innerHeight);
  });
  await page.waitForTimeout(1500);

  // Scroll to share (footer)
  await page.evaluate(() => document.getElementById('share')?.scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(2500);

  const beforeShare = await page.evaluate(() => ({
    scrollY: window.scrollY,
    shareTop: document.getElementById('share')?.getBoundingClientRect().top,
    galleryTop: document.getElementById('gallery')?.getBoundingClientRect().top,
  }));
  console.log('At share footer:', beforeShare);

  // Now click nav for gallery
  console.log('\nClicking nav -> gallery');
  await page.click('header.site-nav a[data-section-id="gallery"]');
  await page.waitForTimeout(2500);

  const afterClick = await page.evaluate(() => ({
    scrollY: window.scrollY,
    galleryTop: document.getElementById('gallery')?.getBoundingClientRect().top,
    shareTop: document.getElementById('share')?.getBoundingClientRect().top,
  }));
  console.log('After click gallery:', afterClick);

  // Click venue
  console.log('\nClicking nav -> venue');
  await page.click('header.site-nav a[data-section-id="venue"]');
  await page.waitForTimeout(2500);

  const afterVenue = await page.evaluate(() => ({
    scrollY: window.scrollY,
    venueTop: document.getElementById('venue')?.getBoundingClientRect().top,
  }));
  console.log('After click venue:', afterVenue);

  // Test inertia: simulate fling and check final scroll position doesn't get yanked back
  console.log('\nFling test: scroll mid-gallery and let go');
  await page.evaluate(() => {
    const el = document.getElementById('gallery');
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + 300);
  });
  const initialMidScroll = await page.evaluate(() => window.scrollY);
  await page.waitForTimeout(2500); // wait for any snap to settle
  const finalMidScroll = await page.evaluate(() => window.scrollY);
  console.log(`Mid-section scroll initial=${initialMidScroll}, after 2.5s settle=${finalMidScroll}`);
  console.log(`Moved=${finalMidScroll - initialMidScroll} (should be 0 — no snap when mid-section)`);

  await context.close();
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

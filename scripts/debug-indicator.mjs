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
  await page.goto('http://localhost:4173/our-wedding-day/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Scroll to gallery
  await page.evaluate(() => document.getElementById('gallery')?.scrollIntoView());
  await page.waitForTimeout(2500);

  const sectionRects = await page.evaluate(() => {
    return ['gallery', 'venue', 'account', 'guestbook'].map((id) => {
      const el = document.getElementById(id);
      return el
        ? { id, top: el.getBoundingClientRect().top, bottom: el.getBoundingClientRect().bottom }
        : { id, missing: true };
    });
  });
  console.log('Section rects after scroll:', JSON.stringify(sectionRects));
  console.log('scrollY:', await page.evaluate(() => window.scrollY));

  const info = await page.evaluate(() => {
    const nav = document.querySelector('header.site-nav nav');
    if (!nav) return { found: false };
    const indicator = nav.querySelector('.site-nav__indicator');
    const styles = window.getComputedStyle(indicator);
    const activeLink = nav.querySelector('a[aria-current="page"]');
    return {
      found: true,
      cssVars: {
        x: nav.style.getPropertyValue('--indicator-x'),
        w: nav.style.getPropertyValue('--indicator-w'),
        opacity: nav.style.getPropertyValue('--indicator-opacity'),
      },
      computed: {
        position: styles.position,
        bottom: styles.bottom,
        height: styles.height,
        width: styles.width,
        opacity: styles.opacity,
        background: styles.backgroundColor,
        transform: styles.transform,
      },
      activeLinkId: activeLink?.getAttribute('data-section-id') || null,
      navRect: nav.getBoundingClientRect().toJSON(),
      indicatorRect: indicator.getBoundingClientRect().toJSON(),
    };
  });

  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'scripts/screenshots/nav-snap/debug-indicator.png', clip: { x: 0, y: 0, width: 393, height: 80 } });

  await context.close();
  await browser.close();
}

main().catch((err) => { console.error(err); process.exit(1); });

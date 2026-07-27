import { test, expect } from '@playwright/test';

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'pixel-5', width: 412, height: 915 },
  { name: 'ipad', width: 810, height: 1080 },
] as const;

const PAGES = ['/swipe', '/pick', '/matches'] as const;

for (const viewport of VIEWPORTS) {
  for (const pagePath of PAGES) {
    const safeFileName = pagePath.replace(/\//g, '-') + '-' + viewport.name + '.png';
    test(pagePath + ' at ' + viewport.name + ' -- visual baseline', async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(pagePath);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveScreenshot(safeFileName, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
}

test('login page at iphone-se -- visual baseline', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('login-iphone-se.png', {
    fullPage: true,
    animations: 'disabled',
    maxDiffPixelRatio: 0.01,
  });
});

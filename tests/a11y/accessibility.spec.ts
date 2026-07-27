import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const VIEWPORTS = [
  { name: 'iphone-se', width: 375, height: 667 },
  { name: 'pixel-5', width: 412, height: 915 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

for (const viewport of VIEWPORTS) {
  test('/login at ' + viewport.name + ' -- no critical a11y violations', async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const critical = results.violations.filter(
      (v: { impact: string }) => v.impact === 'critical' || v.impact === 'serious'
    );
    expect(critical).toEqual([]);
  });
}

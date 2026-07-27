import { test, expect } from '@playwright/test';

test('app loads and shows login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.locator('text=Choose Your Profile')).toBeVisible();
});

test('navigation works', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('nav')).toBeVisible();
});

import { test, expect } from './fixtures';
import { loginAs, selectMood } from './helpers';

test.describe('Mood-Based Filtering', () => {
  test('mood selector renders with genre and vibe chips', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
    await expect(page.locator('text="In the mood for"')).toBeVisible();
    await expect(page.locator('text="Not in the mood for"')).toBeVisible();

    const genreChips = ['Thriller', 'Comedy', 'Romance', 'Sci-Fi', 'Drama', 'Horror', 'Action', 'Documentary', 'Animation'];
    for (const chip of genreChips) {
      await expect(page.locator(`button:has-text("${chip}")`)).toBeVisible();
    }

    const vibeChips = ['Cozy', 'Intense', 'Feel-Good', 'Dark', 'Nostalgic', 'Mind-Bending'];
    for (const chip of vibeChips) {
      await expect(page.locator(`button:has-text("${chip}")`)).toBeVisible();
    }
  });

  test('selecting a mood chip highlights it', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    const sciFiButton = page.locator('button', { hasText: 'Sci-Fi' }).first();
    await sciFiButton.click();

    await expect(sciFiButton).toHaveClass(/bg-rose-600/);
    await expect(sciFiButton).toHaveClass(/text-white/);
    await expect(sciFiButton).toHaveClass(/shadow-md/);
  });

  test('selecting an avoid chip shows line-through', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    const horrorAvoidSection = page.locator('text="Not in the mood for"').locator('..').locator('..');
    const horrorButton = horrorAvoidSection.locator('button', { hasText: 'Horror' }).first();
    await horrorButton.click();

    await expect(horrorButton).toHaveClass(/bg-red-900\/60/);
    await expect(horrorButton).toHaveClass(/line-through/);
    await expect(horrorButton).toHaveClass(/text-red-300/);
  });

  test('mood chip and avoid chip are mutually exclusive', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    const moodSciFi = page.locator('button', { hasText: 'Sci-Fi' }).first();
    await moodSciFi.click();

    await expect(moodSciFi).toHaveClass(/bg-rose-600/);

    const avoidSciFi = page.locator('text="Not in the mood for"').locator('..').locator('..').locator('button', { hasText: 'Sci-Fi' }).first();
    await avoidSciFi.click();

    await expect(avoidSciFi).toHaveClass(/bg-red-900\/60/);
    await expect(avoidSciFi).toHaveClass(/line-through/);

    const moodSciFiAgain = page.locator('button', { hasText: 'Sci-Fi' }).first();
    await expect(moodSciFiAgain).not.toHaveClass(/bg-rose-600/);
  });

  test('"Surprise Me" clears all selections', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi', 'Horror']);

    const url = page.url();
    expect(url).toContain('mood=');

    await page.locator('text="Surprise Me!"').click();

    await page.waitForFunction(() => {
      const url = window.location.href;
      return !url.includes('mood=') || url.includes('mood-hidden');
    }, { timeout: 3_000 });

    const chips = page.locator('[class*="bg-rose-600"]');
    await expect(chips).toHaveCount(0);
  });

  test('"Skip" hides the mood selector', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await page.locator('text="Skip, show me everything"').click();

    await expect(page.locator('text="What\'s your mood?"')).not.toBeVisible();
    await expect(page.locator('text="Show mood filters"')).toBeVisible();

    await expect(page).toHaveURL(/mood-hidden=true/);
  });

  test('"Show mood filters" brings it back after skip', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await page.locator('text="Skip, show me everything"').click();
    await expect(page.locator('text="Show mood filters"')).toBeVisible();

    await page.locator('text="Show mood filters"').click();

    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
    await expect(page.locator('text="In the mood for"')).toBeVisible();
  });

  test('free-text mood input expands on click', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await expect(page.locator('text="Or describe your mood..."')).toBeVisible();
    await expect(page.locator('input[placeholder*="something light"]')).not.toBeVisible();

    await page.locator('text="Or describe your mood..."').click();

    await expect(page.locator('input[placeholder*="something light"]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Apply' })).toBeVisible();
  });

  test('collapse/expand toggle works', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi']);

    await expect(page.locator('text="Collapse"')).toBeVisible();
    await page.locator('text="Collapse"').click();

    await expect(page.locator('text="What\'s your mood?"')).not.toBeVisible();
    await expect(page.locator('text="Mood:"')).toBeVisible();
    await expect(page.locator('text="Sci-Fi"')).toBeVisible();

    await page.locator('text="Edit"').click();

    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
  });

  test('mood persists in URL params after selection', async ({ page }) => {
    await loginAs(page, 'Partner 1');
    await page.waitForSelector('h2', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi', 'Drama']);

    await page.waitForFunction(() => {
      const url = window.location.href;
      return url.includes('mood=');
    }, { timeout: 3_000 });

    const url = page.url();
    expect(url).toContain('mood=');
    expect(url).toContain('Sci-Fi');
    expect(url).toContain('Drama');
  });
});

import { test, expect } from './fixtures';
import { loginAs, selectMood, goToPick, PARTNER_1_NAME } from './helpers';

test.describe('Mood-Based Filtering', () => {
  test('mood selector renders with genre and vibe chips', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
    await expect(page.locator('text="In the mood for"')).toBeVisible();
    await expect(page.locator('text="Not in the mood for"')).toBeVisible();

    const genreChips = ['Thriller', 'Comedy', 'Romance', 'Sci-Fi', 'Drama', 'Horror', 'Action', 'Documentary', 'Animation'];
    for (const chip of genreChips) {
      await expect(page.locator(`button:has-text("${chip}")`).first()).toBeVisible();
    }

    const vibeChips = ['Cozy', 'Intense', 'Feel-Good', 'Dark', 'Nostalgic', 'Mind-Bending'];
    for (const chip of vibeChips) {
      await expect(page.locator(`button:has-text("${chip}")`).first()).toBeVisible();
    }
  });

  test('selecting a mood chip highlights it', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    const sciFiButton = page.locator('button', { hasText: 'Sci-Fi' }).first();
    await sciFiButton.click();

    await expect(sciFiButton).toHaveClass(/bg-rose-600/);
    await expect(sciFiButton).toHaveClass(/text-white/);
  });

  test('selecting an avoid chip shows line-through', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    const avoidSection = page.locator('text="Not in the mood for"').locator('..');
    const horrorButton = avoidSection.locator('button', { hasText: 'Horror' }).first();
    await horrorButton.click();

    await expect(horrorButton).toHaveClass(/bg-red/);
    await expect(horrorButton).toHaveClass(/line-through/);
  });

  test('mood chip and avoid chip are mutually exclusive', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    const moodSciFi = page.locator('text="In the mood for"').locator('..').locator('button', { hasText: 'Sci-Fi' }).first();
    await moodSciFi.click();
    await expect(moodSciFi).toHaveClass(/bg-rose/);

    const avoidSection = page.locator('text="Not in the mood for"').locator('..');
    const avoidSciFi = avoidSection.locator('button', { hasText: 'Sci-Fi' }).first();
    await avoidSciFi.click();

    await expect(avoidSciFi).toHaveClass(/bg-red/);
    await expect(avoidSciFi).toHaveClass(/line-through/);
    await expect(moodSciFi).not.toHaveClass(/bg-rose/);
  });

  test('"Surprise Me" clears all selections', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi', 'Horror']);
    expect(page.url()).toContain('mood=');

    await page.locator('button:has-text("Surprise Me")').click();
    await page.waitForTimeout(500);

    // After Surprise Me, mood param should be gone
    expect(page.url()).not.toContain('mood=');
  });

  test('"Skip" hides the mood selector', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await page.locator('button:has-text("Skip")').click();

    await expect(page.locator('text="What\'s your mood?"')).not.toBeVisible();
    await expect(page.locator('text="Show mood filters"')).toBeVisible();
    await expect(page).toHaveURL(/mood-hidden=true/);
  });

  test('"Show mood filters" brings it back after skip', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await page.locator('button:has-text("Skip")').click();
    await expect(page.locator('text="Show mood filters"')).toBeVisible();

    await page.locator('text="Show mood filters"').click();
    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
    await expect(page.locator('text="In the mood for"')).toBeVisible();
  });

  test('free-text mood input expands on click', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    const freeTextButton = page.locator('button:has-text("describe your mood")');
    await expect(freeTextButton).toBeVisible();

    await freeTextButton.click();
    await expect(page.locator('input[placeholder*="something light"]')).toBeVisible();
    await expect(page.locator('button', { hasText: 'Apply' })).toBeVisible();
  });

  test('collapse/expand toggle works', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi']);

    await expect(page.locator('text="Collapse"')).toBeVisible();
    await page.locator('text="Collapse"').click();

    await expect(page.locator('text="What\'s your mood?"')).not.toBeVisible();
    await expect(page.locator('text="Edit"')).toBeVisible();
    await expect(page.locator('text="Sci-Fi"')).toBeVisible();

    await page.locator('text="Edit"').click();
    await expect(page.locator('text="What\'s your mood?"')).toBeVisible();
  });

  test('mood persists in URL params after selection', async ({ page }) => {
    await loginAs(page, PARTNER_1_NAME);
    await goToPick(page);
    await page.waitForSelector('h3', { timeout: 10_000 });

    await selectMood(page, ['Sci-Fi', 'Drama']);

    await page.waitForFunction(() => {
      return window.location.href.includes('mood=');
    }, { timeout: 5_000 });

    const url = page.url();
    expect(url).toContain('mood=');
    expect(url).toContain('Sci-Fi');
    expect(url).toContain('Drama');
  });
});

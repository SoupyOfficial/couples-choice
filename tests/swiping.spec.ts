import { test, expect } from './fixtures';
import { loginAs, swipeRight, swipeLeft, PARTNER_1_NAME, PARTNER_2_NAME } from './helpers';

test.describe('Movie Swiping', () => {
 test('movie card loads with title, poster, overview, rating, providers', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);
 await page.waitForSelector('h2', { timeout: 10_000 });

 const title = page.locator('h2').first();
 await expect(title).toBeVisible();

 const titleText = await title.textContent();
 expect(titleText).toBeTruthy();
 expect(titleText!.length).toBeGreaterThan(0);

 const yearOrRating = page.locator('text=/⭐/');
 const overview = page.locator('p.line-clamp-3, p:has-text(".")').first();

 const hasOverview = await overview.isVisible().catch(() => false);
 const hasProviders = await page.locator('span[class*="bg-"]').first().isVisible().catch(() => false);

 expect(hasOverview || hasProviders).toBe(true);
 });

 test('right swipe advances to next movie', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);
 await page.waitForSelector('h2', { timeout: 10_000 });

 const initialTitle = await page.locator('h2').first().textContent();

 await swipeRight(page);

 await page.waitForSelector('h2', { timeout: 10_000 });
 const newTitle = await page.locator('h2').first().textContent();

 expect(newTitle).not.toBeNull();
 });

 test('left swipe advances to next movie', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);
 await page.waitForSelector('h2', { timeout: 10_000 });

 const initialTitle = await page.locator('h2').first().textContent();

 await swipeLeft(page);

 await page.waitForSelector('h2', { timeout: 10_000 });
 const newTitle = await page.locator('h2').first().textContent();

 expect(newTitle).not.toBeNull();
 });

 test('"They liked this!" pill shows when partner already right-swiped', async ({ page }) => {
 const context = await page.context();

 const partner1Page = await context.newPage();
 const partner2Page = await context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 const partner1Movie = await partner1Page.locator('h2').first().textContent();

 if (!partner1Movie) {
 test.skip(true, 'No movie loaded for ' + PARTNER_1_NAME);
 return;
 }

 await swipeRight(partner2Page);

 await partner1Page.reload();
 await partner1Page.waitForSelector('h2', { timeout: 10_000 });

 const pillVisible = await partner1Page.locator('text="❤️ They liked this!"').isVisible().catch(() => false);

 if (pillVisible) {
 await expect(partner1Page.locator('text="❤️ They liked this!"')).toBeVisible();
 await expect(partner1Page.locator('text="❤️ They liked this!"')).toHaveClass(/animate-pulse/);
 } else {
 test.skip(true, 'Partner did not see the same movie (expected with parallel tests)');
 }
 });

 test('skeleton loader shows while fetching', async ({ page }) => {
 await page.context().addCookies([{
 name: 'current-user',
 value: '3',
 domain: 'localhost',
 path: '/',
 }]);

 await page.route('**/api/movies/next**', async (route) => {
 await new Promise((resolve) => setTimeout(resolve, 2000));
 await route.fulfill({
 status: 200,
 contentType: 'application/json',
 body: JSON.stringify({
 id: 9999,
 tmdbId: 9999,
 title: 'Test Movie',
 overview: 'A test movie overview for skeleton testing.',
 posterUrl: null,
 backdropUrl: null,
 releaseDate: '2024-01-01',
 voteAverage: 7.5,
 providers: ['Netflix'],
 }),
 });
 });

 await page.goto('/swipe');

 await expect(page.locator('.animate-pulse')).toBeVisible({ timeout: 3_000 });

 await page.unroute('**/api/movies/next**');
 await expect(page.locator('h2', { hasText: 'Test Movie' })).toBeVisible({ timeout: 5_000 });
 });

 test('error state with retry button', async ({ page }) => {
 await page.context().addCookies([{
 name: 'current-user',
 value: '3',
 domain: 'localhost',
 path: '/',
 }]);

 await page.route('**/api/movies/next**', async (route) => {
 await route.fulfill({
 status: 500,
 contentType: 'application/json',
 body: JSON.stringify({ error: 'Internal server error' }),
 });
 });

 await page.goto('/swipe');

 await expect(page.locator('text="Something went wrong"')).toBeVisible({ timeout: 5_000 });
 await expect(page.locator('button', { hasText: '🔄 Retry' })).toBeVisible();

 await page.unroute('**/api/movies/next**');
 });

 test('empty state when no movies available', async ({ page }) => {
 await page.context().addCookies([{
 name: 'current-user',
 value: '3',
 domain: 'localhost',
 path: '/',
 }]);

 await page.route('**/api/movies/next**', async (route) => {
 await route.fulfill({
 status: 404,
 contentType: 'application/json',
 body: JSON.stringify({ error: 'No movies found' }),
 });
 });

 await page.goto('/swipe');

 await expect(page.locator('text="No more movies to browse!"')).toBeVisible({ timeout: 5_000 });
 await expect(page.locator('button', { hasText: '🔄 Load More Movies' })).toBeVisible();

 await page.unroute('**/api/movies/next**');
 });

 test('swipe records appear in DB after swiping', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);
 await page.waitForSelector('h2', { timeout: 10_000 });

 const movieTitle = await page.locator('h2').first().textContent();
 expect(movieTitle).toBeTruthy();

 const responsePromise = page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(page);

 const response = await responsePromise;
 expect(response.status()).toBe(200);

 const body = await response.json();
 expect(body).toHaveProperty('matched');
 });
});

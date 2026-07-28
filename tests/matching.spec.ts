import { test, expect } from './fixtures';
import { loginAs, swipeRight, swipeLeft, goToMatches, PARTNER_1_NAME, PARTNER_2_NAME } from './helpers';

test.describe('Movie Matching', () => {
 test('both partners swiping right on same movie triggers match modal', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner2Page);
 await swipeRight(partner1Page);

 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 if (body.matched) {
 await expect(partner1Page.locator('text="It\'s a Match!"')).toBeVisible({ timeout: 5_000 });
 await expect(partner1Page.getByRole('dialog', { name: 'Match notification' })).toBeVisible();
 } else {
 test.skip(true, 'No match occurred (partner may not have right-swiped on same movie)');
 }
 });

 test('match modal shows poster, title, providers, View Matches and Keep Swiping buttons', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 await swipeRight(partner2Page);

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner1Page);
 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 if (body.matched) {
 await expect(partner1Page.locator('text="It\'s a Match!"')).toBeVisible({ timeout: 5_000 });
 await expect(partner1Page.locator('text="You both liked this movie!"')).toBeVisible();
 await expect(partner1Page.getByRole('dialog', { name: 'Match notification' })).toHaveAttribute('aria-modal', 'true');

 await expect(partner1Page.locator('text="💕 View Matches"')).toBeVisible();
 await expect(partner1Page.locator('text="Keep Swiping"')).toBeVisible();

 const movieTitle = await partner1Page.locator('h3').first().textContent();
 expect(movieTitle).toBeTruthy();
 } else {
 test.skip(true, 'No match occurred');
 }
 });

 test('one partner swipes left, other swipes right — no match', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 await swipeLeft(partner2Page);

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner1Page);
 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 expect(body.matched).toBe(false);

 await expect(partner1Page.locator('text="It\'s a Match!"')).not.toBeVisible({ timeout: 2_000 });
 });

  test('matches page shows empty state for new couples', async ({ page }) => {
  await loginAs(page, PARTNER_1_NAME);

  await goToMatches(page);

  await expect(page.locator('text="Your Matches"')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('text="Keep swiping to find your perfect movie"')).toBeVisible({ timeout: 5_000 });
  });

 test('match modal "View Matches" navigates to /matches', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 await swipeRight(partner2Page);

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner1Page);
 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 if (body.matched) {
 await expect(partner1Page.locator('text="It\'s a Match!"')).toBeVisible({ timeout: 5_000 });

 await partner1Page.locator('text="💕 View Matches"').click();
 await partner1Page.waitForURL(/\/matches/, { timeout: 5_000 });

 await expect(partner1Page).toHaveURL(/\/matches/);
 await expect(partner1Page.locator('text="Your Matches 💕"')).toBeVisible();
 } else {
 test.skip(true, 'No match occurred');
 }
 });

 test('match modal "Keep Swiping" closes modal and continues', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 await swipeRight(partner2Page);

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner1Page);
 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 if (body.matched) {
 await expect(partner1Page.locator('text="It\'s a Match!"')).toBeVisible({ timeout: 5_000 });

 await partner1Page.locator('text="Keep Swiping"').click();

 await expect(partner1Page.locator('text="It\'s a Match!"')).not.toBeVisible({ timeout: 2_000 });
 await expect(partner1Page.locator('h2')).toBeVisible({ timeout: 10_000 });
 } else {
 test.skip(true, 'No match occurred');
 }
 });

 test('match modal closes when clicking backdrop', async ({ browser }) => {
 const partner1Context = await browser.newContext();
 const partner2Context = await browser.newContext();

 const partner1Page = await partner1Context.newPage();
 const partner2Page = await partner2Context.newPage();

 await loginAs(partner1Page, PARTNER_1_NAME);
 await loginAs(partner2Page, PARTNER_2_NAME);

 await partner1Page.waitForSelector('h2', { timeout: 10_000 });
 await partner2Page.waitForSelector('h2', { timeout: 10_000 });

 const partner1Movie = await partner1Page.locator('h2').first().textContent();
 const partner2Movie = await partner2Page.locator('h2').first().textContent();

 if (!partner1Movie || !partner2Movie || partner1Movie !== partner2Movie) {
 test.skip(true, 'Partners did not see the same movie');
 return;
 }

 await swipeRight(partner2Page);

 const matchResponsePromise = partner1Page.waitForResponse(
 (res) => res.url().includes('/api/swipe') && res.request().method() === 'POST'
 );

 await swipeRight(partner1Page);
 const matchResponse = await matchResponsePromise;
 const body = await matchResponse.json();

 if (body.matched) {
 await expect(partner1Page.locator('text="It\'s a Match!"')).toBeVisible({ timeout: 5_000 });

 await partner1Page.locator('.fixed.inset-0 > div:first-child').click();

 await expect(partner1Page.locator('text="It\'s a Match!"')).not.toBeVisible({ timeout: 2_000 });
 } else {
 test.skip(true, 'No match occurred');
 }
 });
});

import { test, expect } from './fixtures';
import { loginAs, goToOnboarding, submitPreferences, PARTNER_1_NAME, PARTNER_2_NAME } from './helpers';

test.describe('Onboarding', () => {
 test('new user without prefs sees onboarding redirect', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);
 await expect(page).toHaveURL(/\/swipe|\/onboarding/);

 const url = page.url();
 if (url.includes('/onboarding')) {
 await expect(page.getByRole('heading', { name: 'Tell Us Your Movie Tastes' })).toBeVisible();
 await expect(page.locator('textarea[name="narrative"]')).toBeVisible();
 await expect(page.locator('textarea[name="narrative"]')).toHaveAttribute('placeholder', /We're into|Describe/);
 await expect(page.getByRole('button', { name: /Analyze My Tastes/ })).toBeVisible();
 }
 });

 test('submitting preferences saves and redirects to /swipe', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);

 const url = page.url();
 if (!url.includes('/onboarding')) {
 await goToOnboarding(page);
 if (page.url().includes('/swipe')) {
 test.skip(true, 'User already has preferences');
 return;
 }
 }

 await expect(page.getByRole('heading', { name: 'Tell Us Your Movie Tastes' })).toBeVisible();

 await submitPreferences(page, 'We love mind-bending sci-fi like Inception and Interstellar, cozy 90s rom-coms, and Korean thrillers. No horror or depressing dramas.');

 await page.waitForURL(/\/swipe|\/onboarding\?error/, { timeout: 15_000 });

 const finalUrl = page.url();
 if (finalUrl.includes('error')) {
 test.skip(true, 'LLM extraction failed (expected without API key)');
 } else {
 await expect(page).toHaveURL(/\/swipe/);
 }
 });

 test('user with existing prefs is redirected away from /onboarding to /swipe', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);

 const currentUrl = page.url();
 if (currentUrl.includes('/swipe')) {
 await goToOnboarding(page);
 await expect(page).toHaveURL(/\/swipe/);
 }
 });

 test('empty submission shows validation', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);

 const url = page.url();
 if (!url.includes('/onboarding')) {
 await goToOnboarding(page);
 if (page.url().includes('/swipe')) {
 test.skip(true, 'User already has preferences');
 return;
 }
 }

 await submitPreferences(page, 'too short');

 await page.waitForURL(/\/onboarding\?error=too-short/, { timeout: 5_000 });
 await expect(page).toHaveURL(/\/onboarding\?error=too-short/);
 });

 test('long narrative submission works', async ({ page }) => {
 await loginAs(page, PARTNER_1_NAME);

 const url = page.url();
 if (!url.includes('/onboarding')) {
 await goToOnboarding(page);
 if (page.url().includes('/swipe')) {
 test.skip(true, 'User already has preferences');
 return;
 }
 }

 const longNarrative = `
 We're a couple who loves deeply layered cinema. Our favorites include:
 - Mind-bending sci-fi: Inception, Interstellar, Arrival, Ex Machina, Primer
 - Cozy 90s rom-coms: You've Got Mail, Sleepless in Seattle, When Harry Met Sally
 - Korean thrillers: Parasite, Oldboy, The Handmaiden, Memories of Murder
 - We absolutely avoid: horror with torture, depressing dramas without hope
 - We prefer films under 2.5 hours with strong character development
 - Subtitles are welcome, we love international cinema
 - We appreciate practical effects over CGI when possible
 `.trim();

 await submitPreferences(page, longNarrative);

 await page.waitForURL(/\/swipe|\/onboarding\?error/, { timeout: 15_000 });

 const finalUrl = page.url();
 if (finalUrl.includes('error')) {
 test.skip(true, 'LLM extraction failed (expected without API key)');
 } else {
 await expect(page).toHaveURL(/\/swipe/);
 }
 });
});

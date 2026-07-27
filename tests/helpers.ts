import { Page } from '@playwright/test';

// Persona user names from seed-personas.ts — use these for all tests
export const PARTNER_1_NAME = "Margaret";
export const PARTNER_2_NAME = "Harold";

export async function loginAs(page: Page, userName: string) {
  await page.goto('/login');
  await page.locator(`button:has-text("${userName}")`).click();
  await page.waitForURL('/swipe');
}

export async function swipeRight(page: Page) {
  await page.locator('button[aria-label="Like"]').click();
  await page.waitForTimeout(500);
}

export async function swipeLeft(page: Page) {
  await page.locator('button[aria-label="Pass"]').click();
  await page.waitForTimeout(500);
}

export async function goToOnboarding(page: Page) {
  await page.goto('/onboarding');
}

export async function submitPreferences(page: Page, narrative: string) {
  await page.locator('textarea').fill(narrative);
  await page.locator('button[type="submit"]').click();
}

export async function selectMood(page: Page, moods: string[]) {
  for (const mood of moods) {
    await page.locator(`button:has-text("${mood}")`).first().click();
  }
}

export async function goToMatches(page: Page) {
  await page.goto('/matches');
}

export async function goToPick(page: Page) {
  await page.goto('/pick');
}

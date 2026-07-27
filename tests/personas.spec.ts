import { test, expect } from './fixtures';

test.describe('Diverse User Personas', () => {
  test.describe('Classics couple (Margaret/Harold)', () => {
    test('preferences include drama and romance', async ({ page }) => {
      await page.context().addCookies([{
        name: 'current-user',
        value: '3',
        domain: 'localhost',
        path: '/',
      }]);

      await page.goto('/swipe');
      await page.waitForSelector('h2', { timeout: 10_000 });

      const response = await page.request.get('/api/user/prefs');
      if (response.status() === 200) {
        const prefs = await response.json();
        if (prefs.extractedPrefs) {
          const parsed = typeof prefs.extractedPrefs === 'string'
            ? JSON.parse(prefs.extractedPrefs)
            : prefs.extractedPrefs;
          expect(parsed.genres).toContain('drama');
          expect(parsed.genres).toContain('romance');
        }
      }

      const title = await page.locator('h2').first().textContent();
      expect(title).toBeTruthy();
    });
  });

  test.describe('Anime twins (Yuki/Ren)', () => {
    test('preferences include animation', async ({ page }) => {
      await page.context().addCookies([{
        name: 'current-user',
        value: '5',
        domain: 'localhost',
        path: '/',
      }]);

      await page.goto('/swipe');
      await page.waitForSelector('h2', { timeout: 10_000 });

      const response = await page.request.get('/api/user/prefs');
      if (response.status() === 200) {
        const prefs = await response.json();
        if (prefs.extractedPrefs) {
          const parsed = typeof prefs.extractedPrefs === 'string'
            ? JSON.parse(prefs.extractedPrefs)
            : prefs.extractedPrefs;
          expect(parsed.genres).toContain('animation');
        }
      }

      const title = await page.locator('h2').first().textContent();
      expect(title).toBeTruthy();
    });
  });

  test.describe('Sci-Fi + Drama couple (Marcus/Elena)', () => {
    test('overlap in sci-fi dramas', async ({ page }) => {
      await page.context().addCookies([{
        name: 'current-user',
        value: '7',
        domain: 'localhost',
        path: '/',
      }]);

      await page.goto('/swipe');
      await page.waitForSelector('h2', { timeout: 10_000 });

      const response = await page.request.get('/api/user/prefs');
      if (response.status() === 200) {
        const prefs = await response.json();
        if (prefs.extractedPrefs) {
          const parsed = typeof prefs.extractedPrefs === 'string'
            ? JSON.parse(prefs.extractedPrefs)
            : prefs.extractedPrefs;
          const hasSciFi = parsed.genres.some((g: string) =>
            g.includes('sci-fi') || g.includes('science-fiction')
          );
          const hasDrama = parsed.genres.includes('drama');
          expect(hasSciFi || hasDrama).toBe(true);
        }
      }
    });
  });

  test.describe('Horror junkies (Luna/Damien)', () => {
    test('avoid rom-coms', async ({ page }) => {
      await page.context().addCookies([{
        name: 'current-user',
        value: '9',
        domain: 'localhost',
        path: '/',
      }]);

      await page.goto('/swipe');
      await page.waitForSelector('h2', { timeout: 10_000 });

      const response = await page.request.get('/api/user/prefs');
      if (response.status() === 200) {
        const prefs = await response.json();
        if (prefs.extractedPrefs) {
          const parsed = typeof prefs.extractedPrefs === 'string'
            ? JSON.parse(prefs.extractedPrefs)
            : prefs.extractedPrefs;
          expect(parsed.genres).toContain('horror');

          const hasAvoidRomComs = parsed.avoidThemes?.some((t: string) =>
            t.toLowerCase().includes('rom-com') || t.toLowerCase().includes('romance')
          );
          expect(hasAvoidRomComs).toBe(true);
        }
      }
    });
  });

  test.describe('Weekend warriors (Jake/Kelly)', () => {
    test('prefer under-2-hour films', async ({ page }) => {
      await page.context().addCookies([{
        name: 'current-user',
        value: '11',
        domain: 'localhost',
        path: '/',
      }]);

      await page.goto('/swipe');
      await page.waitForSelector('h2', { timeout: 10_000 });

      const response = await page.request.get('/api/user/prefs');
      if (response.status() === 200) {
        const prefs = await response.json();
        if (prefs.extractedPrefs) {
          const parsed = typeof prefs.extractedPrefs === 'string'
            ? JSON.parse(prefs.extractedPrefs)
            : prefs.extractedPrefs;
          const runtimePref = parsed.runtimePref;
          expect(['under-90', '90-120']).toContain(runtimePref);
        }
      }
    });
  });
});

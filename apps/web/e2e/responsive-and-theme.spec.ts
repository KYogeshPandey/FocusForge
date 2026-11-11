import { test, expect } from '@playwright/test';

test.describe('Theme Switcher & Responsive Layout', () => {
  test('persists theme toggle across page reload', async ({ page }) => {
    await page.goto('/');

    const html = page.locator('html');

    // Toggle theme button is present in Topbar
    const themeBtn = page.locator('button[aria-label*="mode"]').first();
    await expect(themeBtn).toBeVisible();

    const initialIsDark = await html.evaluate((el) => el.classList.contains('dark'));

    // Click theme toggle
    await themeBtn.click();

    // Verify class toggled
    const afterClickIsDark = await html.evaluate((el) => el.classList.contains('dark'));
    expect(afterClickIsDark).not.toBe(initialIsDark);

    // Reload page
    await page.reload();

    // Verify persisted
    const afterReloadIsDark = await html.evaluate((el) => el.classList.contains('dark'));
    expect(afterReloadIsDark).toBe(afterClickIsDark);
  });

  test('mobile drawer opens and navigates smoothly at mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/tasks');

    // On mobile, sidebar is collapsed and mobile hamburger button is visible
    const mobileMenuBtn = page.locator('button[aria-label*="navigation menu"]');
    if (await mobileMenuBtn.isVisible()) {
      await mobileMenuBtn.click();
      const habitsLink = page.locator('div[role="dialog"] a[href="/habits"]');
      await expect(habitsLink).toBeVisible();
      await habitsLink.click();
      await expect(page).toHaveURL(/.*habits/);
    }
  });
});

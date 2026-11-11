import { test, expect } from '@playwright/test';

test.describe('Guest to Account Local Data Migration Wizard', () => {
  const timestamp = Date.now();
  const user = {
    name: 'Migrating Student',
    email: `migrator_${timestamp}@focusforge.dev`,
    password: 'Password123!',
  };

  test('prompts to import local data on first login and successfully migrates records', async ({
    page,
  }) => {
    // 1. Visit root to seed localStorage as a guest user with custom data
    await page.goto('/');

    await page.evaluate(() => {
      const customTask = {
        id: 'local-task-unique-99',
        userId: 'local-user',
        title: 'Offline Guest Research Notes',
        subject: 'Philosophy',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-11-05',
        estimatedMinutes: 45,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const settings = {
        theme: 'dark',
        timer: {
          focusDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          longBreakInterval: 4,
          autoStartBreaks: false,
          autoStartFocus: false,
          soundEnabled: false,
        },
        weekStartsOn: 1,
        defaultView: 'dashboard',
        compactMode: false,
        demoDataLoaded: false, // Explicitly false = real user data, not demo
      };

      localStorage.setItem('focusforge_v1_tasks', JSON.stringify([customTask]));
      localStorage.setItem('focusforge_v1_settings', JSON.stringify(settings));
      localStorage.setItem('focusforge_v1_initialized', 'true');
      localStorage.removeItem('focusforge_migration_dismissed');
    });

    // 2. Register a new user account
    await page.goto('/register');
    await page.fill('#register-name', user.name);
    await page.fill('#register-email', user.email);
    await page.fill('#register-password', user.password);
    await page.click('button[type="submit"]');

    // 3. Data migration modal should be visible with item counts
    await expect(page.locator('text=Import Your Local Data')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('div[role="dialog"]').getByText('Tasks', { exact: true })).toBeVisible();

    // 4. Click Import Records button
    await page.click('button:has-text("Import Records")');

    // Success state should appear
    await expect(page.locator('text=Successfully imported all records!')).toBeVisible({
      timeout: 10000,
    });

    // Clear local copy
    await page.click('button:has-text("Clear Local Data")');

    // 5. Navigate to Tasks page and verify the task was persisted in the account
    await page.goto('/tasks');
    await expect(page.locator('body')).toContainText('Offline Guest Research Notes');
  });
});

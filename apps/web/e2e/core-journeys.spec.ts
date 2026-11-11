import { test, expect } from '@playwright/test';

test.describe('Core Productivity Journeys', () => {
  const timestamp = Date.now();
  const student = {
    name: 'Clara Oswald',
    email: `clara_${timestamp}@focusforge.dev`,
    password: 'Password123!',
  };

  test('complete task, habit check-in, and dashboard reflect changes', async ({ page }) => {
    // 1. Register user
    await page.goto('/register');
    await page.fill('#register-name', student.name);
    await page.fill('#register-email', student.email);
    await page.fill('#register-password', student.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*(\/|dashboard)$/);

    // 2. Create a task on Tasks page
    await page.goto('/tasks');
    await page.locator('main button:has-text("Add Task"), main button:has-text("Create Task")').first().click();
    await page.fill('input[name="title"]', 'Physics Quantum Mechanics Assignment');
    await page.fill('input[name="subject"]', 'Physics');
    await page.click('div[role="dialog"] button[type="submit"]');

    await expect(page.locator('body')).toContainText('Physics Quantum Mechanics Assignment');

    // 3. Mark task as completed
    const completeButton = page.locator('button[aria-label*="as complete"]').first();
    await completeButton.click();

    // 4. Verify Task moves to Completed group and expand accordion
    const completedHeader = page.locator('button:has-text("Completed")');
    await expect(completedHeader).toBeVisible();
    await completedHeader.click();
    await expect(page.locator('button[aria-label*="as incomplete"]').first()).toBeVisible();

    // 5. Navigate to Habits and create a habit
    await page.goto('/habits');
    await page.click('button:has-text("Add Habit")');
    await page.fill('input[name="title"]', 'Daily Deep Focus Session');
    await page.fill('input[name="category"]', 'Study');
    await page.click('div[role="dialog"] button[type="submit"]');

    await expect(page.locator('body')).toContainText('Daily Deep Focus Session');

    // Toggle today's habit check-in
    const habitToggle = page.locator('button[aria-label*="Mark complete for"]').last();
    await habitToggle.click();

    // 6. Navigate to Timer and check Pomodoro controls
    await page.goto('/timer');
    await expect(page.locator('button[aria-label="Start timer"]')).toBeVisible();

    // Switch mode to Short Break
    await page.click('button:has-text("Short Break")');
    await expect(page.locator('body')).toContainText('05:00');

    // Switch back to Focus
    await page.click('button:has-text("Focus")');
    await expect(page.locator('body')).toContainText('25:00');
  });
});

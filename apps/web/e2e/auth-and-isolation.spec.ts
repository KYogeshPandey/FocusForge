import { test, expect } from '@playwright/test';

test.describe('Authentication and Two-User Data Isolation', () => {
  const timestamp = Date.now();
  const userA = {
    name: 'Alice Scholar',
    email: `alice_${timestamp}@focusforge.dev`,
    password: 'Password123!',
  };
  const userB = {
    name: 'Bob Learner',
    email: `bob_${timestamp}@focusforge.dev`,
    password: 'Password123!',
  };

  test('User A creates private data, User B sees none of it, User A retains data after re-login', async ({
    page,
  }) => {
    // 1. Register User A
    await page.goto('/register');
    await page.fill('#register-name', userA.name);
    await page.fill('#register-email', userA.email);
    await page.fill('#register-password', userA.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*(\/|dashboard)$/);
    await expect(page.locator('h1')).toContainText(userA.name);

    // 2. User A creates a unique task
    await page.goto('/tasks');
    await page.locator('main button:has-text("Add Task"), main button:has-text("Create Task")').first().click();
    await page.fill('input[name="title"]', 'User A Secret Thesis Research');
    await page.fill('input[name="subject"]', 'History');
    await page.click('div[role="dialog"] button[type="submit"]');

    await expect(page.locator('body')).toContainText('User A Secret Thesis Research');

    // 3. User A signs out
    const userMenuButton = page.locator('button[aria-label="User account menu"]');
    await userMenuButton.click();
    await page.click('button:has-text("Sign Out")');

    await expect(page).toHaveURL(/.*login/);

    // 4. Register User B
    await page.goto('/register');
    await page.fill('#register-name', userB.name);
    await page.fill('#register-email', userB.email);
    await page.fill('#register-password', userB.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*(\/|dashboard)$/);

    // 5. User B goes to tasks -> must NOT see User A's task
    await page.goto('/tasks');
    await expect(page.locator('body')).not.toContainText('User A Secret Thesis Research');

    // User B creates their own task
    await page.locator('main button:has-text("Add Task"), main button:has-text("Create Task")').first().click();
    await page.fill('input[name="title"]', 'User B Chemistry Lab Analysis');
    await page.fill('input[name="subject"]', 'Chemistry');
    await page.click('div[role="dialog"] button[type="submit"]');

    await expect(page.locator('body')).toContainText('User B Chemistry Lab Analysis');

    // 6. User B signs out
    await page.locator('button[aria-label="User account menu"]').click();
    await page.click('button:has-text("Sign Out")');

    // 7. User A logs back in
    await page.goto('/login');
    await page.fill('#login-email', userA.email);
    await page.fill('#login-password', userA.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*(\/|dashboard)$/);

    // User A should still see their task and NOT User B's task
    await page.goto('/tasks');
    await expect(page.locator('body')).toContainText('User A Secret Thesis Research');
    await expect(page.locator('body')).not.toContainText('User B Chemistry Lab Analysis');
  });
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pagesToAudit = [
  { path: '/login', name: 'Login Page' },
  { path: '/register', name: 'Register Page' },
  { path: '/', name: 'Dashboard' },
  { path: '/tasks', name: 'Tasks Page' },
  { path: '/timer', name: 'Timer Page' },
  { path: '/habits', name: 'Habits Page' },
  { path: '/planner', name: 'Planner Page' },
  { path: '/analytics', name: 'Analytics Page' },
  { path: '/settings', name: 'Settings Page' },
];

test.describe('Automated Axe Accessibility Audit', () => {
  for (const p of pagesToAudit) {
    test(`Zero serious or critical accessibility violations on ${p.name} (Dark Theme)`, async ({
      page,
    }) => {
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');

      // Set dark theme
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
        document.documentElement.classList.remove('light');
      });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const severeViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(severeViolations).toEqual([]);
    });

    test(`Zero serious or critical accessibility violations on ${p.name} (Light Theme)`, async ({
      page,
    }) => {
      await page.goto(p.path);
      await page.waitForLoadState('domcontentloaded');

      // Set light theme
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
        document.documentElement.classList.add('light');
      });

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();

      const severeViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      );

      expect(severeViolations).toEqual([]);
    });
  }
});

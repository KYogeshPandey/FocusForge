# FocusForge Quality Assurance & Testing Guide

FocusForge enforces a multi-tier testing strategy ensuring data ownership, zero regressions, WCAG AA accessibility, and seamless full-stack integration.

---

## 1. Test Suite Overview

| Tier | Tooling | Scope | Test Count |
| :--- | :--- | :--- | :--- |
| **Web Unit & Component** | Vitest + React Testing Library + JSDOM | UI forms, route guards, streak math, outbox queue, local adapter, service factory | 60 tests (15 suites) |
| **API Integration** | Vitest + Supertest + mongodb-memory-server | Authentication, token rotation, tenant isolation, CRUD, pagination, rate limits | 26 tests (5 suites) |
| **End-to-End (E2E)** | Playwright (Desktop & Mobile Chromium) | User registration, two-user isolation, task/habit flows, theme persistence, axe audit | 25 tests (5 suites) |
| **Automated Accessibility** | `@axe-core/playwright` | Zero critical/serious WCAG AA violations across all 7 pages in Light and Dark themes | 18 automated audits |

---

## 2. Running Tests Locally

### Run All Unit & Integration Tests (Root)
```bash
npm test
```

### Run Web Unit & Component Tests
```bash
# Run once
npm --prefix apps/web test

# Run with test coverage report
npm --prefix apps/web test -- --coverage
```

### Run Backend API Integration Tests
The API tests automatically spin up an isolated, in-memory MongoDB server instance.
```bash
# Run once
npm --prefix apps/api test

# Run with coverage report
npm --prefix apps/api test -- --coverage
```

### Run Playwright E2E Tests
The Playwright test runner automatically launches both the test API server and Vite dev server on dedicated test ports.
```bash
# Run headless
npm --prefix apps/web run test:e2e

# Run with visual UI mode
npx playwright test --ui --config=apps/web/playwright.config.ts

# Inspect HTML report
npx playwright show-report apps/web/playwright-report
```

---

## 3. Linting & Typechecking

Run static checks across the entire monorepo:
```bash
# Typecheck all workspaces
npm run typecheck

# Lint all workspaces
npm run lint
```

---

## 4. Key Testing Patterns & Test Isolation

### Two-User Isolation Tests
Every API and E2E test runs with randomly generated student accounts (e.g., `user_a_${Date.now()}@focusforge.dev`). Tests verify that:
1. User A creates private tasks, sessions, and habits.
2. User B queries those resources and receives 404 Not Found.
3. User B cannot mutate User A's data even if providing User A's resource IDs.

### Dual Service Layer Parity Tests
To prevent divergence between the client-side guest utilities and the backend MongoDB analytics engine, `tests/analyticsParity.test.ts` executes both implementations against identical mock fixtures and verifies identical output metrics (total minutes, streaks, daily distributions).

### Automated WCAG AA Audits
`e2e/accessibility.spec.ts` visits every application route:
- Checks color contrast ratios in both Dark and Light themes.
- Verifies ARIA roles, form labels (`aria-describedby`), and skip links.
- Confirms zero violations with severity `critical` or `serious`.

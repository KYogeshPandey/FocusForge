# FocusForge — Portfolio & Resume Highlights

These resume bullets accurately describe features that are fully implemented, verified, and backed by automated tests in this repository.

---

## Resume Bullets (Full-Stack / Frontend / Backend)

### Full-Stack Software Engineer
- **Engineered an offline-first productivity platform** with React 18, TypeScript, and Express/MongoDB, supporting both instant guest evaluation via LocalStorage and cloud persistence via authenticated REST APIs.
- **Designed a swappable Service Factory architecture** with TanStack Query and Zustand, ensuring zero client-side code changes when toggling between offline LocalStorage and authenticated REST backends.
- **Implemented a resilient background synchronization outbox** that buffers completed study and focus sessions in LocalStorage during network drops and automatically executes idempotent batch retries upon reconnection.
- **Architected a zero-downtime local-to-cloud data migration wizard** allowing guest students to cleanly import local tasks, habits, and study schedules into newly registered cloud accounts with duplicate prevention.

### Backend & API Security
- **Built an Express/TypeScript REST API** enforcing strict per-user tenant isolation across 8 MongoDB collections, ensuring cross-user access attempts return HTTP 404 to eliminate user enumeration vulnerabilities.
- **Implemented dual-token authentication** utilizing short-lived (15-min) in-memory access JWTs and rotating 7-day `httpOnly`, `SameSite=None`, `secure` refresh cookies with automatic token reuse compromise detection.
- **Constructed an aggregated study analytics engine** via MongoDB Aggregation Pipelines that computes weekly focus distribution, daily habit streaks, and goal achievement percentages across arbitrary timezone boundaries.
- **Hardened API infrastructure** with Zod schema validation, multi-tier rate limiting (general & auth-specific), Helmet HTTP headers, NoSQL query sanitization, and structured Pino logging.

### Frontend, Performance & Quality Assurance
- **Authored a comprehensive test pyramid of 111+ tests** spanning Vitest unit/component tests, Supertest API integration suites with in-memory MongoDB, and Playwright end-to-end tests across desktop and mobile viewports.
- **Enforced WCAG AA accessibility standards** by integrating `@axe-core/playwright` automated audits into CI, achieving zero serious or critical accessibility violations across 7 pages in both Dark and Light themes.
- **Optimized production bundle delivery** via Vite route-based code-splitting and dynamic imports for heavyweight visualization libraries (Recharts), maintaining core page chunks under 12 kB gzip.
- **Orchestrated multi-stage Docker containerization** with non-root security principles and continuous integration pipelines via GitHub Actions (linting, typechecking, coverage reporting, and E2E browser tests).

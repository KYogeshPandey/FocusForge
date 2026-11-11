# FocusForge — Tech Stack

Your required stack is **React · Node.js · Mongoose (MongoDB) · Tailwind CSS**. This document keeps those as the core and adds upgrades that make the project more robust, secure, and portfolio-worthy. Each upgrade is marked:

- ✅ **Core** — your stated requirement
- ⭐ **Recommended** — adopt from the start
- 🔧 **Optional** — add when needed

---

## 1. Stack at a Glance

| Layer | Choice | Tag |
|---|---|---|
| UI library | React 18+ | ✅ |
| Build tool | Vite | ⭐ |
| Language | **TypeScript** (frontend + backend) | ⭐ |
| Styling | Tailwind CSS (v4, or v3 if Antigravity templates need it) | ✅ |
| Routing | React Router | ⭐ |
| Server state | TanStack Query | ⭐ |
| Client/UI state | Zustand (timer, theme, UI) | ⭐ |
| Forms | React Hook Form + Zod | ⭐ |
| Charts | Recharts | ⭐ |
| Icons | Lucide React | ⭐ |
| Dates | date-fns (or Day.js) | ⭐ |
| Backend runtime | Node.js (LTS) | ✅ |
| API framework | Express | ✅ |
| Database | MongoDB Atlas | ✅ |
| ODM | Mongoose | ✅ |
| Validation | Zod (shared with frontend) | ⭐ |
| Auth | JWT access token + httpOnly refresh cookie, bcrypt/argon2 | ⭐ |
| Security middleware | helmet, cors, express-rate-limit, express-mongo-sanitize | ⭐ |
| Logging | pino + pino-http | ⭐ |
| Testing | Vitest, React Testing Library, Supertest, Playwright | ⭐ |
| Code quality | ESLint, Prettier, Husky + lint-staged | ⭐ |
| CI/CD | GitHub Actions | ⭐ |
| Hosting | Vercel (frontend) + Render/Railway (API) + Atlas | ⭐ |
| Containers | Docker / docker-compose for local dev | 🔧 |

---

## 2. Frontend

### 2.1 Core
- **React + Vite** — fast dev server, simple build, great fit for an SPA dashboard.
- **Tailwind CSS** — utility-first styling. Define design tokens (colors, radius, fonts) in the Tailwind theme and CSS variables so dark/light themes are a one-line switch (see `design.md`).

### 2.2 Better approaches

**TypeScript instead of plain JavaScript** ⭐
Catches bugs at compile time, gives AI tools like Antigravity better context, and lets frontend and backend share types. If you'd rather start in JS, use JSDoc + `// @ts-check` and migrate later — but starting in TS is cheaper than converting.

**TanStack Query for server data** ⭐
Replaces hand-written `useEffect` + `fetch` + loading/error state. Gives caching, refetching, optimistic updates, and retries. During the localStorage phase, wrap a *storage adapter* behind the same hooks (`useTasks()`), so switching to the API changes only the service layer, not the pages.

**Zustand for client state** ⭐
Small, simple, no boilerplate. Use it for the timer, theme, and UI state (sidebar open, modals). Avoid putting server data in it — that's TanStack Query's job.

**React Hook Form + Zod** ⭐
Performant forms with schema validation. The *same Zod schema* can validate on the frontend and backend.

**Timestamp-based timer** ⭐
Don't decrement a counter every second. Store `endsAt` (timestamp) and compute `remaining = endsAt - Date.now()` on each tick. Persist `{ mode, endsAt, status }` to storage so refresh and background tabs stay accurate. Optionally run ticks in a Web Worker and update `document.title` with the countdown.

**Route-level code splitting** ⭐
`React.lazy` + `Suspense` per page, so Recharts and heavy pages load only when needed.

**Accessible primitives** 🔧
Radix UI or shadcn/ui (built on Radix + Tailwind) for dialogs, dropdowns, tabs, tooltips, and toasts with correct keyboard/ARIA behavior. Fits the Tailwind requirement well.

**Drag & drop** 🔧 — `@dnd-kit` for rescheduling study blocks.
**PWA** 🔧 — `vite-plugin-pwa` for installable/offline-capable app later.

---

## 3. Backend

### 3.1 Core
- **Node.js + Express** — REST API.
- **MongoDB Atlas + Mongoose** — schemas, validation, indexes, and queries.

### 3.2 Better approaches

**TypeScript + layered structure** ⭐
```
routes → controllers → services → models
```
Controllers handle HTTP only; services hold business logic (streak calculation, analytics aggregation); models define schema. This keeps logic testable.

**Zod request validation middleware** ⭐
Validate `body`, `params`, and `query` on every route. Never trust the client. Reject unknown fields.

**Authentication design** ⭐
- Password hashing: **argon2** (preferred) or bcrypt (cost ≥ 12).
- **Short-lived access JWT** (≈15 min) kept in memory on the client.
- **Refresh token in an httpOnly, Secure, SameSite cookie** (rotated; store a hash server-side to allow revocation).
- Avoid storing JWTs in `localStorage` — it's exposed to XSS.
- Derive `userId` only from the verified token.

**Security middleware** ⭐
`helmet` (headers), `cors` (explicit origin allow-list), `express-rate-limit` (stricter on `/auth`), `express-mongo-sanitize` (NoSQL-injection guard), request body size limits.

**Centralized error handling** ⭐
One error middleware, a custom `AppError` class, consistent response shape:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```
and for success: `{ "success": true, "data": ... }`.

**Config & env validation** ⭐
Parse `process.env` with Zod at startup and fail fast if something is missing. Commit only `.env.example`.

**Logging** ⭐ — `pino` structured logs; never log passwords, tokens, or full request bodies.

**API versioning & docs** ⭐ — prefix routes with `/api/v1`. Generate OpenAPI/Swagger docs (`zod-to-openapi` or `swagger-ui-express`) — great for a portfolio.

**Health & graceful shutdown** ⭐ — `GET /health`, close DB connection on SIGTERM.

**Background jobs / email** 🔧 — `node-cron` or BullMQ (needs Redis) for reminders and weekly reports; Resend/Nodemailer for email.

---

## 4. Database Design (Mongoose)

### 4.1 Collections
`users`, `tasks`, `studysessions`, `focussessions`, `habits`, `habitcompletions`, `goals`

> Note: the original plan has `StudySession` for both planned and recorded sessions. Splitting into **StudySession** (planned blocks) and **FocusSession** (actual timer records) keeps analytics clean. Merge them if you want to keep v1 smaller.

### 4.2 Practices
- Every private document has `userId` (ObjectId, indexed).
- `timestamps: true` on all schemas.
- Compound indexes, e.g.:
  - `tasks`: `{ userId: 1, status: 1, dueAt: 1 }`
  - `habitcompletions`: **unique** `{ userId: 1, habitId: 1, date: 1 }` (prevents duplicates)
  - `focussessions`: `{ userId: 1, startedAt: -1 }`
  - `users`: unique `email` (store lowercased)
- Store habit `date` as `"YYYY-MM-DD"` (user's timezone); store other times in UTC.
- Never return `passwordHash`; use `select: false` on the field.
- Use `.lean()` on read-heavy queries and Mongo **aggregation pipelines** for analytics (`$group` by day/week).
- Prefer **soft-archive** for habits (`active: false`) to keep history.
- Cascade cleanup: deleting an account removes all of that user's documents.

---

## 5. Shared Code Between Frontend & Backend ⭐

Use an **npm workspaces monorepo** so Zod schemas and TypeScript types are written once.

```
focusforge/
├── apps/
│   ├── web/            # React + Vite + Tailwind
│   └── api/            # Express + Mongoose
├── packages/
│   └── shared/         # Zod schemas, types, constants
├── .github/workflows/
├── docker-compose.yml  # optional
├── package.json        # workspaces
└── README.md
```

Benefit: no frontend/backend drift — the exact risk called out in your project plan. If a monorepo feels heavy at first, keep `frontend/` and `backend/` as in your original plan and add `shared/` later.

---

## 6. Testing Strategy

| Level | Tool | What to test |
|---|---|---|
| Unit | Vitest | Streak calc, analytics utils, timer logic, date helpers |
| Component | React Testing Library | Task form, filters, habit toggle |
| API integration | Supertest + `mongodb-memory-server` | Auth, CRUD, **ownership checks** |
| End-to-end | Playwright | Register → add task → run timer → see analytics |
| Accessibility | `eslint-plugin-jsx-a11y`, axe | Keyboard + ARIA checks |

**Must-have security tests:** user A cannot read/edit/delete user B's records; password hash never appears in responses; expired token is rejected.

---

## 7. Tooling & Workflow

- **ESLint + Prettier** — consistent code; **Husky + lint-staged** run them on commit.
- **Conventional Commits** (`feat:`, `fix:`) for a clean Git history.
- **GitHub Actions** — on every PR: install, lint, type-check, test, build.
- **Dependabot / `npm audit`** — dependency security updates.
- **Secret scanning** — GitHub secret scanning (or gitleaks) to prevent leaked credentials.

---

## 8. Deployment

| Piece | Recommended host | Notes |
|---|---|---|
| Frontend | Vercel or Netlify | Set `VITE_API_URL` |
| API | Render or Railway (Fly.io alternative) | Set env vars; enable health check |
| Database | MongoDB Atlas (free M0 to start) | IP allow-list / network access configured |

Production checklist: HTTPS only, CORS restricted to the deployed frontend origin, `NODE_ENV=production`, secure cookies (`Secure`, `SameSite`), strong random JWT secrets, Atlas user with least privilege.

> Cross-site cookies (frontend and API on different domains) need `SameSite=None; Secure` and CORS `credentials: true`. A custom domain with `app.` and `api.` subdomains makes this simpler.

---

## 9. Recommended Dependencies

**Frontend (`apps/web`)**
```
react react-dom react-router-dom
@tanstack/react-query zustand
react-hook-form zod @hookform/resolvers
recharts lucide-react date-fns clsx tailwind-merge
tailwindcss (+ @tailwindcss/vite for v4)
```
Dev: `typescript vite @vitejs/plugin-react vitest @testing-library/react eslint prettier playwright`

**Backend (`apps/api`)**
```
express mongoose zod dotenv
argon2 (or bcrypt) jsonwebtoken cookie-parser
helmet cors express-rate-limit express-mongo-sanitize
pino pino-http
```
Dev: `typescript tsx vitest supertest mongodb-memory-server eslint prettier @types/*`

---

## 10. Suggested Environment Variables

**`apps/api/.env.example`**
```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>/focusforge
CLIENT_ORIGIN=http://localhost:5173
JWT_ACCESS_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=7d
```

**`apps/web/.env.example`**
```
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 11. Decision Summary

| Decision | Why |
|---|---|
| TypeScript | Fewer runtime bugs, shared types, better AI-assisted coding |
| TanStack Query + adapter | Smooth switch from localStorage to API in Phase 5 |
| Zustand | Lightweight timer/theme/UI state |
| Zod everywhere | One validation source for client and server |
| httpOnly refresh cookie | Safer than JWT in localStorage |
| Timestamp timer | Accurate in background tabs and after refresh |
| Mongo aggregation for analytics | Efficient server-side summaries |
| Monorepo with `shared` package | Prevents frontend/backend contract drift |
| Playwright + Supertest | Proves critical journeys and data isolation |

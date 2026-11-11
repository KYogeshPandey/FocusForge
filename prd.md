# FocusForge — Product Requirements Document (PRD)

> Study Planner & Productivity Tracker
> Status: Draft v1 · Owner: Project author · Build tool: Antigravity

---

## 1. Overview

**FocusForge** is a student-focused productivity web app that combines tasks, study planning, focus sessions (Pomodoro), habit tracking, weekly goals, and analytics in one workspace.

**One-line pitch:** FocusForge helps students turn study intentions into consistent action through planning, focused work sessions, habit tracking, and measurable progress.

## 2. Problem Statement

Students juggle deadlines, revision, coding practice, and personal habits across notebooks, calendars, timers, and separate apps. As a result:

- Tasks and deadlines are scattered.
- Study sessions begin without a plan or measurable target.
- Distractions and inconsistent routines hurt focus.
- Habits are forgotten and progress is invisible.
- Students can't tell whether their routine is improving week over week.

## 3. Target Users

| Persona | Needs |
|---|---|
| College student | Track lectures, assignments, exams, projects |
| Exam / interview aspirant | Structured daily revision and practice blocks |
| Self-learner | Follow courses and roadmaps consistently |
| Developer | Log learning sessions and daily practice habits |

## 4. Goals & Non-Goals

### Goals
1. One place to plan, focus, build habits, and review progress.
2. Break big goals into tasks and study sessions.
3. Make consistency (streaks, completion rates) visible.
4. Show trustworthy analytics derived from real stored data.
5. Demonstrate production-grade full-stack skills (REST API, auth, DB design, deployment).

### Non-Goals (v1)
- Calendar sync (Google/Outlook), push notifications
- Social features (study groups, leaderboards)
- AI-generated study plans
- Native mobile apps
- Team/organization accounts

## 5. Success Metrics

**Portfolio / delivery metrics**
- All core pages navigable and responsive (≥ 360px width).
- Task, habit, timer, and goal workflows run without known blocking bugs.
- Dashboard numbers always match stored records.
- Data isolation verified between two test accounts.
- Project installs and runs from README steps in < 10 minutes.

**Product metrics (if deployed)**
- Day-7 return rate, tasks completed per active user per week, focus minutes per active user per week, habit completion rate.

## 6. User Journey

1. Open FocusForge → see today's summary.
2. Add tasks with priority, subject, and due date.
3. Schedule a study session or start a focus timer.
4. Complete the session; mark related tasks/habits done.
5. Dashboard and analytics recalculate.
6. End of week: review goal progress, adjust next week's plan.

## 7. Functional Requirements

Priority: **P0** = MVP must-have · **P1** = should-have · **P2** = nice-to-have

### 7.1 Dashboard (P0)
- Greeting, today's date, summary cards (tasks due today, focus minutes today, current streak, weekly goal %).
- Today's tasks list with quick-complete.
- Weekly study-time chart.
- Weekly goals progress.
- Helpful empty states.
- **Acceptance:** Every number is computed from stored data and updates immediately after any action.

### 7.2 Task Manager (P0)
- Create, view, edit, complete/uncomplete, delete.
- Fields: title (required), subject, priority (low/medium/high), status (todo/in-progress/done), due date.
- Filter by status, priority, subject, due date; search by title; sort by due date/priority.
- **Acceptance:** Tasks persist across refresh; invalid/empty input shows clear feedback.
- P1: undo delete, bulk actions. P2: subtasks, recurring tasks.

### 7.3 Study Planner (P0)
- Create planned sessions: title, subject, date, start time, duration.
- View by day (list) and by week (calendar grid).
- Mark session as completed / skipped; optionally link to a task.
- **Acceptance:** Sessions can be created, edited, deleted, and reviewed by date.
- P2: drag-and-drop rescheduling.

### 7.4 Focus Timer (P0)
- Modes: Focus (25 min), Short break (5), Long break (15); durations configurable in Settings.
- Controls: start, pause, resume, reset, skip.
- Long break after N focus rounds (default 4).
- Optionally attach the session to a task/subject.
- On completion: record a focus session (subject, duration, timestamps) automatically.
- Sound/notification on finish (user-toggleable).
- **Reliability:** Timer is timestamp-based (see `techstack.md`), so it stays accurate in background tabs and survives refresh.

### 7.5 Habit Tracker (P0)
- Create/edit/archive habits.
- Daily check-in for any date (today default; allow recent past).
- Streak (current + best) and weekly completion view.
- **Acceptance:** Completion is stored per habit per date; history is never overwritten.

### 7.6 Goals (P0)
- Weekly study target in minutes (or sessions).
- Progress derived from recorded focus sessions.
- P1: custom period goals, per-subject goals.

### 7.7 Analytics (P0)
- Daily/weekly study-time bar chart.
- Task completion rate and tasks by priority/subject.
- Habit consistency heatmap or weekly bars.
- Date-range selector (7 / 30 / 90 days).
- **Acceptance:** Charts use real stored data only; demo data is labeled.

### 7.8 Settings (P0)
- Theme (dark / light / system).
- Timer durations, long-break interval, sound toggle.
- Week start day (Mon/Sun) and timezone.
- Account: profile, change password, sign out, delete account/data (after auth).

### 7.9 Authentication (P0 — Phase 4)
- Register, login, logout, session refresh.
- Each user can access only their own records.
- P1: forgot/reset password, email verification.

## 8. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Usability | Clear navigation, readable labels, empty/loading/error states |
| Responsiveness | Desktop, tablet, mobile; sidebar → bottom/drawer nav on small screens |
| Performance | Route-level code splitting; Lighthouse performance ≥ 90 on key pages; API p95 < 300 ms for list endpoints |
| Accessibility | WCAG 2.1 AA target: semantic HTML, keyboard navigation, visible focus, contrast, `prefers-reduced-motion` |
| Security | Server-side validation, bcrypt/argon2 hashing, protected routes, ownership checks, secrets in env vars, rate limiting, CORS locked to frontend origin |
| Reliability | Graceful handling of network errors, invalid input, timer state changes |
| Maintainability | Separated components, pages, hooks, services, controllers, models; linted and formatted |
| Privacy | Collect only necessary data; allow account + data deletion |

## 9. Scope & Phased Delivery

| Phase | Deliverable | Definition of done |
|---|---|---|
| 1. Frontend foundation | Vite app, routing, layout, theme, reusable components | All pages render; navigation works |
| 2. Core interactions | Tasks, habits, timer, planner, demo analytics using browser storage | Refresh preserves data; primary controls work |
| 3. Backend & database | Express, MongoDB/Mongoose models, validated API routes | Endpoints work; data persists in DB |
| 4. Authentication | Register/login, hashing, protected APIs, ownership | Users cannot access each other's data |
| 5. Integration | Replace local storage with API; loading/error states | Core features work via backend |
| 6. Testing & polish | Responsive, a11y, edge cases, automated tests | Critical journeys pass |
| 7. Deployment | Deploy frontend + API, env config, README, screenshots | Public demo works; setup is reproducible |

## 10. Key Business Rules

1. **Single source of truth:** all metrics derive from stored tasks, sessions, habits, and completions — never hard-coded values (demo data must be labeled).
2. **Date handling:** habit completions use a calendar date string (`YYYY-MM-DD`) in the user's timezone; timestamps elsewhere are stored in UTC.
3. **Streaks:** a streak counts consecutive days with a completion; today does not break a streak until the day ends.
4. **Focus time counting:** only completed focus intervals (or manually logged sessions) count toward goals; breaks do not.
5. **Ownership:** the server derives the user from the verified token, never from a `userId` sent by the client.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scope creep | Ship MVP phases first; features beyond P0 only after core is stable |
| Inaccurate timer in background tabs | End-timestamp calculation instead of decrementing counters |
| Misleading dashboard numbers | Derive from stored data; unit-test calculation utils |
| Frontend/backend drift | Shared API contract (Zod schemas / OpenAPI) before integration |
| Data leakage between users | Auth middleware + ownership filter on every query; automated tests |
| Secrets committed | `.env.example`, `.gitignore`, secret scanning in CI |
| Poor mobile UX | Test key flows at 360px throughout development |

## 12. Future Enhancements (post-MVP)

Calendar integration & reminders · recurring tasks/schedules · exportable weekly reports · study groups/accountability partners · AI study-plan suggestions · import/export & backup · badges and careful gamification · PWA/offline support.

## 13. Open Questions

- Should goals be minutes-based only, or also session/task-count based?
- Email verification and password reset in v1 or v1.1?
- Is multi-device sync of an *in-progress* timer required, or only completed sessions?
- Data export format (JSON, CSV, or both)?

## 14. Implementation Status (Production Release)

| Milestone Phase | Status | Verification & Deliverables |
| :--- | :--- | :--- |
| **Phase 1: Frontend Foundation** | Completed | React 18 + Vite SPA, Tailwind CSS, 7 core pages, Dark/Light theme toggle. |
| **Phase 2: Core Client Interactions** | Completed | Offline-first localStorage persistence layer, timestamp-based timer, streak calculation, unit tests. |
| **Phase 3: Backend & Database** | Completed | Express + TypeScript + Mongoose REST API under `/api/v1`, 8 collections, Zod validation, compound indexes. |
| **Phase 4: Authentication & Security** | Completed | Dual-token auth (in-memory access JWT + rotating httpOnly refresh cookie), reuse detection, per-user 404 isolation. |
| **Phase 5: Full-Stack Integration** | Completed | Swappable Service Factory (guest localStorage vs authenticated REST), offline focus outbox, one-time local data migration wizard. |
| **Phase 6: Testing & Polish** | Completed | 111 total tests: 60 web unit/component, 26 API integration, 25 Playwright E2E with automated Axe WCAG AA audit. |
| **Phase 7: Deployment Readiness** | Completed | Multi-stage production Dockerfiles, `docker-compose.yml`, Vercel `vercel.json`, Render `render.yaml`, comprehensive runbooks. |

### Canonical Field Specifications
- **Tasks Due Date:** `dueDate` (`string | null | optional`) — canonical across web, API, and shared schemas.
- **Study Sessions Planning:** `date` (`YYYY-MM-DD`) and `startTime` (`HH:MM`) — canonical across web, API, and shared schemas.
- **Focus Sessions Deduplication:** `clientSessionId` (`string | optional`) — client-generated UUID for idempotent offline retries.


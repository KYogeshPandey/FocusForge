# FocusForge — Design System

Direction: **premium, calm, focused SaaS dashboard.** Dark charcoal base, electric-purple used sparingly for key actions and active states, subtle blue for supporting data. Optional light theme.

---

## 1. Design Principles

1. **Focus first** — minimal clutter; one primary action per view.
2. **Hierarchy through contrast, not decoration** — spacing, size, and weight do the work; borders and shadows stay subtle.
3. **Accent with restraint** — purple marks what is active or primary. If everything is purple, nothing is.
4. **Data is honest** — charts and numbers reflect real data; demo data is labeled.
5. **Accessible by default** — contrast, keyboard focus, reduced motion.
6. **Consistent patterns** — the same component looks and behaves the same everywhere.

---

## 2. Color Tokens

Define as CSS variables and map them in the Tailwind theme so theme switching is automatic.

### 2.1 Dark theme (default)

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0F1013` | App background |
| `--surface` | `#16181D` | Cards, sidebar |
| `--surface-2` | `#1D2027` | Inputs, hover, nested cards |
| `--border` | `#2A2E37` | Dividers, card borders |
| `--text` | `#F2F3F5` | Primary text |
| `--text-muted` | `#9AA0AC` | Secondary text |
| `--text-subtle` | `#6B7280` | Placeholders, captions |
| `--primary` | `#8B5CF6` | Primary buttons, active nav, focus ring |
| `--primary-hover` | `#7C3AED` | Primary hover |
| `--primary-soft` | `rgba(139,92,246,0.15)` | Active nav background, badges |
| `--secondary` | `#3B82F6` | Supporting highlights, chart series 2 |
| `--success` | `#22C55E` | Completed, streak, positive |
| `--warning` | `#F59E0B` | Due soon, medium priority |
| `--danger` | `#EF4444` | Errors, delete, high priority overdue |

### 2.2 Light theme

| Token | Value |
|---|---|
| `--bg` | `#F7F7FA` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F0F1F5` |
| `--border` | `#E3E5EB` |
| `--text` | `#14151A` |
| `--text-muted` | `#5B6272` |
| `--text-subtle` | `#8A91A1` |
| `--primary` | `#7C3AED` |
| `--primary-hover` | `#6D28D9` |
| `--primary-soft` | `rgba(124,58,237,0.10)` |
| `--secondary` | `#2563EB` |

### 2.3 Priority & status colors
- Priority: **High** → danger · **Medium** → warning · **Low** → secondary (blue)
- Status: **Todo** → text-muted · **In progress** → secondary · **Done** → success
- Timer modes: **Focus** → primary · **Short break** → success · **Long break** → secondary

### 2.4 Chart palette
`#8B5CF6` (primary), `#3B82F6`, `#22C55E`, `#F59E0B`, `#EC4899`, `#14B8A6`.
Never rely on color alone — add labels, patterns, or tooltips.

> **Contrast rule:** body text ≥ 4.5:1, large text and UI components ≥ 3:1. Verify muted text on `--surface` in both themes.

---

## 3. Typography

| Role | Font | Notes |
|---|---|---|
| UI / body | **Inter** (system-ui fallback) | Clean, readable |
| Headings | **Inter** semibold, or **Plus Jakarta Sans** | Slightly tighter tracking |
| Numbers / timer | Inter with `tabular-nums` (or JetBrains Mono) | Prevents digits shifting as they change |

| Style | Size / line-height | Weight |
|---|---|---|
| Display (timer) | 72–96px / 1 | 600 |
| H1 (page title) | 30px / 36px | 600 |
| H2 (section) | 22px / 28px | 600 |
| H3 (card title) | 16px / 24px | 600 |
| Body | 14–16px / 24px | 400 |
| Small / caption | 12–13px / 18px | 500 |

Body text never below 14px. Use `rem` units so user font-size settings are respected.

---

## 4. Spacing, Radius, Elevation

- **Spacing scale:** 4px base → 4, 8, 12, 16, 24, 32, 48, 64.
- **Page padding:** 16px (mobile), 24px (tablet), 32px (desktop). **Max content width:** 1280px.
- **Card padding:** 16–24px. **Grid gap:** 16–24px.
- **Radius:** inputs/buttons `10px` · cards `16px` · modals `20px` · pills `9999px`.
- **Elevation:** prefer 1px borders over heavy shadows. In dark mode, signal elevation with a lighter surface (`--surface` → `--surface-2`). Modals: `0 20px 50px rgba(0,0,0,0.45)`.

---

## 5. Layout

### 5.1 App shell
- **Desktop (≥1024px):** persistent left sidebar (240px, collapsible to 72px icon rail) + top bar + content.
- **Tablet (768–1023px):** collapsed icon rail; expand on hover/press.
- **Mobile (<768px):** top bar with menu drawer **or** bottom tab bar (Dashboard, Tasks, Timer, Habits, More).

### 5.2 Breakpoints (Tailwind defaults)
`sm 640` · `md 768` · `lg 1024` · `xl 1280`

### 5.3 Grids
- Dashboard summary cards: 1 col (mobile) → 2 cols (`sm`) → 4 cols (`lg`).
- Main content: 12-column grid; charts span 8, side widgets span 4 on desktop; stack on mobile.

### 5.4 Sidebar navigation
Dashboard · Tasks · Study Planner · Focus Timer · Habit Tracker · Analytics · Settings (Settings pinned at the bottom with profile/avatar).
Active item: `--primary-soft` background, `--primary` icon and text, 3px left indicator.

---

## 6. Components

Build as reusable components in `components/ui/` (use Radix/shadcn primitives where helpful).

### 6.1 Button
| Variant | Style |
|---|---|
| Primary | `--primary` bg, white text, hover `--primary-hover` |
| Secondary | `--surface-2` bg, `--text`, 1px border |
| Ghost | transparent, hover `--surface-2` |
| Danger | `--danger` bg or outline |

Sizes: sm 32px · md 40px · lg 48px. Include loading (spinner, disabled) and icon-only (with `aria-label`) states.

### 6.2 Card
Surface background, 1px border, 16px radius. Optional header (title + action), body, footer. Hover lift only on interactive cards.

### 6.3 Stat card
Icon in a soft-tinted square, label (muted), large value, optional trend chip (▲ +12% vs last week).

### 6.4 Inputs
Text, textarea, select, date, time, number, checkbox, toggle, segmented control. Height 40px, `--surface-2` background, 1px border, **2px primary focus ring** with offset. Inline error text in `--danger` with an icon; labels always visible (no placeholder-only labels).

### 6.5 Task item
Checkbox · title · subject chip · priority badge · due-date label (turns danger when overdue) · overflow menu (edit, delete). Completed: title struck through, muted.

### 6.6 Badges / chips
Pill shape, soft tinted background + matching text color (e.g., `--primary-soft` + `--primary`).

### 6.7 Modal / drawer
Used for add/edit forms. Focus trapped, closes on `Esc`, returns focus to trigger. Bottom sheet on mobile.

### 6.8 Toast
Bottom-right (top on mobile). Success, error, info; auto-dismiss 4s; `role="status"`; Undo action for deletes.

### 6.9 Tabs, filters, dropdown, tooltip, progress bar, skeleton loader, empty state.

### 6.10 Empty state
Icon, short headline, one line of help text, primary CTA — e.g., *"No tasks yet. Add your first task to start planning your day."*

---

## 7. Page Specifications

### 7.1 Dashboard
- Header: greeting ("Good evening, Alex") + date + **Quick add** button.
- Row 1: 4 stat cards — Tasks due today · Focus time today · Current streak · Weekly goal %.
- Row 2: weekly study-time bar chart (large) + today's tasks (side).
- Row 3: weekly goal progress + today's habits checklist + upcoming sessions.
- Demo data banner: *"Showing demonstration data"* (dismissible, only in demo mode).

### 7.2 Tasks
- Toolbar: search · status filter · priority filter · subject filter · sort · **Add task**.
- List grouped by Today / Upcoming / No date / Completed (collapsible).
- Add/Edit in modal (mobile: bottom sheet).

### 7.3 Study Planner
- Date strip or week calendar; day agenda list beneath.
- Session card: time range, title, subject color bar, duration, status.
- "Start focus" shortcut on a session launches the timer pre-filled.

### 7.4 Focus Timer
- Centered large circular progress ring with remaining time (tabular numerals).
- Mode segmented control: Focus · Short Break · Long Break.
- Controls: Start/Pause (primary, large), Reset, Skip.
- Task/subject selector, "Round 2 of 4" indicator, today's focus total.
- Ring color follows mode color. Optional distraction-free (fullscreen) view.
- Tab title shows countdown (`24:13 · Focus`).

### 7.5 Habit Tracker
- Habit rows × last 7 days grid of check circles (today highlighted).
- Streak badge (🔥 current / best), weekly completion %.
- Add/edit/archive habit via modal.

### 7.6 Analytics
- Date-range tabs (7d / 30d / 90d).
- Charts: study minutes per day (bar), by subject (donut), task completion rate (line/area), habit consistency (heatmap or stacked bars).
- Each chart has a title, short insight line, accessible text summary, and a no-data state.

### 7.7 Settings
Sections: Appearance (theme) · Timer (durations, long-break interval, sound) · Preferences (week start, timezone) · Data (export, reset demo data) · Account (profile, password, sign out, delete account).

### 7.8 Auth pages (Phase 4)
Centered card on charcoal background with a soft purple radial glow; logo, form, inline validation, link to alternate page.

---

## 8. Iconography

**Lucide React**, 20px default, 1.75 stroke width, `currentColor`.
Suggested icons: `LayoutDashboard` (Dashboard), `CheckSquare` (Tasks), `CalendarDays` (Planner), `Timer` (Focus), `Flame` (Habits/streaks), `BarChart3` (Analytics), `Settings`, `Plus`, `Play`, `Pause`, `RotateCcw`, `SkipForward`, `Target` (Goals).

---

## 9. Motion

- Durations: **150ms** (hover/press), **200–250ms** (modals, drawers), **300ms** (progress/ring changes).
- Easing: `ease-out` for entering, `ease-in` for leaving.
- Subtle only: fade/slide-up for cards, checkbox pop, progress-fill animation.
- Respect `prefers-reduced-motion: reduce` — disable transforms and non-essential animation.
- No animation that delays task completion or blocks input.

---

## 10. Accessibility Checklist

- Semantic landmarks: `header`, `nav`, `main`, `section`; one `h1` per page.
- All interactive elements keyboard-reachable with visible focus (2px primary ring).
- Skip-to-content link.
- Icon-only buttons have `aria-label`.
- Form errors linked via `aria-describedby`; use `aria-live="polite"` for toasts and timer completion.
- Timer: announce start/pause/finish to screen readers; don't announce every second.
- Minimum touch target 44×44px on mobile.
- Charts: color is not the sole encoding; provide a table or text summary alternative.
- Support 200% zoom and text resizing without loss of content.

---

## 11. Tailwind Implementation Notes

- Use `darkMode: 'class'` (v3) or a `[data-theme]` variant (v4); set the class/attribute on `<html>`. Default to the user's `prefers-color-scheme`, then persist their choice.
- Map tokens in the theme (`bg-bg`, `bg-surface`, `text-muted`, `border-border`, `bg-primary`) to the CSS variables so components never hard-code hex values.
- Use `clsx` + `tailwind-merge` in a `cn()` helper for conditional classes.
- Avoid flash of wrong theme: set the theme in an inline script before React hydrates.

```css
:root {
  --bg: #F7F7FA; --surface: #FFFFFF; --surface-2: #F0F1F5; --border: #E3E5EB;
  --text: #14151A; --text-muted: #5B6272;
  --primary: #7C3AED; --primary-hover: #6D28D9; --secondary: #2563EB;
}
[data-theme="dark"] {
  --bg: #0F1013; --surface: #16181D; --surface-2: #1D2027; --border: #2A2E37;
  --text: #F2F3F5; --text-muted: #9AA0AC;
  --primary: #8B5CF6; --primary-hover: #7C3AED; --secondary: #3B82F6;
}
```

---

## 12. Frontend Folder Mapping

```
src/
├── components/
│   ├── ui/          # Button, Card, Input, Modal, Badge, Toast, Tabs...
│   ├── tasks/       # TaskItem, TaskForm, TaskFilters
│   ├── timer/       # TimerRing, ModeSwitcher, TimerControls
│   ├── habits/      # HabitRow, HabitForm, StreakBadge
│   └── charts/      # StudyTimeChart, SubjectDonut, HabitHeatmap
├── layouts/         # AppLayout, Sidebar, Topbar, MobileNav, AuthLayout
├── pages/           # Dashboard, Tasks, StudyPlanner, FocusTimer, Habits, Analytics, Settings
├── hooks/           # useTasks, useTimer, useTheme, useLocalStorage
├── services/        # storage adapter now, API client later
├── utils/           # date, streak, analytics, cn helpers
├── data/            # clearly labeled demo data
└── styles/          # index.css (tokens + Tailwind layers)
```

---

## 13. Design QA Checklist

- [ ] Dark and light themes both pass contrast checks
- [ ] Layout verified at 360, 768, 1024, 1440px
- [ ] Every page has loading, empty, and error states
- [ ] Keyboard-only walkthrough of every core flow
- [ ] Purple accent used only for primary/active elements
- [ ] Timer digits don't jitter (tabular numerals)
- [ ] Reduced-motion preference respected
- [ ] Demo data is clearly labeled

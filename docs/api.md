# FocusForge REST API Documentation

Base URL: `/api/v1`

All requests expecting or providing payloads use `application/json` unless otherwise specified.

---

## 1. Response Formats & Status Codes

All API endpoints return a consistent JSON response envelope:

### Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "data": { ... }
}
```

### No Content Response (`204 No Content`)
Empty body.

### Error Response (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Input validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email address"
      }
    ]
  }
}
```

### Standard Status Codes
- `200 OK`: Request succeeded.
- `201 Created`: Resource created successfully.
- `204 No Content`: Resource deleted or action executed with no return content.
- `400 Bad Request`: Invalid parameter format or illegal state.
- `401 Unauthorized`: Missing, expired, or invalid token.
- `403 Forbidden`: Authenticated user lacks permission.
- `404 Not Found`: Resource does not exist or belongs to another user (preventing ID enumeration).
- `409 Conflict`: Unique constraint violation (e.g. duplicate email).
- `422 Unprocessable Entity`: Request body failed strict Zod schema validation.
- `429 Too Many Requests`: Rate limit exceeded.
- `500 Internal Server Error`: Unhandled server exception.

---

## 2. Authentication Mechanics

FocusForge uses dual-token authentication designed for optimal security:

1. **Short-lived Access Token (JWT)**:
   - Validity: `15m`
   - Delivered in response JSON body on register, login, and refresh.
   - Intended for client in-memory storage (never stored in `localStorage` to guard against XSS).
   - Sent in the `Authorization: Bearer <token>` header for all protected endpoints.
2. **Rotating Refresh Token**:
   - Random high-entropy string stored as a SHA-256 hash in the database.
   - Sent via an `httpOnly`, `SameSite`, `Path=/api/v1/auth` cookie named `focusforge_refresh_token`.
   - **Rotation**: Every `/auth/refresh` invocation revokes the old token and issues a new refresh token.
   - **Reuse Detection**: If an already-revoked refresh token is ever presented, the server revokes the user's entire token family, forcing a clean login.
   - **Cookie Configurations**:
     - *Development (Localhost)*: `SameSite=Lax`, `Secure=false`, `Path=/api/v1/auth`.
     - *Production (Cross-Origin/Subdomains)*: `SameSite=None`, `Secure=true`, `Path=/api/v1/auth` paired with `credentials: true` CORS.

---

## 3. Authentication Endpoints

### `POST /auth/register`
Creates a new student account, initializes a default study goal, and issues tokens.

- **Auth**: Public (Strict rate-limited)
- **Request Body**:
```json
{
  "name": "Alex Rivera",
  "email": "alex@university.edu",
  "password": "strongPassword123"
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "671fb2c...",
      "name": "Alex Rivera",
      "email": "alex@university.edu",
      "preferences": {
        "theme": "dark",
        "focusDuration": 25,
        "shortBreakDuration": 5,
        "longBreakDuration": 15,
        "longBreakInterval": 4,
        "soundEnabled": true,
        "soundVolume": 70,
        "weekStartDay": "monday",
        "timezone": "UTC"
      },
      "createdAt": "2026-10-28T09:00:00.000Z",
      "updatedAt": "2026-10-28T09:00:00.000Z"
    },
    "accessToken": "eyJhbGciOi..."
  }
}
```
- Sets `Set-Cookie: focusforge_refresh_token=...; HttpOnly; Path=/api/v1/auth`.

---

### `POST /auth/login`
Authenticates with email and password. Returns a generic error on bad credentials.

- **Auth**: Public (Strict rate-limited)
- **Request Body**:
```json
{
  "email": "alex@university.edu",
  "password": "strongPassword123"
}
```
- **Response (`200 OK`)**: Same payload structure as `/auth/register`. Sets rotated refresh cookie.

---

### `POST /auth/refresh`
Rotates the refresh token and issues a new access token.

- **Auth**: Refresh cookie required (`focusforge_refresh_token`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi..."
  }
}
```
- Sets new rotated refresh cookie.

---

### `POST /auth/logout`
Revokes the current refresh token and clears the cookie.

- **Auth**: Public / Cookie
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out"
  }
}
```

---

### `GET /auth/me`
Fetches current authenticated user profile.

- **Auth**: Bearer token required
- **Response (`200 OK`)**: User profile object.

---

### `PATCH /auth/me`
Updates user display name and/or study preferences.

- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "name": "Alex R.",
  "preferences": {
    "theme": "light",
    "focusDuration": 30
  }
}
```
- **Response (`200 OK`)**: Updated user profile.

---

### `POST /auth/change-password`
Changes user password; verifies current password and invalidates existing sessions.

- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "currentPassword": "strongPassword123",
  "newPassword": "newStrongPassword456"
}
```
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

### `DELETE /auth/me`
Permanently deletes user account and cascades deletion of all tasks, habits, sessions, goals, and tokens.

- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "password": "currentPassword"
}
```
- **Response (`204 No Content`)**

---

## 4. Tasks API

### `GET /tasks`
Lists tasks for the authenticated user with multi-faceted filtering, search, sorting, and pagination.

- **Auth**: Bearer token required
- **Query Parameters**:
  - `status`: `todo` | `in-progress` | `done` | `all`
  - `priority`: `low` | `medium` | `high` | `all`
  - `subject`: string
  - `search`: string (case-insensitive title match)
  - `from`: `YYYY-MM-DD` (due date range start)
  - `to`: `YYYY-MM-DD` (due date range end)
  - `sortBy`: `dueDateAsc` | `dueDateDesc` | `priorityDesc` | `createdAtDesc`
  - `page`: integer (default `1`)
  - `limit`: integer (default `20`, max `100`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "671fb2c...",
        "userId": "671fb2a...",
        "title": "Complete Raft consensus review",
        "subject": "Computer Science",
        "priority": "high",
        "status": "in-progress",
        "dueDate": "2026-10-29",
        "estimatedMinutes": 60,
        "completedAt": null,
        "createdAt": "2026-10-28T09:00:00.000Z",
        "updatedAt": "2026-10-28T09:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

### `POST /tasks`
Creates a task.

- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "title": "Solve LeetCode Daily Problem",
  "subject": "Algorithms",
  "priority": "medium",
  "status": "todo",
  "dueDate": "2026-10-28",
  "estimatedMinutes": 45
}
```
- **Response (`201 Created`)**: Created task object.

### `GET /tasks/:id`
Retrieves a single task by ID. Returns `404` if nonexistent or owned by another user.

### `PATCH /tasks/:id`
Updates a task. Automatically manages `completedAt` timestamp when status transitions to/from `done`.

### `DELETE /tasks/:id`
Deletes a task (`204 No Content`).

---

## 5. Study Sessions API (Planned)

### `GET /sessions`
Lists planned study sessions, filtered by date or date range.

- **Auth**: Bearer token required
- **Query Parameters**:
  - `date`: `YYYY-MM-DD`
  - `from`: `YYYY-MM-DD`
  - `to`: `YYYY-MM-DD`
- **Response (`200 OK`)**: Array of study session objects.

### `POST /sessions`
Schedules a study session. If `taskId` is provided, verifies that the referenced task belongs to the authenticated user.

- **Request Body**:
```json
{
  "title": "Distributed Systems Exam Prep",
  "subject": "Computer Science",
  "date": "2026-10-29",
  "startTime": "14:00",
  "durationMinutes": 60,
  "taskId": "671fb2c...",
  "notes": "Cover election safety and log matching"
}
```
- **Response (`201 Created`)**

### `PATCH /sessions/:id`
Updates a planned study session.

### `DELETE /sessions/:id`
Deletes a planned study session (`204 No Content`).

---

## 6. Focus Sessions API (Recorded)

### `GET /focus-sessions`
Lists recorded focus sessions (Pomodoro or manual timer logs) in descending order of `startedAt`.

- **Auth**: Bearer token required
- **Query Parameters**: `from`, `to` (ISO timestamp bounds).

### `POST /focus-sessions`
Records a completed focus session.

- **Request Body**:
```json
{
  "clientSessionId": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Focus Block 1",
  "subject": "Algorithms",
  "durationMinutes": 25,
  "startedAt": "2026-10-28T09:00:00.000Z",
  "endedAt": "2026-10-28T09:25:00.000Z",
  "mode": "focus",
  "taskId": "671fb2c..."
}
```
- **Response (`201 Created` or `200 OK` on duplicate retry)**: Created or existing focus session object. Supports client-generated UUIDs (`clientSessionId`) for offline outbox retry deduplication.

### `DELETE /focus-sessions/:id`
Deletes a recorded focus session (`204 No Content`).

---

## 7. Habits & Completions API

### `GET /habits`
Lists habits for the user. Supports `?includeArchived=true`.

### `POST /habits`
Creates a new habit.

- **Request Body**:
```json
{
  "title": "Read 20 pages CS textbook",
  "category": "Learning",
  "frequency": "daily",
  "targetPerDay": 1,
  "color": "#8B5CF6"
}
```

### `PATCH /habits/:id`
Updates habit attributes or soft-archives (`{ "active": false }`).

### `DELETE /habits/:id`
Deletes habit and cascades all associated daily completions.

### `GET /habits/completions`
Retrieves daily habit completions within date bounds. Supports `?from=YYYY-MM-DD&to=YYYY-MM-DD&habitId=...`.

### `POST /habits/:id/completions`
Idempotently marks a habit complete or incomplete for a specific calendar date.

- **Request Body**:
```json
{
  "date": "2026-10-28",
  "completed": true
}
```
- **Response (`200 OK`)**: HabitCompletion record.

### `DELETE /habits/:id/completions/:date`
Removes completion for a given date (`204 No Content`).

---

## 8. Goals API

### `GET /goals`
Returns the active weekly study goal. Automatically initializes a default goal if none exists.

- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "671fb2e...",
    "userId": "671fb2a...",
    "targetMinutesWeekly": 600,
    "targetSessionsWeekly": 20,
    "createdAt": "2026-10-28T09:00:00.000Z",
    "updatedAt": "2026-10-28T09:00:00.000Z"
  }
}
```

### `PATCH /goals/:id`
Updates weekly target minutes and session counts.

---

## 9. Analytics API

### `GET /analytics/summary`
Calculates consolidated productivity metrics strictly from stored user records.

- **Auth**: Bearer token required
- **Query Parameters**: `range=7` | `30` | `90` (default `7`)
- **Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "rangeDays": 7,
    "dailyStudyStats": [
      {
        "date": "2026-10-28",
        "label": "Wed",
        "minutes": 120,
        "hours": 2.0,
        "sessionsCount": 3
      }
    ],
    "subjectStudyStats": [
      {
        "subject": "Computer Science",
        "minutes": 90,
        "hours": 1.5,
        "percentage": 75,
        "color": "#8B5CF6"
      }
    ],
    "taskMetrics": {
      "total": 12,
      "completed": 8,
      "inProgress": 3,
      "todo": 1,
      "overdue": 0,
      "completionRate": 67
    },
    "habitConsistency": {
      "overallRate": 85,
      "habitStats": [...]
    },
    "streaks": {
      "currentStreak": 6,
      "bestStreak": 14
    },
    "weeklyGoalProgress": {
      "targetMinutes": 600,
      "completedMinutes": 420,
      "percentage": 70,
      "remainingMinutes": 180,
      "isCompleted": false,
      "sessionsCount": 9
    }
  }
}
```

---

## 10. Data Migration / Bulk Import

### `POST /import`
Accepts the JSON structure exported by the frontend (Settings → Export), maps client IDs to new database records, preserves relational references, and writes data for the authenticated user.

- **Auth**: Bearer token required
- **Request Body**:
```json
{
  "tasks": [...],
  "habits": [...],
  "habitCompletions": [...],
  "studySessions": [...],
  "focusSessions": [...],
  "goal": { "targetMinutesWeekly": 600 },
  "settings": { "theme": "dark" }
}
```
- **Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "tasksImported": 5,
    "habitsImported": 3,
    "habitCompletionsImported": 14,
    "studySessionsImported": 4,
    "focusSessionsImported": 12,
    "goalUpdated": true,
    "settingsUpdated": true
  }
}
```

---

## 11. Health Check

### `GET /health`
Public liveness and database connection probe.

- **Auth**: Public
- **Response (`200 OK` or `503 Service Unavailable`)**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptimeSeconds": 124,
    "timestamp": "2026-10-28T09:42:00.000Z",
    "database": {
      "connected": true,
      "status": "connected"
    }
  }
}
```

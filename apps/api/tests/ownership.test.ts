import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';

describe('Data Ownership & Tenant Isolation (User A vs User B)', () => {
  it('strictly isolates records across all resources and returns 404 on cross-user access', async () => {
    // 1. Create two distinct users
    const userA = await createTestUser('User A', 'user.a@isolation.com', 'password123');
    const userB = await createTestUser('User B', 'user.b@isolation.com', 'password123');

    const authA = `Bearer ${userA.accessToken}`;
    const authB = `Bearer ${userB.accessToken}`;

    // 2. User A creates a Task
    const taskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', authA)
      .send({
        title: 'User A Secret Task',
        subject: 'Algorithms',
        priority: 'high',
        status: 'todo',
      });
    expect(taskRes.status).toBe(201);
    const taskAId = taskRes.body.data.id;

    // User B tries to read, update, or delete User A's task -> 404 Not Found
    const bGetTask = await request(app)
      .get(`/api/v1/tasks/${taskAId}`)
      .set('Authorization', authB);
    expect(bGetTask.status).toBe(404);

    const bPatchTask = await request(app)
      .patch(`/api/v1/tasks/${taskAId}`)
      .set('Authorization', authB)
      .send({ title: 'Hacked by B' });
    expect(bPatchTask.status).toBe(404);

    const bDeleteTask = await request(app)
      .delete(`/api/v1/tasks/${taskAId}`)
      .set('Authorization', authB);
    expect(bDeleteTask.status).toBe(404);

    // User B lists tasks -> must NOT contain User A's task
    const bListTasks = await request(app)
      .get('/api/v1/tasks')
      .set('Authorization', authB);
    expect(bListTasks.status).toBe(200);
    expect(bListTasks.body.data.items).toHaveLength(0);

    // 3. User A creates a Habit
    const habitRes = await request(app)
      .post('/api/v1/habits')
      .set('Authorization', authA)
      .send({
        title: 'User A Morning Run',
        category: 'Fitness',
        frequency: 'daily',
        targetPerDay: 1,
      });
    expect(habitRes.status).toBe(201);
    const habitAId = habitRes.body.data.id;

    // User B tries to read, update, delete User A's habit -> 404
    const bGetHabit = await request(app)
      .get(`/api/v1/habits/${habitAId}`)
      .set('Authorization', authB);
    expect(bGetHabit.status).toBe(404);

    const bPatchHabit = await request(app)
      .patch(`/api/v1/habits/${habitAId}`)
      .set('Authorization', authB)
      .send({ title: 'Hacked habit' });
    expect(bPatchHabit.status).toBe(404);

    const bDeleteHabit = await request(app)
      .delete(`/api/v1/habits/${habitAId}`)
      .set('Authorization', authB);
    expect(bDeleteHabit.status).toBe(404);

    // User B cannot record completion against User A's habit
    const bCompleteHabit = await request(app)
      .post(`/api/v1/habits/${habitAId}/completions`)
      .set('Authorization', authB)
      .send({ date: '2026-10-28', completed: true });
    expect(bCompleteHabit.status).toBe(404);

    // User B lists habits -> must NOT contain User A's habit
    const bListHabits = await request(app)
      .get('/api/v1/habits')
      .set('Authorization', authB);
    expect(bListHabits.body.data).toHaveLength(0);

    // 4. User A creates a planned StudySession
    const sessionRes = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', authA)
      .send({
        title: 'User A Study Session',
        subject: 'Database Systems',
        date: '2026-10-29',
        startTime: '14:00',
        durationMinutes: 45,
      });
    expect(sessionRes.status).toBe(201);
    const sessionAId = sessionRes.body.data.id;

    // User B attempts to access User A's study session -> 404
    const bGetSession = await request(app)
      .get(`/api/v1/sessions/${sessionAId}`)
      .set('Authorization', authB);
    expect(bGetSession.status).toBe(404);

    const bDeleteSession = await request(app)
      .delete(`/api/v1/sessions/${sessionAId}`)
      .set('Authorization', authB);
    expect(bDeleteSession.status).toBe(404);

    // User B cannot link User A's task into B's new study session
    const bLinkATask = await request(app)
      .post('/api/v1/sessions')
      .set('Authorization', authB)
      .send({
        title: 'B session with A task',
        subject: 'Math',
        date: '2026-10-29',
        startTime: '10:00',
        durationMinutes: 30,
        taskId: taskAId,
      });
    expect(bLinkATask.status).toBe(400);
    expect(bLinkATask.body.error.message).toContain('Referenced task');

    // 5. User A creates a FocusSession
    const focusRes = await request(app)
      .post('/api/v1/focus-sessions')
      .set('Authorization', authA)
      .send({
        title: 'User A Pomodoro 1',
        subject: 'Algorithms',
        durationMinutes: 25,
        startedAt: '2026-10-28T09:00:00.000Z',
        endedAt: '2026-10-28T09:25:00.000Z',
        mode: 'focus',
      });
    expect(focusRes.status).toBe(201);
    const focusAId = focusRes.body.data.id;

    // User B cannot delete User A's focus session
    const bDeleteFocus = await request(app)
      .delete(`/api/v1/focus-sessions/${focusAId}`)
      .set('Authorization', authB);
    expect(bDeleteFocus.status).toBe(404);

    // User B cannot link User A's task in a focus session
    const bLinkFocusTask = await request(app)
      .post('/api/v1/focus-sessions')
      .set('Authorization', authB)
      .send({
        title: 'B focus with A task',
        subject: 'Algorithms',
        durationMinutes: 25,
        startedAt: '2026-10-28T10:00:00.000Z',
        endedAt: '2026-10-28T10:25:00.000Z',
        mode: 'focus',
        taskId: taskAId,
      });
    expect(bLinkFocusTask.status).toBe(400);

    // 6. User B cannot see User A's focus sessions in list or analytics
    const bListFocus = await request(app)
      .get('/api/v1/focus-sessions')
      .set('Authorization', authB);
    expect(bListFocus.body.data).toHaveLength(0);

    const bAnalytics = await request(app)
      .get('/api/v1/analytics/summary?range=7')
      .set('Authorization', authB);
    expect(bAnalytics.status).toBe(200);
    expect(bAnalytics.body.data.taskMetrics.total).toBe(0);
    expect(bAnalytics.body.data.weeklyGoalProgress.completedMinutes).toBe(0);
  });
});

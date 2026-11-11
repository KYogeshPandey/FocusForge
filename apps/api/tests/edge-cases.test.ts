import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { Task } from '../src/models/Task.js';
import { FocusSession } from '../src/models/FocusSession.js';
import { createTestUser } from './helpers.js';

describe('Edge Cases and Additional API Hardening', () => {
  it('rejects partial/invalid import data with 422 and does not commit invalid records', async () => {
    const user = await createTestUser('ImportFailUser', 'import-fail@example.com', 'Password123!');
    const auth = `Bearer ${user.accessToken}`;

    // Send payload with an invalid task (estimatedMinutes exceeds maximum 1440)
    const malformedPayload = {
      tasks: [
        {
          id: 'valid-task-1',
          title: 'Valid Task',
          subject: 'Math',
          estimatedMinutes: 99999, // Invalid: max 1440
        },
      ],
      habits: [],
    };

    const res = await request(app)
      .post('/api/v1/import')
      .set('Authorization', auth)
      .send(malformedPayload);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);

    // Confirm no tasks were inserted
    const taskCount = await Task.countDocuments({ title: 'Valid Task' });
    expect(taskCount).toBe(0);
  });

  it('returns clean, non-crashing analytics for completely empty accounts', async () => {
    const user = await createTestUser('EmptyUser', 'empty-user@example.com', 'Password123!');
    const auth = `Bearer ${user.accessToken}`;

    const res = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const data = res.body.data;
    expect(data.rangeDays).toBe(7);
    expect(data.dailyStudyStats).toHaveLength(7);
    expect(data.dailyStudyStats.every((s: any) => s.minutes === 0)).toBe(true);
    expect(data.subjectStudyStats).toHaveLength(0);
    expect(data.taskMetrics.total).toBe(0);
    expect(data.taskMetrics.completionRate).toBe(0);
    expect(data.habitConsistency.overallRate).toBe(0);
    expect(data.streaks.currentStreak).toBe(0);
    expect(data.weeklyGoalProgress.completedMinutes).toBe(0);
    expect(data.weeklyGoalProgress.percentage).toBe(0);
  });

  it('clamps pagination parameters to safe boundaries', async () => {
    const user = await createTestUser('PaginationUser', 'pagination@example.com', 'Password123!');
    const auth = `Bearer ${user.accessToken}`;

    // Create 5 tasks
    for (let i = 1; i <= 5; i++) {
      await request(app)
        .post('/api/v1/tasks')
        .set('Authorization', auth)
        .send({
          title: `Task #${i}`,
          subject: 'General',
        });
    }

    // Query with limit=2
    const resPage1 = await request(app)
      .get('/api/v1/tasks?page=1&limit=2')
      .set('Authorization', auth);

    expect(resPage1.status).toBe(200);
    expect(resPage1.body.data.items).toHaveLength(2);
    expect(resPage1.body.data.pagination.totalPages).toBe(3);
    expect(resPage1.body.data.pagination.total).toBe(5);

    // Query with limit=500 (rejected by schema since max limit is 100)
    const resOverLimit = await request(app)
      .get('/api/v1/tasks?limit=500')
      .set('Authorization', auth);

    expect(resOverLimit.status).toBe(422);
    expect(resOverLimit.body.success).toBe(false);

    // Query with limit=0 (rejected by schema since min limit is 1)
    const resUnderLimit = await request(app)
      .get('/api/v1/tasks?limit=0')
      .set('Authorization', auth);

    expect(resUnderLimit.status).toBe(422);
    expect(resUnderLimit.body.success).toBe(false);
  });

  it('records habit completions across day boundaries and calculates consecutive streaks', async () => {
    const user = await createTestUser('HabitStreakUser', 'habit-streak@example.com', 'Password123!');
    const auth = `Bearer ${user.accessToken}`;

    // Create a habit
    const habitRes = await request(app)
      .post('/api/v1/habits')
      .set('Authorization', auth)
      .send({
        title: 'Morning Run',
        category: 'fitness',
        frequency: 'daily',
      });

    const habitId = habitRes.body.data.id;

    // Toggle today and yesterday
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const toggleRes1 = await request(app)
      .post(`/api/v1/habits/${habitId}/completions`)
      .set('Authorization', auth)
      .send({ date: yesterday, completed: true });
    expect(toggleRes1.status).toBe(200);
    expect(toggleRes1.body.data.completed).toBe(true);

    const toggleRes2 = await request(app)
      .post(`/api/v1/habits/${habitId}/completions`)
      .set('Authorization', auth)
      .send({ date: today, completed: true });
    expect(toggleRes2.status).toBe(200);
    expect(toggleRes2.body.data.completed).toBe(true);

    // Check analytics reflecting the 2-day streak
    const analyticsRes = await request(app)
      .get('/api/v1/analytics/summary')
      .set('Authorization', auth);

    expect(analyticsRes.body.data.streaks.currentStreak).toBe(2);
  });

  it('guarantees idempotent focus-session creation when clientSessionId is supplied', async () => {
    const user = await createTestUser('FocusIdempotentUser', 'focus-idempotent@example.com', 'Password123!');
    const auth = `Bearer ${user.accessToken}`;
    const clientSessionId = 'client-uuid-999-alpha';

    const sessionPayload = {
      clientSessionId,
      title: 'Math Calculus Prep',
      subject: 'Mathematics',
      durationMinutes: 25,
      startedAt: new Date(Date.now() - 25 * 60000).toISOString(),
      endedAt: new Date().toISOString(),
      mode: 'focus',
    };

    // First attempt
    const res1 = await request(app)
      .post('/api/v1/focus-sessions')
      .set('Authorization', auth)
      .send(sessionPayload);

    expect(res1.status).toBe(201);
    const createdId = res1.body.data.id;

    // Retry attempt with same clientSessionId
    const res2 = await request(app)
      .post('/api/v1/focus-sessions')
      .set('Authorization', auth)
      .send(sessionPayload);

    expect([200, 201]).toContain(res2.status);
    expect(res2.body.data.id).toBe(createdId);

    // Verify only 1 record exists in database
    const sessionCount = await FocusSession.countDocuments({ clientSessionId });
    expect(sessionCount).toBe(1);
  });

  it('enforces rate limiting on /auth endpoints when test rate-limiting header is enabled', async () => {
    // Send 22 login attempts with x-test-rate-limit: true
    let hitRateLimit = false;

    for (let i = 0; i < 22; i++) {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('x-test-rate-limit', 'true')
        .send({
          email: 'ratelimit-target@example.com',
          password: 'WrongPassword!',
        });

      if (res.status === 429) {
        hitRateLimit = true;
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
  });
});

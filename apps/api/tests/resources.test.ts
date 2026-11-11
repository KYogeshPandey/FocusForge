import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';

describe('Resource Endpoints & Business Logic', () => {
  it('manages tasks with filtering, search, and pagination', async () => {
    const user = await createTestUser('TaskTester', 'tasktester@test.com', 'password123');
    const auth = `Bearer ${user.accessToken}`;

    // Create 3 tasks
    await request(app).post('/api/v1/tasks').set('Authorization', auth).send({
      title: 'Review Physics Lecture 1',
      subject: 'Physics',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-10-29',
    });

    await request(app).post('/api/v1/tasks').set('Authorization', auth).send({
      title: 'Math Homework Sheet',
      subject: 'Math',
      priority: 'medium',
      status: 'in-progress',
      dueDate: '2026-10-30',
    });

    await request(app).post('/api/v1/tasks').set('Authorization', auth).send({
      title: 'Physics Lab Report',
      subject: 'Physics',
      priority: 'low',
      status: 'done',
    });

    // List all
    const allRes = await request(app).get('/api/v1/tasks').set('Authorization', auth);
    expect(allRes.status).toBe(200);
    expect(allRes.body.data.items).toHaveLength(3);
    expect(allRes.body.data.pagination.total).toBe(3);

    // Filter by subject
    const subjectRes = await request(app)
      .get('/api/v1/tasks?subject=Physics')
      .set('Authorization', auth);
    expect(subjectRes.body.data.items).toHaveLength(2);

    // Search by title
    const searchRes = await request(app)
      .get('/api/v1/tasks?search=Homework')
      .set('Authorization', auth);
    expect(searchRes.body.data.items).toHaveLength(1);
    expect(searchRes.body.data.items[0].title).toBe('Math Homework Sheet');
  });

  it('manages habits and idempotent habit completions', async () => {
    const user = await createTestUser('HabitTester', 'habittester@test.com', 'password123');
    const auth = `Bearer ${user.accessToken}`;

    // Create habit
    const createRes = await request(app)
      .post('/api/v1/habits')
      .set('Authorization', auth)
      .send({
        title: 'Drink 2L Water',
        category: 'Health',
        frequency: 'daily',
        targetPerDay: 1,
        color: '#22C55E',
      });
    expect(createRes.status).toBe(201);
    const habitId = createRes.body.data.id;

    // Record completion for date
    const comp1 = await request(app)
      .post(`/api/v1/habits/${habitId}/completions`)
      .set('Authorization', auth)
      .send({ date: '2026-10-28', completed: true });
    expect(comp1.status).toBe(200);
    expect(comp1.body.data.completed).toBe(true);

    // Record completion again (idempotent upsert, not duplicate error)
    const comp2 = await request(app)
      .post(`/api/v1/habits/${habitId}/completions`)
      .set('Authorization', auth)
      .send({ date: '2026-10-28', completed: false });
    expect(comp2.status).toBe(200);
    expect(comp2.body.data.completed).toBe(false);

    // Query completions
    const listComps = await request(app)
      .get('/api/v1/habits/completions')
      .set('Authorization', auth);
    expect(listComps.status).toBe(200);
    expect(listComps.body.data).toHaveLength(1);

    // Delete completion
    const delComp = await request(app)
      .delete(`/api/v1/habits/${habitId}/completions/2026-10-28`)
      .set('Authorization', auth);
    expect(delComp.status).toBe(204);

    const listCompsAfter = await request(app)
      .get('/api/v1/habits/completions')
      .set('Authorization', auth);
    expect(listCompsAfter.body.data).toHaveLength(0);
  });

  it('manages goals and weekly study target updates', async () => {
    const user = await createTestUser('GoalTester', 'goaltester@test.com', 'password123');
    const auth = `Bearer ${user.accessToken}`;

    // Auto-initialized goal
    const getRes = await request(app).get('/api/v1/goals').set('Authorization', auth);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.targetMinutesWeekly).toBe(600);
    const goalId = getRes.body.data.id;

    // Update goal
    const patchRes = await request(app)
      .patch(`/api/v1/goals/${goalId}`)
      .set('Authorization', auth)
      .send({ targetMinutesWeekly: 900 });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.targetMinutesWeekly).toBe(900);
  });

  it('computes accurate analytics matching known fixture data', async () => {
    const user = await createTestUser('AnalyticsTester', 'analyticstester@test.com', 'password123');
    const auth = `Bearer ${user.accessToken}`;
    const today = new Date().toISOString().slice(0, 10);

    // Create 1 focus session today (60 min) and 1 yesterday (45 min)
    await request(app).post('/api/v1/focus-sessions').set('Authorization', auth).send({
      title: 'Calculus Session 1',
      subject: 'Math',
      durationMinutes: 60,
      startedAt: `${today}T10:00:00.000Z`,
      endedAt: `${today}T11:00:00.000Z`,
      mode: 'focus',
    });

    // Create 1 task
    await request(app).post('/api/v1/tasks').set('Authorization', auth).send({
      title: 'Finished Problem Set',
      subject: 'Math',
      priority: 'high',
      status: 'done',
    });

    const analyticsRes = await request(app)
      .get('/api/v1/analytics/summary?range=7')
      .set('Authorization', auth);

    expect(analyticsRes.status).toBe(200);
    const data = analyticsRes.body.data;

    // Verify task metrics
    expect(data.taskMetrics.total).toBe(1);
    expect(data.taskMetrics.completed).toBe(1);
    expect(data.taskMetrics.completionRate).toBe(100);

    // Verify subject breakdown
    expect(data.subjectStudyStats).toHaveLength(1);
    expect(data.subjectStudyStats[0].subject).toBe('Math');
    expect(data.subjectStudyStats[0].minutes).toBe(60);

    // Verify goal progress
    expect(data.weeklyGoalProgress.completedMinutes).toBe(60);
  });

  it('accepts bulk data import and rejects malformed import payloads', async () => {
    const user = await createTestUser('ImportTester', 'importtester@test.com', 'password123');
    const auth = `Bearer ${user.accessToken}`;

    // Valid import payload
    const validImport = {
      tasks: [
        {
          id: 'imported-task-1',
          title: 'Imported Raft paper review',
          subject: 'Computer Science',
          priority: 'high',
          status: 'todo',
        },
      ],
      habits: [
        {
          id: 'imported-habit-1',
          title: 'Daily Code Commit',
          category: 'Coding',
          frequency: 'daily',
          targetPerDay: 1,
        },
      ],
      habitCompletions: [
        {
          habitId: 'imported-habit-1',
          date: '2026-10-27',
          completed: true,
        },
      ],
      studySessions: [],
      focusSessions: [],
      goal: {
        targetMinutesWeekly: 750,
      },
    };

    const importRes = await request(app)
      .post('/api/v1/import')
      .set('Authorization', auth)
      .send(validImport);

    expect(importRes.status).toBe(201);
    expect(importRes.body.data.tasksImported).toBe(1);
    expect(importRes.body.data.habitsImported).toBe(1);
    expect(importRes.body.data.habitCompletionsImported).toBe(1);
    expect(importRes.body.data.goalUpdated).toBe(true);

    // Verify imported task is in DB
    const listRes = await request(app).get('/api/v1/tasks').set('Authorization', auth);
    expect(listRes.body.data.items).toHaveLength(1);
    expect(listRes.body.data.items[0].title).toBe('Imported Raft paper review');

    // Reject invalid import payload
    const invalidRes = await request(app)
      .post('/api/v1/import')
      .set('Authorization', auth)
      .send({
        tasks: 'not-an-array',
      });
    expect(invalidRes.status).toBe(422);
  });
});

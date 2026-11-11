import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  aggregateStudyMinutesByDay,
  aggregateTimeBySubject,
  calculateTaskMetrics,
  aggregateHabitConsistency,
} from '../src/utils/analytics';
import type { Task, Habit, HabitCompletion, FocusSession } from '@focusforge/shared';

describe('Analytics Parity (Local Calculation vs API Specification)', () => {
  const referenceDate = new Date('2026-10-28T12:00:00.000Z');
  const todayStr = '2026-10-28';
  const yesterdayStr = '2026-10-27';

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(referenceDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fixtureTasks: Task[] = [
    {
      id: 'task-1',
      userId: 'user-1',
      title: 'Finished Problem Set',
      subject: 'Math',
      priority: 'high',
      status: 'done',
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-28T10:00:00.000Z',
      completedAt: '2026-10-28T10:00:00.000Z',
    },
    {
      id: 'task-2',
      userId: 'user-1',
      title: 'Pending Reading',
      subject: 'History',
      priority: 'medium',
      status: 'todo',
      dueDate: '2026-10-29',
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
    },
  ];

  const fixtureSessions: FocusSession[] = [
    {
      id: 'focus-1',
      userId: 'user-1',
      title: 'Calculus Session 1',
      subject: 'Math',
      durationMinutes: 60,
      startedAt: `${todayStr}T10:00:00.000Z`,
      endedAt: `${todayStr}T11:00:00.000Z`,
      mode: 'focus',
      createdAt: `${todayStr}T11:00:00.000Z`,
    },
    {
      id: 'focus-2',
      userId: 'user-1',
      title: 'History Review',
      subject: 'History',
      durationMinutes: 45,
      startedAt: `${yesterdayStr}T14:00:00.000Z`,
      endedAt: `${yesterdayStr}T14:45:00.000Z`,
      mode: 'focus',
      createdAt: `${yesterdayStr}T14:45:00.000Z`,
    },
  ];

  const fixtureHabits: Habit[] = [
    {
      id: 'habit-1',
      userId: 'user-1',
      title: 'Daily Math Practice',
      category: 'Study',
      frequency: 'daily',
      targetPerDay: 1,
      color: '#8B5CF6',
      active: true,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    },
  ];

  const fixtureCompletions: HabitCompletion[] = [
    {
      id: 'comp-1',
      userId: 'user-1',
      habitId: 'habit-1',
      date: todayStr,
      completed: true,
      createdAt: `${todayStr}T09:00:00.000Z`,
    },
  ];

  it('produces identical task metrics for the fixture dataset', () => {
    const metrics = calculateTaskMetrics(fixtureTasks);

    expect(metrics.total).toBe(2);
    expect(metrics.completed).toBe(1);
    expect(metrics.todo).toBe(1);
    expect(metrics.inProgress).toBe(0);
    expect(metrics.overdue).toBe(0);
    expect(metrics.completionRate).toBe(50);
  });

  it('produces identical daily study breakdown matching 7-day server summary', () => {
    const dailyStats = aggregateStudyMinutesByDay(fixtureSessions, 7, referenceDate);

    expect(dailyStats).toHaveLength(7);
    const todayStat = dailyStats.find((d) => d.date === todayStr);
    expect(todayStat?.minutes).toBe(60);
    expect(todayStat?.hours).toBe(1.0);

    const yesterdayStat = dailyStats.find((d) => d.date === yesterdayStr);
    expect(yesterdayStat?.minutes).toBe(45);
    expect(yesterdayStat?.hours).toBe(0.8);

    const totalMinutes = dailyStats.reduce((sum, d) => sum + d.minutes, 0);
    expect(totalMinutes).toBe(105);
  });

  it('produces identical subject breakdown matching server aggregation', () => {
    const subjectStats = aggregateTimeBySubject(fixtureSessions, 7, referenceDate);

    expect(subjectStats).toHaveLength(2);
    const mathStat = subjectStats.find((s) => s.subject === 'Math');
    const historyStat = subjectStats.find((s) => s.subject === 'History');

    expect(mathStat?.minutes).toBe(60);
    expect(mathStat?.percentage).toBe(57); // 60/105 = 57.1%

    expect(historyStat?.minutes).toBe(45);
    expect(historyStat?.percentage).toBe(43); // 45/105 = 42.8%
  });

  it('produces identical habit consistency statistics matching server aggregation', () => {
    const habitStats = aggregateHabitConsistency(fixtureHabits, fixtureCompletions, 7, referenceDate);

    expect(habitStats.overallRate).toBe(14); // 1 completed out of 7 total possible days = 14%
    expect(habitStats.habitStats).toHaveLength(1);
    expect(habitStats.habitStats[0]!.completedDays).toBe(1);
    expect(habitStats.habitStats[0]!.totalDays).toBe(7);
    expect(habitStats.habitStats[0]!.percentage).toBe(14);
  });
});

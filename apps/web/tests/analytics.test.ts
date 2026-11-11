import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  aggregateStudyMinutesByDay,
  aggregateTimeBySubject,
  calculateTaskMetrics,
  aggregateHabitConsistency,
} from '../src/utils/analytics';
import type { FocusSession, Task, Habit, HabitCompletion } from '@focusforge/shared';

describe('Analytics Calculations', () => {
  const refDate = parseISO('2026-10-27');

  it('aggregates daily study minutes across selected days count', () => {
    const sessions: FocusSession[] = [
      {
        id: '1',
        userId: 'u1',
        title: 'Session 1',
        subject: 'Math',
        durationMinutes: 45,
        startedAt: '2026-10-27T10:00:00.000Z',
        endedAt: '2026-10-27T10:45:00.000Z',
        mode: 'focus',
        createdAt: '',
      },
      {
        id: '2',
        userId: 'u1',
        title: 'Session 2',
        subject: 'Math',
        durationMinutes: 30,
        startedAt: '2026-10-27T14:00:00.000Z',
        endedAt: '2026-10-27T14:30:00.000Z',
        mode: 'focus',
        createdAt: '',
      },
      {
        id: '3',
        userId: 'u1',
        title: 'Session 3',
        subject: 'CS',
        durationMinutes: 60,
        startedAt: '2026-10-26T10:00:00.000Z',
        endedAt: '2026-10-26T11:00:00.000Z',
        mode: 'focus',
        createdAt: '',
      },
    ];

    const result = aggregateStudyMinutesByDay(sessions, 7, refDate);
    expect(result.length).toBe(7);
    
    const todayStat = result.find((r) => r.date === '2026-10-27');
    expect(todayStat?.minutes).toBe(75);
    expect(todayStat?.sessionsCount).toBe(2);

    const yesterdayStat = result.find((r) => r.date === '2026-10-26');
    expect(yesterdayStat?.minutes).toBe(60);
    expect(yesterdayStat?.sessionsCount).toBe(1);
  });

  it('aggregates time by subject with percentages', () => {
    const sessions: FocusSession[] = [
      {
        id: '1',
        userId: 'u1',
        title: '',
        subject: 'Computer Science',
        durationMinutes: 90,
        startedAt: '2026-10-27T10:00:00.000Z',
        endedAt: '2026-10-27T11:30:00.000Z',
        mode: 'focus',
        createdAt: '',
      },
      {
        id: '2',
        userId: 'u1',
        title: '',
        subject: 'Physics',
        durationMinutes: 30,
        startedAt: '2026-10-26T10:00:00.000Z',
        endedAt: '2026-10-26T10:30:00.000Z',
        mode: 'focus',
        createdAt: '',
      },
    ];

    const result = aggregateTimeBySubject(sessions, 7, refDate);
    expect(result.length).toBe(2);
    expect(result[0]?.subject).toBe('Computer Science');
    expect(result[0]?.percentage).toBe(75);
    expect(result[1]?.subject).toBe('Physics');
    expect(result[1]?.percentage).toBe(25);
  });

  it('computes task metrics and completion rate accurately', () => {
    const tasks: Task[] = [
      {
        id: '1',
        userId: 'u1',
        title: 'Task 1',
        subject: 'CS',
        priority: 'high',
        status: 'done',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '2',
        userId: 'u1',
        title: 'Task 2',
        subject: 'CS',
        priority: 'medium',
        status: 'done',
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '3',
        userId: 'u1',
        title: 'Task 3',
        subject: 'CS',
        priority: 'low',
        status: 'todo',
        dueDate: '2026-10-20', // Overdue relative to current date
        createdAt: '',
        updatedAt: '',
      },
      {
        id: '4',
        userId: 'u1',
        title: 'Task 4',
        subject: 'CS',
        priority: 'low',
        status: 'in-progress',
        createdAt: '',
        updatedAt: '',
      },
    ];

    const metrics = calculateTaskMetrics(tasks);
    expect(metrics.total).toBe(4);
    expect(metrics.completed).toBe(2);
    expect(metrics.completionRate).toBe(50);
    expect(metrics.overdue).toBe(1);
    expect(metrics.inProgress).toBe(1);
    expect(metrics.todo).toBe(1);
  });

  it('calculates habit consistency percentage', () => {
    const habits: Habit[] = [
      {
        id: 'h1',
        userId: 'u1',
        title: 'Daily LeetCode',
        category: 'Coding',
        frequency: 'daily',
        targetPerDay: 1,
        color: '#8B5CF6',
        active: true,
        createdAt: '',
        updatedAt: '',
      },
    ];

    const completions: HabitCompletion[] = [
      { id: '1', userId: 'u1', habitId: 'h1', date: '2026-10-27', completed: true, createdAt: '' },
      { id: '2', userId: 'u1', habitId: 'h1', date: '2026-10-26', completed: true, createdAt: '' },
    ];

    // Out of 7 days, 2 days completed -> 2/7 ≈ 29%
    const res = aggregateHabitConsistency(habits, completions, 7, refDate);
    expect(res.habitStats.length).toBe(1);
    expect(res.habitStats[0]?.completedDays).toBe(2);
    expect(res.habitStats[0]?.percentage).toBe(29);
  });
});

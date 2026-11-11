import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import { calculateWeeklyGoalProgress } from '../src/utils/goals';
import type { FocusSession } from '@focusforge/shared';

describe('Weekly Goal Calculation', () => {
  const refDate = parseISO('2026-10-27T10:00:00Z'); // Tuesday of current week

  it('calculates weekly progress correctly from focus sessions only', () => {
    const sessions: FocusSession[] = [
      // Within this week (Monday 2026-10-26)
      {
        id: 's1',
        userId: 'u1',
        title: 'Algorithms',
        subject: 'Computer Science',
        durationMinutes: 50,
        startedAt: '2026-10-26T14:00:00.000Z',
        endedAt: '2026-10-26T14:50:00.000Z',
        mode: 'focus',
        createdAt: '2026-10-26T14:50:00.000Z',
      },
      // Within this week (Tuesday 2026-10-27)
      {
        id: 's2',
        userId: 'u1',
        title: 'Calculus',
        subject: 'Math',
        durationMinutes: 25,
        startedAt: '2026-10-27T09:00:00.000Z',
        endedAt: '2026-10-27T09:25:00.000Z',
        mode: 'focus',
        createdAt: '2026-10-27T09:25:00.000Z',
      },
      // Break session - MUST NOT count towards study goal
      {
        id: 's3',
        userId: 'u1',
        title: 'Break',
        subject: 'General',
        durationMinutes: 15,
        startedAt: '2026-10-27T09:25:00.000Z',
        endedAt: '2026-10-27T09:40:00.000Z',
        mode: 'short-break',
        createdAt: '2026-10-27T09:40:00.000Z',
      },
      // Previous week session - MUST NOT count towards this week
      {
        id: 's4',
        userId: 'u1',
        title: 'Old session',
        subject: 'Math',
        durationMinutes: 60,
        startedAt: '2026-10-18T10:00:00.000Z',
        endedAt: '2026-10-18T11:00:00.000Z',
        mode: 'focus',
        createdAt: '2026-10-18T11:00:00.000Z',
      },
    ];

    const result = calculateWeeklyGoalProgress(150, sessions, refDate, true);
    // 50 + 25 = 75 minutes completed out of 150 = 50%
    expect(result.completedMinutes).toBe(75);
    expect(result.targetMinutes).toBe(150);
    expect(result.percentage).toBe(50);
    expect(result.remainingMinutes).toBe(75);
    expect(result.isCompleted).toBe(false);
    expect(result.sessionsCount).toBe(2);
  });

  it('caps percentage at 100 and marks isCompleted when target is exceeded', () => {
    const sessions: FocusSession[] = [
      {
        id: 's1',
        userId: 'u1',
        title: 'Deep Work',
        subject: 'CS',
        durationMinutes: 200,
        startedAt: '2026-10-26T10:00:00.000Z',
        endedAt: '2026-10-26T13:20:00.000Z',
        mode: 'focus',
        createdAt: '2026-10-26T13:20:00.000Z',
      },
    ];

    const result = calculateWeeklyGoalProgress(100, sessions, refDate, true);
    expect(result.completedMinutes).toBe(200);
    expect(result.percentage).toBe(100);
    expect(result.remainingMinutes).toBe(0);
    expect(result.isCompleted).toBe(true);
  });
});

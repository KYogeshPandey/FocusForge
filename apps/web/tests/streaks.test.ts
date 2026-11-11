import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import { calculateHabitStreak, calculateOverallStreak } from '../src/utils/streaks';
import type { HabitCompletion } from '@focusforge/shared';

describe('Streak Calculation', () => {
  const refDate = parseISO('2026-10-27'); // Tuesday

  it('calculates current streak when completed today', () => {
    const completions: HabitCompletion[] = [
      { id: '1', userId: 'u1', habitId: 'h1', date: '2026-10-27', completed: true, createdAt: '' },
      { id: '2', userId: 'u1', habitId: 'h1', date: '2026-10-26', completed: true, createdAt: '' },
      { id: '3', userId: 'u1', habitId: 'h1', date: '2026-10-25', completed: true, createdAt: '' },
    ];

    const result = calculateHabitStreak('h1', completions, refDate);
    expect(result.currentStreak).toBe(3);
    expect(result.completedToday).toBe(true);
    expect(result.bestStreak).toBe(3);
  });

  it('preserves streak when today is not yet completed (PRD rule: today does not break streak)', () => {
    const completions: HabitCompletion[] = [
      // Not completed on 2026-10-27 (today)
      { id: '1', userId: 'u1', habitId: 'h1', date: '2026-10-26', completed: true, createdAt: '' },
      { id: '2', userId: 'u1', habitId: 'h1', date: '2026-10-25', completed: true, createdAt: '' },
      { id: '3', userId: 'u1', habitId: 'h1', date: '2026-10-24', completed: true, createdAt: '' },
    ];

    const result = calculateHabitStreak('h1', completions, refDate);
    expect(result.currentStreak).toBe(3);
    expect(result.completedToday).toBe(false);
  });

  it('resets streak to 0 if yesterday was missed and today is not completed', () => {
    const completions: HabitCompletion[] = [
      // Missed today (10-27) and missed yesterday (10-26)
      { id: '1', userId: 'u1', habitId: 'h1', date: '2026-10-25', completed: true, createdAt: '' },
    ];

    const result = calculateHabitStreak('h1', completions, refDate);
    expect(result.currentStreak).toBe(0);
    expect(result.bestStreak).toBe(1);
  });

  it('calculates best historical streak higher than current streak', () => {
    const completions: HabitCompletion[] = [
      // Historical streak of 4
      { id: '1', userId: 'u1', habitId: 'h1', date: '2026-10-10', completed: true, createdAt: '' },
      { id: '2', userId: 'u1', habitId: 'h1', date: '2026-10-11', completed: true, createdAt: '' },
      { id: '3', userId: 'u1', habitId: 'h1', date: '2026-10-12', completed: true, createdAt: '' },
      { id: '4', userId: 'u1', habitId: 'h1', date: '2026-10-13', completed: true, createdAt: '' },
      // Break on 10-14, then current streak of 1
      { id: '5', userId: 'u1', habitId: 'h1', date: '2026-10-27', completed: true, createdAt: '' },
    ];

    const result = calculateHabitStreak('h1', completions, refDate);
    expect(result.currentStreak).toBe(1);
    expect(result.bestStreak).toBe(4);
  });

  it('calculates overall streak across multiple active dates', () => {
    const dates = new Set(['2026-10-25', '2026-10-26', '2026-10-27']);
    const result = calculateOverallStreak(dates, refDate);
    expect(result.currentStreak).toBe(3);
  });
});

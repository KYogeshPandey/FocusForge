import { describe, it, expect } from 'vitest';
import { parseISO } from 'date-fns';
import {
  formatDuration,
  formatSeconds,
  formatDisplayDate,
  getPastDateStrings,
  isOverdue,
} from '../src/utils/dates';

describe('Date Utilities', () => {
  it('formats duration in minutes to hours and minutes', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h');
    expect(formatDuration(125)).toBe('2h 5m');
  });

  it('formats seconds into MM:SS', () => {
    expect(formatSeconds(1500)).toBe('25:00');
    expect(formatSeconds(300)).toBe('05:00');
    expect(formatSeconds(65)).toBe('01:05');
    expect(formatSeconds(0)).toBe('00:00');
    expect(formatSeconds(-5)).toBe('00:00');
  });

  it('formats display date for human readability', () => {
    expect(formatDisplayDate(null)).toBe('No due date');
    const today = new Date().toISOString().slice(0, 10);
    expect(formatDisplayDate(today)).toBe('Today');
  });

  it('correctly identifies overdue tasks', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    expect(isOverdue(yesterday, false)).toBe(true);
    expect(isOverdue(yesterday, true)).toBe(false); // Completed task is not overdue
    expect(isOverdue(tomorrow, false)).toBe(false);
    expect(isOverdue(null, false)).toBe(false);
  });

  it('generates correct sequence of past dates', () => {
    const ref = parseISO('2026-10-27');
    const past5 = getPastDateStrings(5, ref);
    expect(past5).toEqual([
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
    ]);
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRemainingSeconds,
  getNextTimerCycle,
  formatTitleCountdown,
} from '../src/utils/timer';

describe('Timer Logic', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates remaining seconds based on timestamp without drift', () => {
    const baseNow = 1000000;
    vi.setSystemTime(baseNow);

    const durationSeconds = 1500; // 25 min
    const endsAt = baseNow + durationSeconds * 1000;

    // Right at start
    const start = calculateRemainingSeconds(endsAt, durationSeconds, false, durationSeconds);
    expect(start.remainingSeconds).toBe(1500);
    expect(start.progressPercentage).toBe(0);
    expect(start.isFinished).toBe(false);

    // Advance 500 seconds
    vi.advanceTimersByTime(500 * 1000);
    const mid = calculateRemainingSeconds(endsAt, durationSeconds, false, durationSeconds);
    expect(mid.remainingSeconds).toBe(1000);
    expect(Math.round(mid.progressPercentage)).toBe(33);

    // Advance to end
    vi.advanceTimersByTime(1000 * 1000);
    const finished = calculateRemainingSeconds(endsAt, durationSeconds, false, durationSeconds);
    expect(finished.remainingSeconds).toBe(0);
    expect(finished.isFinished).toBe(true);
  });

  it('preserves paused remaining time when paused', () => {
    const paused = calculateRemainingSeconds(null, 1500, true, 820);
    expect(paused.remainingSeconds).toBe(820);
    expect(paused.isFinished).toBe(false);
  });

  it('cycles through focus -> short-break and long-break on 4th round', () => {
    // Round 1 focus -> short-break (rounds becomes 1)
    const cycle1 = getNextTimerCycle('focus', 0, 4);
    expect(cycle1.nextMode).toBe('short-break');
    expect(cycle1.nextRounds).toBe(1);

    // Short-break -> focus
    const cycle2 = getNextTimerCycle('short-break', 1, 4);
    expect(cycle2.nextMode).toBe('focus');
    expect(cycle2.nextRounds).toBe(1);

    // Round 4 focus -> long-break
    const cycle4 = getNextTimerCycle('focus', 3, 4);
    expect(cycle4.nextMode).toBe('long-break');
    expect(cycle4.nextRounds).toBe(4);

    // Long-break -> focus
    const cycle5 = getNextTimerCycle('long-break', 4, 4);
    expect(cycle5.nextMode).toBe('focus');
  });

  it('formats title countdown correctly', () => {
    expect(formatTitleCountdown(1453, 'focus')).toBe('24:13 · Focus');
    expect(formatTitleCountdown(300, 'short-break')).toBe('05:00 · Short Break');
    expect(formatTitleCountdown(900, 'long-break')).toBe('15:00 · Long Break');
  });
});

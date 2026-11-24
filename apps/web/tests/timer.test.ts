import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRemainingSeconds,
  getNextTimerCycle,
  formatTitleCountdown,
  calculateTaskSessions,
  calculateTaskRoundPlan,
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

  it('calculates dynamic task sessions correctly for a 180-minute task', () => {
    // 180 min task with default 25 min sessions: 7 x 25 min + 1 x 5 min
    const sessions = calculateTaskSessions(180, 25);
    expect(sessions).toEqual([25, 25, 25, 25, 25, 25, 25, 5]);
    expect(sessions.length).toBe(8);
    expect(sessions.reduce((a, b) => a + b, 0)).toBe(180);

    // 50 min task: 2 x 25 min
    expect(calculateTaskSessions(50, 25)).toEqual([25, 25]);

    // 25 min task: 1 x 25 min
    expect(calculateTaskSessions(25, 25)).toEqual([25]);

    // 10 min task: 1 x 10 min
    expect(calculateTaskSessions(10, 25)).toEqual([10]);

    // 0 or negative
    expect(calculateTaskSessions(0, 25)).toEqual([]);
    expect(calculateTaskSessions(-10, 25)).toEqual([]);
  });

  it('calculates task round plans dynamically across round progressions', () => {
    // Initial state of 180-minute task: 0 logged
    const planStart = calculateTaskRoundPlan(180, 0, 0, 25);
    expect(planStart.totalRounds).toBe(8);
    expect(planStart.currentRound).toBe(1);
    expect(planStart.currentRoundDurationMinutes).toBe(25);
    expect(planStart.remainingTaskMinutes).toBe(180);
    expect(planStart.isTaskComplete).toBe(false);

    // After round 1 completes: 25 logged, 1 completed round
    const planAfterRound1 = calculateTaskRoundPlan(180, 25, 1, 25);
    expect(planAfterRound1.totalRounds).toBe(8);
    expect(planAfterRound1.currentRound).toBe(2);
    expect(planAfterRound1.currentRoundDurationMinutes).toBe(25);
    expect(planAfterRound1.remainingTaskMinutes).toBe(155);
    expect(planAfterRound1.isTaskComplete).toBe(false);

    // Final round (round 8): 175 logged, 7 completed rounds
    const planFinalRound = calculateTaskRoundPlan(180, 175, 7, 25);
    expect(planFinalRound.totalRounds).toBe(8);
    expect(planFinalRound.currentRound).toBe(8);
    expect(planFinalRound.currentRoundDurationMinutes).toBe(5);
    expect(planFinalRound.remainingTaskMinutes).toBe(5);
    expect(planFinalRound.isTaskComplete).toBe(false);

    // Complete: 180 logged, 8 completed rounds
    const planDone = calculateTaskRoundPlan(180, 180, 8, 25);
    expect(planDone.totalRounds).toBe(8);
    expect(planDone.currentRound).toBe(8);
    expect(planDone.currentRoundDurationMinutes).toBe(0);
    expect(planDone.remainingTaskMinutes).toBe(0);
    expect(planDone.isTaskComplete).toBe(true);

    // Default fallback when no task is linked
    const planNoTask = calculateTaskRoundPlan(null, 0, 0, 25);
    expect(planNoTask.totalRounds).toBe(4);
    expect(planNoTask.currentRound).toBe(1);
    expect(planNoTask.currentRoundDurationMinutes).toBe(25);
    expect(planNoTask.isTaskComplete).toBe(false);
  });
});

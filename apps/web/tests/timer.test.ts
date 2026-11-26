import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateRemainingSeconds,
  getNextTimerCycle,
  formatTitleCountdown,
  calculateTaskSessions,
  calculateTaskRoundPlan,
  FOCUS_DURATION_PRESETS,
  TIMER_DURATION_LIMITS,
  validateDurationMinutes,
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

  it('cycles through focus -> short-break for rounds 1-4 and long-break on 5th round continuously', () => {
    // Rounds 1-4 focus -> short-break
    for (let completed = 0; completed < 4; completed++) {
      const cycle = getNextTimerCycle('focus', completed, 5);
      expect(cycle.nextMode).toBe('short-break');
      expect(cycle.nextRounds).toBe(completed + 1);
    }

    // Short-break -> focus
    const breakReturn = getNextTimerCycle('short-break', 1, 5);
    expect(breakReturn.nextMode).toBe('focus');
    expect(breakReturn.nextRounds).toBe(1);

    // Round 5 focus -> long-break
    const cycle5 = getNextTimerCycle('focus', 4, 5);
    expect(cycle5.nextMode).toBe('long-break');
    expect(cycle5.nextRounds).toBe(5);

    // Long-break -> focus
    const afterLongBreak = getNextTimerCycle('long-break', 5, 5);
    expect(afterLongBreak.nextMode).toBe('focus');

    // Second cycle: rounds 6-9 -> short-break, round 10 -> long-break
    expect(getNextTimerCycle('focus', 5, 5).nextMode).toBe('short-break');
    expect(getNextTimerCycle('focus', 8, 5).nextMode).toBe('short-break');
    expect(getNextTimerCycle('focus', 9, 5).nextMode).toBe('long-break');
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

    // Default fallback when no task is linked (5-round long break cycle)
    const planNoTask = calculateTaskRoundPlan(null, 0, 0, 25);
    expect(planNoTask.totalRounds).toBe(5);
    expect(planNoTask.currentRound).toBe(1);
    expect(planNoTask.currentRoundDurationMinutes).toBe(25);
    expect(planNoTask.isTaskComplete).toBe(false);
  });

  it('calculates dynamic rounds and partial final rounds across custom focus durations', () => {
    expect(FOCUS_DURATION_PRESETS).toEqual([15, 25, 30, 45, 60, 90]);

    // 100 min task with 45 min focus: 2 x 45m + 1 x 10m
    expect(calculateTaskSessions(100, 45)).toEqual([45, 45, 10]);

    // 180 min task with 60 min focus: 3 x 60m
    expect(calculateTaskSessions(180, 60)).toEqual([60, 60, 60]);

    // 140 min task with 90 min focus: 1 x 90m + 1 x 50m
    expect(calculateTaskSessions(140, 90)).toEqual([90, 50]);

    // Task shorter than selected focus duration (e.g., 20m task with 60m focus) never exceeds task
    const shortTaskPlan = calculateTaskRoundPlan(20, 0, 0, 60);
    expect(shortTaskPlan.totalRounds).toBe(1);
    expect(shortTaskPlan.currentRoundDurationMinutes).toBe(20);
    expect(shortTaskPlan.sessions).toEqual([20]);

    // Switching focus duration mid-task adjusts remaining rounds without exceeding total
    const midTaskPlan = calculateTaskRoundPlan(100, 25, 1, 45);
    expect(midTaskPlan.totalRounds).toBe(3); // 1 completed + [45, 30]
    expect(midTaskPlan.currentRound).toBe(2);
    expect(midTaskPlan.currentRoundDurationMinutes).toBe(45);
    expect(midTaskPlan.sessions).toEqual([45, 30]);

    // Unlinked timer honors custom focus duration & longBreakInterval
    const freePlan = calculateTaskRoundPlan(null, 0, 1, 50, 3);
    expect(freePlan.totalRounds).toBe(3);
    expect(freePlan.currentRound).toBe(2);
    expect(freePlan.currentRoundDurationMinutes).toBe(50);
  });

  it('validates custom duration inputs and rejects invalid values', () => {
    expect(
      validateDurationMinutes(45, TIMER_DURATION_LIMITS.focus.min, TIMER_DURATION_LIMITS.focus.max)
    ).toEqual({ valid: true, value: 45 });

    expect(
      validateDurationMinutes('10', TIMER_DURATION_LIMITS.shortBreak.min, TIMER_DURATION_LIMITS.shortBreak.max)
    ).toEqual({ valid: true, value: 10 });

    // Reject zero, negative, decimals, non-numbers, and above-max values
    for (const invalid of [0, -5, 25.5, '', 'abc', NaN, Infinity, 181]) {
      const res = validateDurationMinutes(
        invalid,
        TIMER_DURATION_LIMITS.focus.min,
        TIMER_DURATION_LIMITS.focus.max
      );
      expect(res.valid).toBe(false);
    }

    expect(
      validateDurationMinutes(61, TIMER_DURATION_LIMITS.shortBreak.min, TIMER_DURATION_LIMITS.shortBreak.max).valid
    ).toBe(false);

    expect(
      validateDurationMinutes(90, TIMER_DURATION_LIMITS.longBreak.min, TIMER_DURATION_LIMITS.longBreak.max).valid
    ).toBe(true);
    expect(
      validateDurationMinutes(91, TIMER_DURATION_LIMITS.longBreak.min, TIMER_DURATION_LIMITS.longBreak.max).valid
    ).toBe(false);
  });

  it('preserves completed round history without reinterpreting logged minutes when focus duration changes', () => {
    // 180m task with 1 completed round of 60m, then user switches focus duration down to 15m.
    // Remaining 120m -> 8 x 15m rounds. Completed round history MUST remain 1 (NOT 60/15 = 4).
    const planAfterDecrease = calculateTaskRoundPlan(180, 60, 1, 15);
    expect(planAfterDecrease.currentRound).toBe(2);
    expect(planAfterDecrease.totalRounds).toBe(9); // 1 completed + 8 remaining
    expect(planAfterDecrease.remainingTaskMinutes).toBe(120);

    // Task completed in 2 rounds (60m + 40m = 100m), then user changes focus duration to 15m.
    // Total completed rounds MUST stay 2 (NOT recalculated as 100/15 = 7).
    const completedPlan = calculateTaskRoundPlan(100, 100, 2, 15);
    expect(completedPlan.isTaskComplete).toBe(true);
    expect(completedPlan.totalRounds).toBe(2);
    expect(completedPlan.currentRound).toBe(2);
  });
});

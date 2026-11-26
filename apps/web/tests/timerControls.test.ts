import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SettingsSchema,
  UpdateSettingsInputSchema,
  UserPreferencesSchema,
  UpdateUserMeInputSchema,
} from '@focusforge/shared';
import { useTimerStore } from '../src/stores/useTimerStore';
import { getFocusSessionService, getSettingsService } from '../src/services/serviceFactory';
import { LocalStorageAdapter } from '../src/services/storage/storageAdapter';
import { alarmService } from '../src/services/alarmService';

describe('Timer Store Controls, Dynamic Rounds, and Time Tracking', () => {
  beforeEach(async () => {
    localStorage.clear();
    useTimerStore.setState({ taskCompletedRoundsById: {} });
    const store = useTimerStore.getState();
    await store.setLinkedTask(null, null);
    await store.setMode('focus');
    await store.reset();
    await getFocusSessionService().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes in idle status with 25 minutes default and 5-round long break cycle', () => {
    const state = useTimerStore.getState();
    expect(state.mode).toBe('focus');
    expect(state.status).toBe('idle');
    expect(state.totalDurationSeconds).toBe(25 * 60);
    expect(state.remainingSeconds).toBe(25 * 60);
    expect(state.totalRounds).toBe(5);
    expect(state.longBreakInterval).toBe(5);
    expect(state.currentRound).toBe(1);
    expect(state.isTaskComplete).toBe(false);
  });

  it('starts, pauses, and resumes timer correctly without drift', () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();

    // 1. Start timer (1500 seconds total)
    store.start();
    let current = useTimerStore.getState();
    expect(current.status).toBe('running');
    expect(current.endsAt).toBe(baseNow + 1500 * 1000);

    // Advance 300 seconds (5 minutes)
    vi.advanceTimersByTime(300 * 1000);
    store.syncTick();
    expect(useTimerStore.getState().remainingSeconds).toBe(1200);

    // 2. Pause timer
    store.pause();
    current = useTimerStore.getState();
    expect(current.status).toBe('paused');
    expect(current.endsAt).toBeNull();
    expect(current.pausedRemainingSeconds).toBe(1200);
    expect(current.remainingSeconds).toBe(1200);

    // Advance 600 seconds while paused (no time should be deducted)
    vi.advanceTimersByTime(600 * 1000);
    store.syncTick();
    expect(useTimerStore.getState().remainingSeconds).toBe(1200);

    // 3. Resume timer (should resume from exactly 1200s, zero drift)
    store.resume();
    current = useTimerStore.getState();
    expect(current.status).toBe('running');
    expect(current.endsAt).toBe(Date.now() + 1200 * 1000);

    // Advance 200 seconds
    vi.advanceTimersByTime(200 * 1000);
    store.syncTick();
    expect(useTimerStore.getState().remainingSeconds).toBe(1000);
  });

  it('switches modes between focus, short-break, and long-break', async () => {
    const store = useTimerStore.getState();

    await store.setMode('short-break');
    let state = useTimerStore.getState();
    expect(state.mode).toBe('short-break');
    expect(state.totalDurationSeconds).toBe(5 * 60);
    expect(state.remainingSeconds).toBe(5 * 60);

    await store.setMode('long-break');
    state = useTimerStore.getState();
    expect(state.mode).toBe('long-break');
    expect(state.totalDurationSeconds).toBe(15 * 60);

    await store.setMode('focus');
    state = useTimerStore.getState();
    expect(state.mode).toBe('focus');
    expect(state.totalDurationSeconds).toBe(25 * 60);
  });

  it('dynamically configures 8 rounds for a 180-minute task (7 x 25m + 1 x 5m)', async () => {
    const store = useTimerStore.getState();

    // Link a 180-minute task with 0 minutes initially logged
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    const state = useTimerStore.getState();
    expect(state.taskId).toBe('task-180');
    expect(state.taskTitle).toBe('Physics Problem Set');
    expect(state.subject).toBe('Physics');
    expect(state.taskTotalDurationMinutes).toBe(180);
    expect(state.taskFocusMinutesLogged).toBe(0);
    expect(state.totalRounds).toBe(8);
    expect(state.currentRound).toBe(1);
    expect(state.totalDurationSeconds).toBe(25 * 60);
    expect(state.remainingSeconds).toBe(25 * 60);
    expect(state.isTaskComplete).toBe(false);
  });

  it('completes 1 full 25-minute session and records focus time accurately', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    await store.start();
    expect(useTimerStore.getState().status).toBe('running');

    // Advance through 25 minutes + 1s to finish
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    await store.syncTick();

    const after = useTimerStore.getState();
    expect(after.status).toBe('idle');
    expect(after.mode).toBe('short-break');
    expect(after.completedRounds).toBe(1);
    expect(after.currentRound).toBe(2);
    expect(after.totalRounds).toBe(8);
    expect(after.taskFocusMinutesLogged).toBe(25);

    // Verify session was recorded in database / storage
    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(25);
    expect(sessions[0].taskId).toBe('task-180');
    expect(sessions[0].mode).toBe('focus');
  });

  it('completes multiple sessions and accumulates focus time', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    // Round 1 focus
    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    await store.syncTick();
    expect(useTimerStore.getState().taskFocusMinutesLogged).toBe(25);
    expect(useTimerStore.getState().mode).toBe('short-break');

    // Skip / complete break (break time is not focus time)
    await store.skip();
    expect(useTimerStore.getState().mode).toBe('focus');
    expect(useTimerStore.getState().currentRound).toBe(2);

    // Round 2 focus
    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    await store.syncTick();

    const afterR2 = useTimerStore.getState();
    expect(afterR2.taskFocusMinutesLogged).toBe(50);
    expect(afterR2.completedRounds).toBe(2);

    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(2);
    const totalRecorded = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    expect(totalRecorded).toBe(50);
  });

  it('skips session after 12 minutes and records exactly 12 minutes of focus', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    await store.start();
    // Advance 12 minutes exactly
    vi.advanceTimersByTime(12 * 60 * 1000);

    await store.skip();

    const state = useTimerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.mode).toBe('short-break');
    expect(state.taskFocusMinutesLogged).toBe(12);
    // Partial focus skip must record focus minutes without counting as a completed round
    expect(state.completedRounds).toBe(0);
    expect(state.currentRound).toBe(1);
    expect(state.taskCompletedRoundsById['task-180']).toBe(0);

    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(12);
    expect(sessions[0].taskId).toBe('task-180');
  });

  it('skips immediately and records 0 minutes without duplicate or invalid records', async () => {
    vi.useFakeTimers();
    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    await store.start();
    // Skip immediately with 0 elapsed seconds
    await store.skip();

    const state = useTimerStore.getState();
    expect(state.taskFocusMinutesLogged).toBe(0);
    expect(state.mode).toBe('short-break');
    expect(state.completedRounds).toBe(0);
    expect(state.currentRound).toBe(1);
    expect(state.taskCompletedRoundsById['task-180']).toBe(0);

    // No session should be recorded for 0 minutes
    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(0);
  });

  it('persists and restores active session across page reload without drift', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);
    await store.start();

    // Advance 400 seconds (6m 40s)
    vi.advanceTimersByTime(400 * 1000);

    // Simulating page reload: read from localStorage and re-initialize
    await store.initialize();

    const reloaded = useTimerStore.getState();
    expect(reloaded.status).toBe('running');
    expect(reloaded.mode).toBe('focus');
    expect(reloaded.taskId).toBe('task-180');
    expect(reloaded.totalRounds).toBe(8);
    expect(reloaded.remainingSeconds).toBe(1500 - 400); // 1100s remaining
  });

  it('completes the final 5-minute session and marks task complete without exceeding duration', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    // 175 minutes already logged on a 180-minute task -> 5 minutes remaining
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 175);

    const initial = useTimerStore.getState();
    expect(initial.totalRounds).toBe(8);
    expect(initial.currentRound).toBe(8);
    expect(initial.totalDurationSeconds).toBe(5 * 60); // Final 5-minute session
    expect(initial.remainingSeconds).toBe(5 * 60);
    expect(initial.isTaskComplete).toBe(false);

    // Start and complete the final 5 minutes
    await store.start();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);
    await store.syncTick();

    const completedState = useTimerStore.getState();
    expect(completedState.taskFocusMinutesLogged).toBe(180);
    expect(completedState.isTaskComplete).toBe(true);
    expect(completedState.remainingSeconds).toBe(0);

    // Check recorded session: exactly 5 minutes
    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(5);

    // Starting again when task is complete does not start focus
    await store.start();
    expect(useTimerStore.getState().status).toBe('idle');
  });

  it('prevents duplicate session recording when multiple syncTicks trigger concurrently', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-180', 'Physics Problem Set', 'Physics', 180, 0);

    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);

    // Trigger multiple syncTicks concurrently
    await Promise.all([store.syncTick(), store.syncTick(), store.syncTick()]);

    const sessions = await getFocusSessionService().list();
    // Must be recorded exactly once
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(25);
    expect(useTimerStore.getState().taskFocusMinutesLogged).toBe(25);
  });

  it('supports custom focus and break durations, recalculates idle rounds, and rejects invalid inputs', async () => {
    const store = useTimerStore.getState();

    // Update to custom 45m focus and 10m break
    await store.setCustomDurations({ focusDuration: 45, shortBreakDuration: 10 });

    let state = useTimerStore.getState();
    expect(state.focusDuration).toBe(45);
    expect(state.shortBreakDuration).toBe(10);
    expect(state.totalDurationSeconds).toBe(45 * 60);
    expect(state.remainingSeconds).toBe(45 * 60);

    // Link a 100-minute task -> dynamically produces [45, 45, 10] = 3 rounds
    await store.setLinkedTask('task-100', 'Essay Draft', 'Writing', 100, 0);
    state = useTimerStore.getState();
    expect(state.totalRounds).toBe(3);
    expect(state.currentRound).toBe(1);
    expect(state.totalDurationSeconds).toBe(45 * 60);

    // Switching to short-break uses custom 10m break
    await store.setMode('short-break');
    state = useTimerStore.getState();
    expect(state.totalDurationSeconds).toBe(10 * 60);
    expect(state.remainingSeconds).toBe(10 * 60);

    // Invalid durations reject without modifying persisted settings or state
    await expect(store.setCustomDurations({ focusDuration: 0 })).rejects.toThrow();
    await expect(store.setCustomDurations({ focusDuration: 200 })).rejects.toThrow();
    await expect(store.setCustomDurations({ shortBreakDuration: -5 })).rejects.toThrow();
    await expect(store.setCustomDurations({ focusDuration: 12.5 })).rejects.toThrow();

    const savedSettings = await getSettingsService().get();
    expect(savedSettings.focusDuration).toBe(45);
    expect(savedSettings.shortBreakDuration).toBe(10);
  });

  it('does not alter an already-running or paused timer when settings change, and applies new settings to the next session', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    const playSpy = vi.spyOn(alarmService, 'play').mockImplementation(async () => {});

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 30, shortBreakDuration: 5 });
    await store.setLinkedTask('task-90', 'Algorithms', 'CS', 90, 0);

    // Start 30-minute focus session
    await store.start();
    const runningEndsAt = useTimerStore.getState().endsAt;
    expect(useTimerStore.getState().totalDurationSeconds).toBe(30 * 60);

    // Advance 10 minutes
    vi.advanceTimersByTime(10 * 60 * 1000);
    await store.syncTick();
    expect(useTimerStore.getState().remainingSeconds).toBe(20 * 60);

    // User changes focus duration to 45m and break duration to 12m while running
    await store.setCustomDurations({ focusDuration: 45, shortBreakDuration: 12 });

    // Running timer must remain completely unchanged
    let duringRun = useTimerStore.getState();
    expect(duringRun.status).toBe('running');
    expect(duringRun.totalDurationSeconds).toBe(30 * 60);
    expect(duringRun.endsAt).toBe(runningEndsAt);
    expect(duringRun.remainingSeconds).toBe(20 * 60);
    expect(duringRun.focusDuration).toBe(45);
    expect(duringRun.shortBreakDuration).toBe(12);

    // Pause, change break duration again to 15m, and resume -> paused timer stays untouched
    store.pause();
    await store.setCustomDurations({ shortBreakDuration: 15 });
    expect(useTimerStore.getState().status).toBe('paused');
    expect(useTimerStore.getState().pausedRemainingSeconds).toBe(20 * 60);

    await store.resume();
    vi.advanceTimersByTime(20 * 60 * 1000 + 1000);
    await store.syncTick();

    // Completed session logs original 30m, triggers alarm, and schedules next break with NEW 15m duration!
    const afterFocus = useTimerStore.getState();
    expect(afterFocus.mode).toBe('short-break');
    expect(afterFocus.totalDurationSeconds).toBe(15 * 60);
    expect(afterFocus.taskFocusMinutesLogged).toBe(30);
    expect(afterFocus.isAlarmActive).toBe(true);
    expect(afterFocus.alarmPeriodName).toBe('Algorithms (Focus Session)');
    expect(playSpy).toHaveBeenCalledTimes(1);

    const sessions = await getFocusSessionService().list();
    expect(sessions[0].durationMinutes).toBe(30);

    // Dismiss alarm, skip break -> next focus session uses NEW 45m duration (60m remaining on 90m task -> [45, 15])
    store.pauseAlarm();
    await store.skip();
    const nextFocus = useTimerStore.getState();
    expect(nextFocus.mode).toBe('focus');
    expect(nextFocus.totalDurationSeconds).toBe(45 * 60);
    expect(nextFocus.totalRounds).toBe(3); // 1 completed + [45, 15]
  });

  it('completes partial final round with custom duration, never exceeds task total, and schedules no break after final round', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    const playSpy = vi.spyOn(alarmService, 'play').mockImplementation(async () => {});

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 60, shortBreakDuration: 10 });
    // 100m task -> [60, 40]. Simulate 60m already logged -> final round is 40m
    await store.setLinkedTask('task-100', 'Chemistry Lab', 'Chemistry', 100, 60);

    const beforeFinal = useTimerStore.getState();
    expect(beforeFinal.totalRounds).toBe(2);
    expect(beforeFinal.currentRound).toBe(2);
    expect(beforeFinal.totalDurationSeconds).toBe(40 * 60);

    await store.start();
    vi.advanceTimersByTime(40 * 60 * 1000 + 1000);
    await store.syncTick();

    const afterFinal = useTimerStore.getState();
    expect(afterFinal.isTaskComplete).toBe(true);
    expect(afterFinal.taskFocusMinutesLogged).toBe(100);
    // Must NOT schedule a break after the final round
    expect(afterFinal.mode).toBe('focus');
    expect(afterFinal.totalDurationSeconds).toBe(0);
    expect(afterFinal.remainingSeconds).toBe(0);
    expect(afterFinal.isAlarmActive).toBe(true);
    expect(playSpy).toHaveBeenCalledTimes(1);

    const sessions = await getFocusSessionService().list();
    expect(sessions.length).toBe(1);
    expect(sessions[0].durationMinutes).toBe(40);
  });

  it('persists custom-duration running session across pause, resume, and initialize reload', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 90, shortBreakDuration: 20 });
    expect(useTimerStore.getState().totalDurationSeconds).toBe(90 * 60);

    await store.start();
    vi.advanceTimersByTime(15 * 60 * 1000); // 75m remaining
    store.pause();
    expect(useTimerStore.getState().remainingSeconds).toBe(75 * 60);

    // Reload while paused
    await store.initialize();
    expect(useTimerStore.getState().status).toBe('paused');
    expect(useTimerStore.getState().remainingSeconds).toBe(75 * 60);
    expect(useTimerStore.getState().focusDuration).toBe(90);

    await store.resume();
    vi.advanceTimersByTime(10 * 60 * 1000);
    // Reload while running
    await store.initialize();
    expect(useTimerStore.getState().status).toBe('running');
    expect(useTimerStore.getState().remainingSeconds).toBe(65 * 60);
  });

  it('preserves completed round history when focus duration changes midway through a linked task', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 50, shortBreakDuration: 5 });
    await store.setLinkedTask('task-100', 'Biology Lab', 'Biology', 100, 0);

    // Complete Round 1 (50m)
    await store.start();
    vi.advanceTimersByTime(50 * 60 * 1000 + 1000);
    await store.syncTick();

    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskFocusMinutesLogged).toBe(50);

    // Skip break to return to Round 2 focus
    await store.skip();
    expect(useTimerStore.getState().mode).toBe('focus');
    expect(useTimerStore.getState().currentRound).toBe(2);

    // Lower focus duration from 50m to 20m midway through the task
    await store.setCustomDurations({ focusDuration: 20 });

    const afterChange = useTimerStore.getState();
    // Completed round history stays 1; remaining 50m becomes [20, 20, 10] -> totalRounds = 1 + 3 = 4
    expect(afterChange.completedRounds).toBe(1);
    expect(afterChange.currentRound).toBe(2);
    expect(afterChange.totalRounds).toBe(4);
    expect(afterChange.totalDurationSeconds).toBe(20 * 60);

    // Complete remaining 3 rounds: 20m + 20m + 10m -> total 100m, never exceeded
    for (const expectedMinutes of [20, 20, 10]) {
      expect(useTimerStore.getState().totalDurationSeconds).toBe(expectedMinutes * 60);
      await store.start();
      vi.advanceTimersByTime(expectedMinutes * 60 * 1000 + 1000);
      await store.syncTick();
      if (!useTimerStore.getState().isTaskComplete) {
        await store.skip(); // skip break
      }
    }

    const finalState = useTimerStore.getState();
    expect(finalState.isTaskComplete).toBe(true);
    expect(finalState.taskFocusMinutesLogged).toBe(100);
    expect(finalState.completedRounds).toBe(4);
    expect(finalState.totalRounds).toBe(4);
    expect(finalState.mode).toBe('focus'); // no break after final round
  });

  it('enforces fixed 5-round cycle (short break after rounds 1-4, long break after round 5, repeating) and resets defaults cleanly', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();
    await store.setCustomDurations({
      focusDuration: 20,
      shortBreakDuration: 7,
      longBreakDuration: 30,
    });

    // Reject invalid longBreakDuration values
    await expect(store.setCustomDurations({ longBreakDuration: 0 })).rejects.toThrow();
    await expect(store.setCustomDurations({ longBreakDuration: 91 })).rejects.toThrow();

    // Even if legacy persisted settings contain longBreakInterval: 4, store keeps interval fixed at 5
    await getSettingsService().update({ longBreakInterval: 4 });
    await store.initialize();
    let state = useTimerStore.getState();
    expect(state.focusDuration).toBe(20);
    expect(state.shortBreakDuration).toBe(7);
    expect(state.longBreakDuration).toBe(30);
    expect(state.longBreakInterval).toBe(5);
    expect(state.totalRounds).toBe(5);

    // Run 2 complete 5-round cycles (10 rounds total)
    for (let round = 1; round <= 10; round++) {
      expect(useTimerStore.getState().mode).toBe('focus');
      expect(useTimerStore.getState().currentRound).toBe(((round - 1) % 5) + 1);

      await store.start();
      vi.advanceTimersByTime(20 * 60 * 1000 + 1000);
      await store.syncTick();

      const afterRound = useTimerStore.getState();
      expect(afterRound.completedRounds).toBe(round);

      if (round % 5 === 0) {
        // 5th and 10th rounds trigger Long Break
        expect(afterRound.mode).toBe('long-break');
        expect(afterRound.totalDurationSeconds).toBe(30 * 60);
      } else {
        // Rounds 1-4 and 6-9 trigger Short Break
        expect(afterRound.mode).toBe('short-break');
        expect(afterRound.totalDurationSeconds).toBe(7 * 60);
      }

      // Advance past break to start next focus round
      await store.skip();
    }

    // Back to round 1 of next cycle
    expect(useTimerStore.getState().mode).toBe('focus');
    expect(useTimerStore.getState().currentRound).toBe(1);

    // Reset defaults restores 25 / 5 / 15 and interval 5
    await store.resetDefaults();
    state = useTimerStore.getState();
    expect(state.focusDuration).toBe(25);
    expect(state.shortBreakDuration).toBe(5);
    expect(state.longBreakDuration).toBe(15);
    expect(state.longBreakInterval).toBe(5);
    expect(state.totalDurationSeconds).toBe(25 * 60);

    const saved = await getSettingsService().get();
    expect(saved.focusDuration).toBe(25);
    expect(saved.shortBreakDuration).toBe(5);
    expect(saved.longBreakDuration).toBe(15);
    expect(saved.longBreakInterval).toBe(5);
  });

  it('normalizes legacy saved longBreakInterval values (4, 2, 0, 99) and persisted totalRounds: 4 to fixed 5', async () => {
    // 1. Shared settings and auth schemas always normalize longBreakInterval to 5, including legacy values
    const normalizedFull = SettingsSchema.parse({
      theme: 'dark',
      focusDuration: 30,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
    });
    expect(normalizedFull.longBreakInterval).toBe(5);
    expect(SettingsSchema.parse({ longBreakInterval: 0 }).longBreakInterval).toBe(5);
    expect(UserPreferencesSchema.parse({ longBreakInterval: 4 }).longBreakInterval).toBe(5);
    expect(UserPreferencesSchema.parse({ longBreakInterval: 15 }).longBreakInterval).toBe(5);

    const normalizedPatch = UpdateSettingsInputSchema.parse({ longBreakInterval: 2 });
    expect(normalizedPatch.longBreakInterval).toBe(5);
    expect(UpdateSettingsInputSchema.parse({ longBreakInterval: 0 }).longBreakInterval).toBe(5);
    expect(
      UpdateUserMeInputSchema.parse({ preferences: { longBreakInterval: 4 } }).preferences
        ?.longBreakInterval
    ).toBe(5);

    // 2. Old persisted localStorage settings with longBreakInterval: 4 normalize safely on read & update
    LocalStorageAdapter.setItem(LocalStorageAdapter.settingsKey, {
      ...normalizedFull,
      longBreakInterval: 4,
    });
    const loadedSettings = await getSettingsService().get();
    expect(loadedSettings.longBreakInterval).toBe(5);
    expect(loadedSettings.focusDuration).toBe(30);

    // 3. Old persisted timer state with totalRounds: 4 is forced to 5 on initialize (both idle and running)
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'running',
        endsAt: Date.now() + 100000,
        startedAt: new Date().toISOString(),
        totalDurationSeconds: 30 * 60,
        pausedRemainingSeconds: 30 * 60,
        completedRounds: 3,
        subject: 'Math',
        taskId: null,
        taskTitle: null,
        taskTotalDurationMinutes: null,
        taskFocusMinutesLogged: 0,
        currentRound: 4,
        totalRounds: 4,
        isTaskComplete: false,
        clientSessionId: 'legacy-1',
      })
    );

    await useTimerStore.getState().initialize();
    const state = useTimerStore.getState();
    expect(state.longBreakInterval).toBe(5);
    expect(state.totalRounds).toBe(5);
    expect(state.currentRound).toBe(4);
  });

  it('does not inflate completed rounds from partial or skipped focus sessions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 25 });
    await store.setLinkedTask('task-skip', 'History Essay', 'History', 100, 0);

    // User runs 3 partial focus sessions (2m, 3m, 1m = 6m total logged) and skips each early
    for (const mins of [2, 3, 1]) {
      await store.start();
      vi.advanceTimersByTime(mins * 60 * 1000);
      await store.skip();
      expect(useTimerStore.getState().completedRounds).toBe(0);
      expect(useTimerStore.getState().taskCompletedRoundsById['task-skip']).toBe(0);
      expect(useTimerStore.getState().mode).toBe('short-break');
      await store.setMode('focus');
    }

    // Relinking task-skip with 6m logged across 3 skipped FocusSession records MUST yield 0 completed rounds (not 3!)
    await store.setLinkedTask(null, null);
    await store.setLinkedTask('task-skip', 'History Essay', 'History', 100, 6);

    const relinked = useTimerStore.getState();
    expect(relinked.completedRounds).toBe(0);
    expect(relinked.currentRound).toBe(1);
    expect(relinked.totalRounds).toBe(4); // remaining 94m at 25m/round -> [25, 25, 25, 19]
  });

  it('keeps skipped rounds out of reliable history and does not advance the 5-round long-break cycle', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();

    // Unlinked timer: 5 consecutive partial focus skips must NOT advance completedRounds or trigger long-break
    for (let i = 0; i < 5; i++) {
      await store.start();
      vi.advanceTimersByTime(2 * 60 * 1000);
      await store.skip();
      const afterSkip = useTimerStore.getState();
      expect(afterSkip.completedRounds).toBe(0);
      expect(afterSkip.currentRound).toBe(1);
      expect(afterSkip.mode).toBe('short-break');
      await store.setMode('focus');
    }

    // Complete 5 genuine focus rounds -> round 5 triggers long-break
    for (let round = 1; round <= 5; round++) {
      await store.start();
      vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
      await store.syncTick();
      store.pauseAlarm();
      if (round < 5) {
        expect(useTimerStore.getState().mode).toBe('short-break');
        await store.skip();
      } else {
        expect(useTimerStore.getState().mode).toBe('long-break');
      }
    }
    expect(useTimerStore.getState().completedRounds).toBe(5);
    await store.skip(); // finish long break -> round 1 of cycle 2

    // Partial skip at completedRounds=5 (a multiple of 5) must NOT repeat long-break or advance to 6
    await store.start();
    vi.advanceTimersByTime(3 * 60 * 1000);
    await store.skip();
    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().mode).toBe('short-break');

    // Linked task: partial skip followed by full syncTick completion counts only 1 reliable round across relink
    await store.setLinkedTask('task-leak-check', 'Calculus', 'Math', 100, 0);
    await store.start();
    await store.skip(); // 0m skip
    expect(useTimerStore.getState().completedRounds).toBe(0);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-leak-check']).toBe(0);

    await store.setMode('focus');
    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    await store.syncTick();
    store.pauseAlarm();

    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-leak-check']).toBe(1);

    await store.setLinkedTask('task-other', 'Other', 'Art', 50, 0);
    await store.setLinkedTask('task-leak-check', 'Calculus', 'Math', 100, 25);
    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-leak-check']).toBe(1);
  });

  it('seeds reliable task history on link, honors overrides without regressing history, and increments on full-round skip', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 25, shortBreakDuration: 5 });

    // Link pre-logged task with 100m logged (4 rounds) and no prior entry in taskCompletedRoundsById
    await store.setLinkedTask('task-prelogged', 'Linear Algebra', 'Math', 150, 100);
    expect(useTimerStore.getState().completedRounds).toBe(4);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-prelogged']).toBe(4);

    // Run 5th round to full duration and let skip() handle completion
    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000);
    await store.skip();

    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-prelogged']).toBe(5);
    expect(useTimerStore.getState().mode).toBe('long-break');

    // Switch away and back -> must restore 5 reliable rounds (not reset to 1!)
    await store.setLinkedTask('task-B', 'Side Task', 'History', 50, 0);
    await store.setLinkedTask('task-prelogged', 'Linear Algebra', 'Math', 150, 125);
    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-prelogged']).toBe(5);

    // Lower override respects session override while never overwriting reliable history with lower value
    await store.setLinkedTask('task-prelogged', 'Linear Algebra', 'Math', 150, 125, 2);
    expect(useTimerStore.getState().completedRounds).toBe(2);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-prelogged']).toBe(5);

    // Higher explicit override seeds/updates reliable history
    await store.setLinkedTask('task-override', 'Override Task', 'Physics', 200, 75, 3);
    expect(useTimerStore.getState().completedRounds).toBe(3);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-override']).toBe(3);
  });

  it('uses latest settings changed while session creation is pending in syncTick() and skip()', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);
    vi.spyOn(alarmService, 'play').mockImplementation(async () => {});

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 25, shortBreakDuration: 5 });

    // 1. Deferred create() during syncTick()
    let resolveSyncCreate!: () => void;
    const sessionService = getFocusSessionService();
    const originalCreate = sessionService.create.bind(sessionService);
    const syncCreateSpy = vi.spyOn(sessionService, 'create').mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => {
        resolveSyncCreate = resolve;
      });
      return originalCreate(input);
    });

    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    const tickPromise = store.syncTick();

    // Wait a microtask until create() is pending, then update shortBreakDuration 5 -> 12
    await Promise.resolve();
    await store.setCustomDurations({ shortBreakDuration: 12 });

    resolveSyncCreate();
    await tickPromise;
    expect(syncCreateSpy).toHaveBeenCalledTimes(1);

    let state = useTimerStore.getState();
    expect(state.shortBreakDuration).toBe(12);
    expect(state.mode).toBe('short-break');
    expect(state.totalDurationSeconds).toBe(12 * 60);
    expect(state.remainingSeconds).toBe(12 * 60);

    // Reset short break back to 5m for the skip() race test
    store.pauseAlarm();
    await store.setCustomDurations({ shortBreakDuration: 5 });
    await store.setMode('focus');

    // 2. Deferred create() during skip()
    let resolveSkipCreate!: () => void;
    vi.spyOn(sessionService, 'create').mockImplementationOnce(async (input) => {
      await new Promise<void>((resolve) => {
        resolveSkipCreate = resolve;
      });
      return originalCreate(input);
    });

    await store.start();
    vi.advanceTimersByTime(5 * 60 * 1000);
    const skipPromise = store.skip();

    await Promise.resolve();
    await store.setCustomDurations({ shortBreakDuration: 12 });

    resolveSkipCreate();
    await skipPromise;

    state = useTimerStore.getState();
    expect(state.shortBreakDuration).toBe(12);
    expect(state.mode).toBe('short-break');
    expect(state.totalDurationSeconds).toBe(12 * 60);
    expect(state.remainingSeconds).toBe(12 * 60);
  });

  it('preserves task-specific round plans and reliable completed rounds when relinking tasks across duration changes', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1700000000000);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 60 });
    await store.setLinkedTask('task-A', 'Organic Chemistry', 'Chemistry', 180, 0);

    // Complete 1 full 60m round on task-A via syncTick
    await store.start();
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    await store.syncTick();
    store.pauseAlarm();

    expect(useTimerStore.getState().taskCompletedRoundsById['task-A']).toBe(1);
    expect(useTimerStore.getState().completedRounds).toBe(1);

    // Switch to task-B (different task) and change focus duration downward to 15m
    await store.setLinkedTask('task-B', 'Quick Drill', 'Math', 30, 0);
    expect(useTimerStore.getState().completedRounds).toBe(0);
    await store.setCustomDurations({ focusDuration: 15 });

    // Relink task-A with 60m logged: must restore reliable completedRounds = 1 (NOT Math.floor(60/15) = 4!)
    await store.setLinkedTask('task-A', 'Organic Chemistry', 'Chemistry', 180, 60);

    let state = useTimerStore.getState();
    expect(state.completedRounds).toBe(1);
    expect(state.currentRound).toBe(2);
    expect(state.totalRounds).toBe(9); // 1 completed + 8 x 15m remaining (120m)

    // Change focus duration again to 10m and relink task-A: still preserves completedRounds = 1
    await store.setCustomDurations({ focusDuration: 10 });
    await store.setLinkedTask('task-A', 'Organic Chemistry', 'Chemistry', 180, 60);

    state = useTimerStore.getState();
    expect(state.completedRounds).toBe(1);
    expect(state.currentRound).toBe(2);
    expect(state.totalRounds).toBe(13); // 1 completed + 12 x 10m remaining (120m)
  });

  it('migrates legacy running task baseline safely without reintroducing partial skips and preserves history across syncTick and relink', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    vi.spyOn(alarmService, 'play').mockImplementation(async () => {});

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 25, shortBreakDuration: 5 });

    const startedAtRunning = new Date(baseNow).toISOString();
    const endsAtRunning = baseNow + 25 * 60 * 1000;

    // 1. Legacy running task without taskCompletedRoundsById (completedRounds=4 backed by 100m logged)
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'running',
        endsAt: endsAtRunning,
        startedAt: startedAtRunning,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 25 * 60,
        completedRounds: 4,
        subject: 'Math',
        taskId: 'task-legacy',
        taskTitle: 'Legacy Calculus',
        taskTotalDurationMinutes: 150,
        taskFocusMinutesLogged: 100,
        currentRound: 5,
        totalRounds: 6,
        isTaskComplete: false,
        clientSessionId: 'legacy-running-1',
      })
    );

    await store.initialize();
    let migrated = useTimerStore.getState();
    expect(migrated.completedRounds).toBe(4);
    expect(migrated.taskCompletedRoundsById['task-legacy']).toBe(4);
    expect(migrated.currentRound).toBe(5);
    expect(migrated.totalRounds).toBe(6);
    // Active countdown fields remain untouched
    expect(migrated.endsAt).toBe(endsAtRunning);
    expect(migrated.startedAt).toBe(startedAtRunning);
    expect(migrated.totalDurationSeconds).toBe(25 * 60);
    expect(migrated.pausedRemainingSeconds).toBe(25 * 60);
    expect(migrated.remainingSeconds).toBe(25 * 60);

    // Complete round 5 via syncTick without calling setLinkedTask() -> must record 5 and schedule long-break
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);
    await store.syncTick();
    store.pauseAlarm();

    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-legacy']).toBe(5);
    expect(useTimerStore.getState().mode).toBe('long-break');

    // Switch task-legacy -> task-B -> task-legacy: preserves 5
    await store.setLinkedTask('task-B', 'Side Task', 'History', 50, 0);
    await store.setLinkedTask('task-legacy', 'Legacy Calculus', 'Math', 150, 125);
    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-legacy']).toBe(5);

    // 2. Legacy running state inflated by partial skips (completedRounds=4, only 6m logged at 25m focusDuration)
    const inflatedStartedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const inflatedEndsAt = Date.now() + 15 * 60 * 1000;
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'running',
        endsAt: inflatedEndsAt,
        startedAt: inflatedStartedAt,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 25 * 60,
        completedRounds: 4,
        subject: 'Physics',
        taskId: 'task-legacy-inflated',
        taskTitle: 'Legacy Inflated',
        taskTotalDurationMinutes: 100,
        taskFocusMinutesLogged: 6,
        currentRound: 5,
        totalRounds: 8,
        isTaskComplete: false,
        clientSessionId: 'legacy-inflated-1',
      })
    );

    await store.initialize();
    migrated = useTimerStore.getState();
    expect(migrated.taskCompletedRoundsById['task-legacy-inflated']).toBe(0);
    expect(migrated.completedRounds).toBe(0);
    expect(migrated.currentRound).toBe(1);
    expect(migrated.totalRounds).toBe(4); // 94m remaining at 25m -> [25, 25, 25, 19]
    // Active countdown fields remain untouched
    expect(migrated.endsAt).toBe(inflatedEndsAt);
    expect(migrated.startedAt).toBe(inflatedStartedAt);
    expect(migrated.totalDurationSeconds).toBe(25 * 60);
    expect(migrated.pausedRemainingSeconds).toBe(25 * 60);
    expect(migrated.remainingSeconds).toBe(15 * 60);

    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    await store.syncTick();
    store.pauseAlarm();
    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-legacy-inflated']).toBe(1);
    expect(useTimerStore.getState().mode).toBe('short-break'); // must NOT trigger long-break

    // 3. Legacy idle restoration (both backed 100m and inflated 6m)
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'idle',
        endsAt: null,
        startedAt: null,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 25 * 60,
        completedRounds: 4,
        subject: 'Math',
        taskId: 'task-idle-inflated',
        taskTitle: 'Idle Inflated',
        taskTotalDurationMinutes: 100,
        taskFocusMinutesLogged: 6,
        currentRound: 5,
        totalRounds: 8,
        isTaskComplete: false,
        clientSessionId: null,
      })
    );
    await store.initialize();
    expect(useTimerStore.getState().completedRounds).toBe(0);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-idle-inflated']).toBe(0);
    expect(useTimerStore.getState().currentRound).toBe(1);

    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'idle',
        endsAt: null,
        startedAt: null,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 25 * 60,
        completedRounds: 4,
        subject: 'Math',
        taskId: 'task-idle-backed',
        taskTitle: 'Idle Backed',
        taskTotalDurationMinutes: 150,
        taskFocusMinutesLogged: 100,
        currentRound: 5,
        totalRounds: 6,
        isTaskComplete: false,
        clientSessionId: null,
      })
    );
    await store.initialize();
    expect(useTimerStore.getState().completedRounds).toBe(4);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-idle-backed']).toBe(4);
    expect(useTimerStore.getState().currentRound).toBe(5);
  });

  it('migrates legacy paused task baseline safely through resume and full-duration skip()', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setCustomDurations({ focusDuration: 25, shortBreakDuration: 5 });

    const pausedStartedAt = new Date(baseNow).toISOString();

    // 1. Legacy paused task backed by 100m logged -> baseline 4, next skip() yields 5 + long-break
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'paused',
        endsAt: null,
        startedAt: pausedStartedAt,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 18 * 60,
        completedRounds: 4,
        subject: 'Chemistry',
        taskId: 'task-legacy-paused',
        taskTitle: 'Legacy Paused Task',
        taskTotalDurationMinutes: 150,
        taskFocusMinutesLogged: 100,
        currentRound: 5,
        totalRounds: 6,
        isTaskComplete: false,
        clientSessionId: 'legacy-paused-1',
      })
    );

    await store.initialize();
    let restored = useTimerStore.getState();
    expect(restored.status).toBe('paused');
    expect(restored.completedRounds).toBe(4);
    expect(restored.taskCompletedRoundsById['task-legacy-paused']).toBe(4);
    expect(restored.pausedRemainingSeconds).toBe(18 * 60);
    expect(restored.remainingSeconds).toBe(18 * 60);
    expect(restored.totalDurationSeconds).toBe(25 * 60);
    expect(restored.startedAt).toBe(pausedStartedAt);

    // Resume and finish round 5 via full-duration skip() -> must produce 5 (not 1) and long-break
    await store.resume();
    vi.advanceTimersByTime(18 * 60 * 1000);
    await store.skip();

    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-legacy-paused']).toBe(5);
    expect(useTimerStore.getState().mode).toBe('long-break');

    // Switch task-legacy-paused -> task-B -> task-legacy-paused: preserves 5
    await store.setLinkedTask('task-B', 'Side Task', 'History', 50, 0);
    await store.setLinkedTask('task-legacy-paused', 'Legacy Paused Task', 'Chemistry', 150, 125);
    expect(useTimerStore.getState().completedRounds).toBe(5);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-legacy-paused']).toBe(5);

    // 2. Legacy paused task with completedRounds=4 and only 6m logged -> reconciled to 0, full skip -> 1 (short-break)
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'paused',
        endsAt: null,
        startedAt: pausedStartedAt,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 20 * 60,
        completedRounds: 4,
        subject: 'Chemistry',
        taskId: 'task-paused-inflated',
        taskTitle: 'Paused Inflated Task',
        taskTotalDurationMinutes: 100,
        taskFocusMinutesLogged: 6,
        currentRound: 5,
        totalRounds: 8,
        isTaskComplete: false,
        clientSessionId: 'legacy-paused-inflated',
      })
    );

    await store.initialize();
    restored = useTimerStore.getState();
    expect(restored.completedRounds).toBe(0);
    expect(restored.taskCompletedRoundsById['task-paused-inflated']).toBe(0);
    expect(restored.pausedRemainingSeconds).toBe(20 * 60);
    expect(restored.remainingSeconds).toBe(20 * 60);

    await store.resume();
    vi.advanceTimersByTime(20 * 60 * 1000);
    await store.skip();
    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-paused-inflated']).toBe(1);
    expect(useTimerStore.getState().mode).toBe('short-break');

    // 3. Existing authoritative reliable map entries (including explicit 0) are preserved over completedRounds/logged
    localStorage.setItem(
      'focusforge_v1_timer_state',
      JSON.stringify({
        mode: 'focus',
        status: 'paused',
        endsAt: null,
        startedAt: pausedStartedAt,
        totalDurationSeconds: 25 * 60,
        pausedRemainingSeconds: 25 * 60,
        completedRounds: 4,
        subject: 'Chemistry',
        taskId: 'task-explicit-zero',
        taskTitle: 'Explicit Zero History',
        taskTotalDurationMinutes: 150,
        taskFocusMinutesLogged: 100,
        currentRound: 1,
        totalRounds: 6,
        isTaskComplete: false,
        clientSessionId: 'explicit-zero-1',
        taskCompletedRoundsById: { 'task-explicit-zero': 0 },
      })
    );
    await store.initialize();
    expect(useTimerStore.getState().taskCompletedRoundsById['task-explicit-zero']).toBe(0);

    useTimerStore.setState({
      taskId: 'task-authoritative',
      completedRounds: 4,
      taskFocusMinutesLogged: 100,
      taskCompletedRoundsById: { 'task-authoritative': 2 },
      totalDurationSeconds: 25 * 60,
      pausedRemainingSeconds: 0,
      mode: 'focus',
      status: 'paused',
    });
    await store.skip();
    expect(useTimerStore.getState().completedRounds).toBe(3);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-authoritative']).toBe(3);
  });

  it('preserves concurrently completed task-A history when setLinkedTask(task-B) is awaiting settings', async () => {
    vi.useFakeTimers();
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    vi.spyOn(alarmService, 'play').mockImplementation(async () => {});

    const store = useTimerStore.getState();
    await store.setLinkedTask('task-A', 'Organic Chemistry', 'Chemistry', 150, 0);
    await store.start();
    vi.advanceTimersByTime(25 * 60 * 1000 + 1000);

    // Defer getSettingsService().get() inside setLinkedTask('task-B')
    const settingsService = getSettingsService();
    const originalGet = settingsService.get.bind(settingsService);
    let resolveLinkSettings!: () => void;
    const settingsSpy = vi.spyOn(settingsService, 'get').mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        resolveLinkSettings = resolve;
      });
      return originalGet();
    });

    // Start linking task-B (now suspended awaiting settings with pre-await history { task-A: 0 })
    const linkPromise = store.setLinkedTask('task-B', 'Side Task', 'History', 50, 0);
    await Promise.resolve();
    expect(settingsSpy).toHaveBeenCalledTimes(1);

    // Concurrently, syncTick() finishes task-A -> records taskCompletedRoundsById['task-A'] = 1
    await store.syncTick();
    expect(useTimerStore.getState().taskCompletedRoundsById['task-A']).toBe(1);

    // Now setLinkedTask('task-B') resolves and commits -> task-A's completed round MUST survive!
    resolveLinkSettings();
    await linkPromise;

    const afterLink = useTimerStore.getState();
    expect(afterLink.taskId).toBe('task-B');
    expect(afterLink.taskCompletedRoundsById['task-A']).toBe(1);
    expect(afterLink.taskCompletedRoundsById['task-B']).toBe(0);

    // Relinking task-A restores 1 completed round
    await store.setLinkedTask('task-A', 'Organic Chemistry', 'Chemistry', 150, 25);
    expect(useTimerStore.getState().completedRounds).toBe(1);
    expect(useTimerStore.getState().taskCompletedRoundsById['task-A']).toBe(1);
  });

  it('persists clean timer state without leaking runtime config properties across store actions', async () => {
    const store = useTimerStore.getState();

    await store.setCustomDurations({ focusDuration: 30 }); // calls applySettings()
    store.setSubject('Biology'); // calls setSubject()
    await store.setMode('short-break'); // calls setMode()
    await store.start(); // calls start()

    let rawPersisted = JSON.parse(localStorage.getItem('focusforge_v1_timer_state') || '{}');
    expect(rawPersisted.status).toBe('running');
    expect(rawPersisted.focusDuration).toBeUndefined();
    expect(rawPersisted.isAlarmActive).toBeUndefined();

    store.pause(); // calls pause()
    await store.reset(); // calls reset()

    rawPersisted = JSON.parse(localStorage.getItem('focusforge_v1_timer_state') || '{}');
    expect(rawPersisted.subject).toBe('Biology');
    expect(rawPersisted.mode).toBe('short-break');
    expect(rawPersisted.focusDuration).toBeUndefined();
    expect(rawPersisted.shortBreakDuration).toBeUndefined();
    expect(rawPersisted.longBreakDuration).toBeUndefined();
    expect(rawPersisted.longBreakInterval).toBeUndefined();
    expect(rawPersisted.isAlarmActive).toBeUndefined();
    expect(rawPersisted.remainingSeconds).toBeUndefined();
  });
});

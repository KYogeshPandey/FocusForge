import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTimerStore } from '../src/stores/useTimerStore';
import { getFocusSessionService } from '../src/services/serviceFactory';

describe('Timer Store Controls, Dynamic Rounds, and Time Tracking', () => {
  beforeEach(async () => {
    localStorage.clear();
    const store = useTimerStore.getState();
    await store.setLinkedTask(null, null);
    await store.setMode('focus');
    await store.reset();
    await getFocusSessionService().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes in idle status with 25 minutes default', () => {
    const state = useTimerStore.getState();
    expect(state.mode).toBe('focus');
    expect(state.status).toBe('idle');
    expect(state.totalDurationSeconds).toBe(25 * 60);
    expect(state.remainingSeconds).toBe(25 * 60);
    expect(state.totalRounds).toBe(4);
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
    expect(state.completedRounds).toBe(1);

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
    expect(state.completedRounds).toBe(1);

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
});

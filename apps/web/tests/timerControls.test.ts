import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useTimerStore } from '../src/stores/useTimerStore';

describe('Timer Store Controls and Mode Switching', () => {
  beforeEach(() => {
    localStorage.clear();
    const state = useTimerStore.getState();
    state.reset();
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
  });

  it('starts, pauses, and resumes timer correctly', () => {
    const store = useTimerStore.getState();

    // 1. Start timer
    store.start();
    let current = useTimerStore.getState();
    expect(current.status).toBe('running');
    expect(current.endsAt).not.toBeNull();

    // 2. Pause timer
    store.pause();
    current = useTimerStore.getState();
    expect(current.status).toBe('paused');
    expect(current.endsAt).toBeNull();

    // 3. Resume timer
    store.resume();
    current = useTimerStore.getState();
    expect(current.status).toBe('running');
    expect(current.endsAt).not.toBeNull();
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

  it('advances timer countdown and completes interval with fake timers', async () => {
    vi.useFakeTimers();
    const store = useTimerStore.getState();

    await store.start();
    expect(useTimerStore.getState().status).toBe('running');

    // Advance 60 seconds
    vi.advanceTimersByTime(60 * 1000);
    store.syncTick();

    expect(useTimerStore.getState().remainingSeconds).toBe(24 * 60);

    // Advance through remainder of duration (24 minutes)
    vi.advanceTimersByTime(24 * 60 * 1000 + 1000);
    await store.syncTick();

    const afterFinished = useTimerStore.getState();
    expect(afterFinished.status).toBe('idle');
    // After focus session finishes, it cycles to break
    expect(afterFinished.mode).toBe('short-break');
    expect(afterFinished.completedRounds).toBe(1);
  });
});

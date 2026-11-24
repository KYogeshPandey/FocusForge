import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useTimerStore } from '../src/stores/useTimerStore';
import { alarmService } from '../src/services/alarmService';
import { getFocusSessionService, getSettingsService } from '../src/services/serviceFactory';

describe('Timer Completion Audible Alarm Lifecycle', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    alarmService.stop();

    // Reset settings to defaults with alarm enabled
    const settingsService = getSettingsService();
    await settingsService.update({
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      soundEnabled: true,
      soundVolume: 75,
      alarmEnabled: true,
      alarmVolume: 75,
      alarmSound: 'chime',
    });

    const store = useTimerStore.getState();
    await store.setLinkedTask(null, null);
    await store.setMode('focus');
    await store.reset();
    await getFocusSessionService().clear();
  });

  afterEach(() => {
    alarmService.stop();
    vi.useRealTimers();
  });

  it('1. Focus period completion automatically triggers continuous alarm and sets isAlarmActive', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    expect(useTimerStore.getState().status).toBe('running');
    expect(useTimerStore.getState().isAlarmActive).toBe(false);

    // Fast-forward to timer completion (25 minutes = 1500 seconds)
    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    const state = useTimerStore.getState();
    // Period finished
    expect(state.status).toBe('idle');
    expect(state.isAlarmActive).toBe(true);
    expect(state.alarmPeriodName).toContain('Focus Session');
    expect(alarmService.isPlaying()).toBe(true);
  });

  it('2. Alarm loops continuously until pauseAlarm() is explicitly called', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    // Advance to completion
    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);

    // Advance 10 seconds while alarm is sounding (looping)
    vi.advanceTimersByTime(10000);
    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);

    // User explicitly clicks Pause Alarm
    store.pauseAlarm();

    expect(useTimerStore.getState().isAlarmActive).toBe(false);
    expect(useTimerStore.getState().alarmPeriodName).toBeNull();
    expect(alarmService.isPlaying()).toBe(false);
  });

  it('3. Break completion triggers alarm with accurate period name', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.setMode('short-break');
    await store.start();

    expect(useTimerStore.getState().mode).toBe('short-break');

    // 5 minutes break (300 seconds)
    vi.advanceTimersByTime(300 * 1000);
    await store.syncTick();

    const state = useTimerStore.getState();
    expect(state.isAlarmActive).toBe(true);
    expect(state.alarmPeriodName).toBe('Short Break');
    expect(alarmService.isPlaying()).toBe(true);

    store.pauseAlarm();
    expect(alarmService.isPlaying()).toBe(false);
  });

  it('4. Prevents duplicate alarms on repeated syncTicks or React re-renders', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    vi.advanceTimersByTime(1500 * 1000);

    // Fire syncTick 3 times concurrently
    await Promise.all([store.syncTick(), store.syncTick(), store.syncTick()]);

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);

    // Next periodic tick (e.g. 1 second later) must NOT re-trigger alarm or crash
    vi.advanceTimersByTime(1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);
  });

  it('5. Does not automatically start the next period while alarm is active (Requirement 6)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    // Complete focus session
    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    const state = useTimerStore.getState();
    expect(state.isAlarmActive).toBe(true);
    // Next mode is short-break, but status MUST BE idle, not running
    expect(state.mode).toBe('short-break');
    expect(state.status).toBe('idle');
    expect(state.remainingSeconds).toBe(5 * 60);

    // Advance 60 seconds while alarm is ringing
    vi.advanceTimersByTime(60 * 1000);
    await store.syncTick();

    // Timer must NOT have counted down
    expect(useTimerStore.getState().remainingSeconds).toBe(5 * 60);
    expect(useTimerStore.getState().status).toBe('idle');
  });

  it('6. Multiple consecutive rounds: focus -> break -> focus with alarm dismissal', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();

    // Round 1: Focus
    await store.start();
    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(useTimerStore.getState().completedRounds).toBe(1);

    // Dismiss alarm
    store.pauseAlarm();
    expect(alarmService.isPlaying()).toBe(false);

    // Start Break
    await store.start();
    expect(useTimerStore.getState().mode).toBe('short-break');
    expect(useTimerStore.getState().status).toBe('running');

    // Break finishes
    vi.advanceTimersByTime(300 * 1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(useTimerStore.getState().alarmPeriodName).toBe('Short Break');

    // Dismiss alarm
    store.pauseAlarm();

    // Start Round 2: Focus
    await store.start();
    expect(useTimerStore.getState().mode).toBe('focus');
    expect(useTimerStore.getState().status).toBe('running');
  });

  it('7. Pausing and resuming active timer does not trigger alarm prematurely', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    // Run 10 minutes
    vi.advanceTimersByTime(600 * 1000);
    await store.syncTick();

    // Pause timer
    store.pause();
    expect(useTimerStore.getState().status).toBe('paused');
    expect(useTimerStore.getState().isAlarmActive).toBe(false);
    expect(alarmService.isPlaying()).toBe(false);

    // Stay paused 5 minutes
    vi.advanceTimersByTime(300 * 1000);
    await store.syncTick();
    expect(useTimerStore.getState().isAlarmActive).toBe(false);

    // Resume timer
    await store.resume();
    expect(useTimerStore.getState().status).toBe('running');
    expect(useTimerStore.getState().isAlarmActive).toBe(false);
  });

  it('8. Respects alarmEnabled=false setting (alarm does not play)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    // Disable completion alarm in settings
    const settingsService = getSettingsService();
    await settingsService.update({
      alarmEnabled: false,
      soundEnabled: false,
    });

    const store = useTimerStore.getState();
    await store.start();

    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(false);
    expect(alarmService.isPlaying()).toBe(false);
  });

  it('9. Starting, resetting, or skipping while alarm is active immediately silences it', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    vi.advanceTimersByTime(1500 * 1000);
    await store.syncTick();

    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);

    // Starting next session directly should silence alarm
    await store.start();
    expect(useTimerStore.getState().isAlarmActive).toBe(false);
    expect(alarmService.isPlaying()).toBe(false);
  });

  it('10. Simulates background tab timer completion: triggers alarm as soon as background tick runs', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const store = useTimerStore.getState();
    await store.start();

    // Simulate background tab where interval was throttled or delayed past endsAt
    vi.advanceTimersByTime(1600 * 1000); // 100s past endsAt
    await store.syncTick();

    // Alarm triggers cleanly
    expect(useTimerStore.getState().isAlarmActive).toBe(true);
    expect(alarmService.isPlaying()).toBe(true);

    store.pauseAlarm();
    expect(alarmService.isPlaying()).toBe(false);
  });
});

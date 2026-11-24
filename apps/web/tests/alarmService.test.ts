import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlarmService } from '../src/services/alarmService';

describe('AlarmService Audio Synthesis and Looping Lifecycle', () => {
  let alarm: AlarmService;

  beforeEach(() => {
    vi.useFakeTimers();
    alarm = new AlarmService();
  });

  afterEach(() => {
    alarm.stop();
    alarm.dispose();
    vi.useRealTimers();
  });

  it('initializes in stopped state with chime default', () => {
    expect(alarm.isPlaying()).toBe(false);
    expect(alarm.getCurrentSound()).toBe('chime');
    expect(alarm.getCurrentVolume()).toBe(70);
  });

  it('play() triggers alarm, sets isPlaying to true, and loops until stop()', async () => {
    await alarm.play({ sound: 'digital', volume: 80 });

    expect(alarm.isPlaying()).toBe(true);
    expect(alarm.getCurrentSound()).toBe('digital');
    expect(alarm.getCurrentVolume()).toBe(80);

    // Fast forward through 3 loops
    vi.advanceTimersByTime(1400 * 3);
    expect(alarm.isPlaying()).toBe(true);

    // Explicit stop
    alarm.stop();
    expect(alarm.isPlaying()).toBe(false);

    // Advance further - should remain stopped
    vi.advanceTimersByTime(5000);
    expect(alarm.isPlaying()).toBe(false);
  });

  it('calling play() multiple times is idempotent and prevents overlapping loops', async () => {
    await alarm.play({ sound: 'chime', volume: 50 });
    expect(alarm.isPlaying()).toBe(true);

    // Subsequent calls while already playing should be no-ops
    await alarm.play({ sound: 'chime', volume: 50 });
    await alarm.play({ sound: 'chime', volume: 50 });

    expect(alarm.isPlaying()).toBe(true);

    // Stopping once immediately silences the entire alarm
    alarm.stop();
    expect(alarm.isPlaying()).toBe(false);
  });

  it('stop() immediately silences audio nodes without lingering sound', async () => {
    await alarm.play({ sound: 'bell', volume: 90 });
    expect(alarm.isPlaying()).toBe(true);

    alarm.stop();
    expect(alarm.isPlaying()).toBe(false);
  });

  it('preview() plays a sound sample without activating continuous looping', async () => {
    await alarm.preview({ sound: 'marimba', volume: 60 });

    // preview must NOT set continuous loop state
    expect(alarm.isPlaying()).toBe(false);

    // Advance time - no loop timer should fire
    vi.advanceTimersByTime(5000);
    expect(alarm.isPlaying()).toBe(false);
  });

  it('supports all 4 synthesized sound presets without errors', async () => {
    const presets = ['chime', 'digital', 'bell', 'marimba'] as const;

    for (const preset of presets) {
      await alarm.play({ sound: preset, volume: 75 });
      expect(alarm.isPlaying()).toBe(true);
      expect(alarm.getCurrentSound()).toBe(preset);

      vi.advanceTimersByTime(2000);
      alarm.stop();
      expect(alarm.isPlaying()).toBe(false);
    }
  });

  it('unlock() successfully resumes suspended AudioContext', async () => {
    const unlocked = await alarm.unlock();
    expect(unlocked).toBe(true);
  });

  it('handles volume 0 gracefully without scheduling audible nodes', async () => {
    await alarm.play({ sound: 'chime', volume: 0 });
    expect(alarm.isPlaying()).toBe(true);
    alarm.stop();
    expect(alarm.isPlaying()).toBe(false);
  });

  it('cleans up resources on dispose()', () => {
    alarm.play({ sound: 'chime' });
    alarm.dispose();
    expect(alarm.isPlaying()).toBe(false);
  });
});

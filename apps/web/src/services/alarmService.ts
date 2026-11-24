import type { AlarmSound } from '@focusforge/shared';

export type AlarmSoundType = AlarmSound;

export interface PlayAlarmOptions {
  sound?: AlarmSoundType;
  volume?: number; // 0 - 100
}

interface ActiveNodeGroup {
  oscillators: OscillatorNode[];
  gainNodes: GainNode[];
}

/**
 * Robust Web Audio alarm service with continuous looping, immediate pause/stop,
 * multiple pleasant synthesized sound presets, and graceful browser autoplay unlocking.
 */
export class AlarmService {
  private audioCtx: AudioContext | null = null;
  private loopTimer: ReturnType<typeof setInterval> | null = null;
  private activeGroups: ActiveNodeGroup[] = [];
  private isCurrentlyPlaying = false;
  private currentSound: AlarmSoundType = 'chime';
  private currentVolume = 70;
  private isUnlocked = false;

  constructor() {
    this.setupAutoUnlock();
  }

  /**
   * Sets up global one-time interaction listeners to unlock AudioContext under browser autoplay policies.
   */
  private setupAutoUnlock(): void {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.unlock();
      window.removeEventListener('pointerdown', unlockHandler);
      window.removeEventListener('keydown', unlockHandler);
      window.removeEventListener('touchstart', unlockHandler);
      window.removeEventListener('click', unlockHandler);
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true, once: true });
    window.addEventListener('keydown', unlockHandler, { passive: true, once: true });
    window.addEventListener('touchstart', unlockHandler, { passive: true, once: true });
    window.addEventListener('click', unlockHandler, { passive: true, once: true });
  }

  /**
   * Lazily creates or returns the singleton AudioContext instance.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.audioCtx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return null;

      try {
        this.audioCtx = new AudioContextClass();
      } catch (err) {
        console.warn('Unable to initialize Web Audio AudioContext:', err);
        return null;
      }
    }

    return this.audioCtx;
  }

  /**
   * Explicitly unlocks/resumes the AudioContext following user interaction.
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.getAudioContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        this.isUnlocked = true;
        return true;
      } catch (err) {
        console.warn('Failed to resume AudioContext during unlock:', err);
        return false;
      }
    }

    this.isUnlocked = true;
    return true;
  }

  /**
   * Returns whether the AudioContext has been unlocked by user gesture.
   */
  public isAudioUnlocked(): boolean {
    return this.isUnlocked;
  }

  /**
   * Returns whether the alarm is currently looping/playing.
   */
  public isPlaying(): boolean {
    return this.isCurrentlyPlaying;
  }

  /**
   * Returns the current sound preset.
   */
  public getCurrentSound(): AlarmSoundType {
    return this.currentSound;
  }

  /**
   * Returns the current volume (0-100).
   */
  public getCurrentVolume(): number {
    return this.currentVolume;
  }

  /**
   * Triggers the continuous alarm loop.
   * Safe to call multiple times: will not create duplicate overlapping loops.
   */
  public async play(options: PlayAlarmOptions = {}): Promise<void> {
    const sound = options.sound || this.currentSound || 'chime';
    const volume = options.volume !== undefined ? options.volume : this.currentVolume;

    this.currentSound = sound;
    this.currentVolume = volume;

    // Prevent duplicate overlapping alarm loops
    if (this.isCurrentlyPlaying) {
      return;
    }

    this.isCurrentlyPlaying = true;

    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('AudioContext playback blocked by browser autoplay policy:', err);
      }
    }

    // Play round 1 immediately
    this.synthesizePattern(sound, volume);

    // Loop interval depending on sound preset duration
    const intervalMs = sound === 'bell' ? 2400 : sound === 'digital' ? 1400 : 1800;

    this.loopTimer = setInterval(() => {
      if (!this.isCurrentlyPlaying) {
        if (this.loopTimer) clearInterval(this.loopTimer);
        this.loopTimer = null;
        return;
      }
      this.synthesizePattern(sound, volume);
    }, intervalMs);
  }

  /**
   * Immediately stops the alarm and silences any playing audio nodes without delay.
   */
  public stop(): void {
    this.isCurrentlyPlaying = false;

    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    const ctx = this.audioCtx;
    const now = ctx ? ctx.currentTime : 0;

    // Immediately silence and stop all active nodes
    for (const group of this.activeGroups) {
      for (const gain of group.gainNodes) {
        try {
          if (ctx) {
            gain.gain.cancelScheduledValues(now);
            gain.gain.setValueAtTime(0, now);
          }
          gain.disconnect();
        } catch {
          // ignore disconnect errors
        }
      }

      for (const osc of group.oscillators) {
        try {
          osc.stop();
          osc.disconnect();
        } catch {
          // ignore node already stopped errors
        }
      }
    }

    this.activeGroups = [];
  }

  /**
   * Plays a single iteration of a sound preset for preview/testing in settings.
   */
  public async preview(options: PlayAlarmOptions = {}): Promise<void> {
    const sound = options.sound || this.currentSound || 'chime';
    const volume = options.volume !== undefined ? options.volume : this.currentVolume;

    const ctx = this.getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        console.warn('AudioContext preview blocked by autoplay policy:', err);
      }
    }

    this.synthesizePattern(sound, volume);
  }

  /**
   * Synthesizes the chosen audio pattern using Web Audio API nodes.
   */
  private synthesizePattern(sound: AlarmSoundType, volumePercent: number): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (volumePercent <= 0) return;

    const masterGain = ctx.createGain();
    const safeVolume = Math.max(0, Math.min(100, volumePercent)) / 100;
    const masterMaxGain = safeVolume * 0.35; // Safe maximum ceiling

    masterGain.gain.setValueAtTime(masterMaxGain, ctx.currentTime);
    masterGain.connect(ctx.destination);

    const group: ActiveNodeGroup = {
      oscillators: [],
      gainNodes: [masterGain],
    };

    switch (sound) {
      case 'digital':
        this.synthesizeDigitalBeep(ctx, masterGain, group);
        break;
      case 'bell':
        this.synthesizeBell(ctx, masterGain, group);
        break;
      case 'marimba':
        this.synthesizeMarimba(ctx, masterGain, group);
        break;
      case 'chime':
      default:
        this.synthesizeChime(ctx, masterGain, group);
        break;
    }

    this.activeGroups.push(group);

    // Garbage-collect finished groups after 3 seconds
    setTimeout(() => {
      const idx = this.activeGroups.indexOf(group);
      if (idx !== -1) {
        this.activeGroups.splice(idx, 1);
      }
    }, 3000);
  }

  /**
   * Melodic Chime: C5, E5, G5, B5, C6 ascending arpeggio with warm sine harmonics.
   */
  private synthesizeChime(ctx: AudioContext, destination: GainNode, group: ActiveNodeGroup): void {
    const frequencies = [523.25, 659.25, 783.99, 987.77, 1046.5];
    const now = ctx.currentTime;

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      const startTime = now + idx * 0.09;
      const duration = 0.9;

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      group.oscillators.push(osc);
      group.gainNodes.push(noteGain);
    });
  }

  /**
   * Digital Beep: Two rapid dual-tone pulses (beep-beep ... beep-beep).
   */
  private synthesizeDigitalBeep(ctx: AudioContext, destination: GainNode, group: ActiveNodeGroup): void {
    const now = ctx.currentTime;
    const pulses = [0, 0.12, 0.45, 0.57]; // 4 quick beeps
    const baseFreq = 880; // A5

    pulses.forEach((pulseOffset) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq, now + pulseOffset);

      const startTime = now + pulseOffset;
      const duration = 0.07;

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.5, startTime + 0.01);
      noteGain.gain.setValueAtTime(0.5, startTime + duration - 0.01);
      noteGain.gain.linearRampToValueAtTime(0.001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      group.oscillators.push(osc);
      group.gainNodes.push(noteGain);
    });
  }

  /**
   * Resonant Bell: Harmonic bell tones with lingering acoustic overtones.
   */
  private synthesizeBell(ctx: AudioContext, destination: GainNode, group: ActiveNodeGroup): void {
    const now = ctx.currentTime;
    // Harmonic overtones for acoustic bell richness
    const harmonics = [
      { freq: 587.33, gain: 0.8, decay: 1.6 },  // D5 fundamental
      { freq: 880.0, gain: 0.5, decay: 1.3 },   // A5
      { freq: 1174.66, gain: 0.3, decay: 0.9 }, // D6
      { freq: 1479.98, gain: 0.15, decay: 0.6 } // F#6
    ];

    harmonics.forEach(({ freq, gain, decay }) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(gain, now + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + decay);

      osc.connect(noteGain);
      noteGain.connect(destination);

      osc.start(now);
      osc.stop(now + decay);

      group.oscillators.push(osc);
      group.gainNodes.push(noteGain);
    });
  }

  /**
   * Marimba: Warm acoustic wooden triad with fast attack and natural resonance.
   */
  private synthesizeMarimba(ctx: AudioContext, destination: GainNode, group: ActiveNodeGroup): void {
    const notes = [440.0, 554.37, 659.25, 880.0]; // A4, C#5, E5, A5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      const startTime = now + idx * 0.08;
      const duration = 0.6;

      noteGain.gain.setValueAtTime(0, startTime);
      noteGain.gain.linearRampToValueAtTime(0.7, startTime + 0.008);
      noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(noteGain);
      noteGain.connect(destination);

      osc.start(startTime);
      osc.stop(startTime + duration);

      group.oscillators.push(osc);
      group.gainNodes.push(noteGain);
    });
  }

  /**
   * Full cleanup of audio resources.
   */
  public dispose(): void {
    this.stop();
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }
}

export const alarmService = new AlarmService();

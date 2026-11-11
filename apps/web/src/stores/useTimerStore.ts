import { create } from 'zustand';
import type { FocusMode, Settings } from '@focusforge/shared';
import {
  calculateRemainingSeconds,
  getNextTimerCycle,
  formatTitleCountdown,
} from '../utils/timer';
import { playChime } from '../utils/sound';
import { getFocusSessionService, getSettingsService } from '../services/serviceFactory';

const TIMER_STORAGE_KEY = 'focusforge_v1_timer_state';

export interface PersistedTimerState {
  mode: FocusMode;
  status: 'idle' | 'running' | 'paused';
  endsAt: number | null;
  startedAt: string | null;
  totalDurationSeconds: number;
  pausedRemainingSeconds: number;
  completedRounds: number;
  subject: string;
  taskId: string | null;
  taskTitle: string | null;
}

interface TimerStoreState extends PersistedTimerState {
  remainingSeconds: number;
  progressPercentage: number;
  // Actions
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  skip: () => void;
  setMode: (mode: FocusMode) => void;
  setSubject: (subject: string) => void;
  setLinkedTask: (taskId: string | null, taskTitle: string | null, subject?: string) => void;
  syncTick: () => void;
  initialize: () => Promise<void>;
}

function loadPersistedState(): PersistedTimerState {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw) as PersistedTimerState;
    }
  } catch (err) {
    console.warn('Failed to load persisted timer state:', err);
  }

  return {
    mode: 'focus',
    status: 'idle',
    endsAt: null,
    startedAt: null,
    totalDurationSeconds: 25 * 60,
    pausedRemainingSeconds: 25 * 60,
    completedRounds: 0,
    subject: 'General',
    taskId: null,
    taskTitle: null,
  };
}

function saveState(state: PersistedTimerState): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save timer state:', err);
  }
}

function getDurationForMode(mode: FocusMode, settings: Settings): number {
  switch (mode) {
    case 'focus':
      return settings.focusDuration * 60;
    case 'short-break':
      return settings.shortBreakDuration * 60;
    case 'long-break':
      return settings.longBreakDuration * 60;
  }
}

export const useTimerStore = create<TimerStoreState>((set, get) => {
  const initial = loadPersistedState();
  const initialCalc = calculateRemainingSeconds(
    initial.endsAt,
    initial.totalDurationSeconds,
    initial.status !== 'running',
    initial.pausedRemainingSeconds
  );

  return {
    ...initial,
    remainingSeconds: initialCalc.remainingSeconds,
    progressPercentage: initialCalc.progressPercentage,

    initialize: async () => {
      // Re-sync with current settings if idle
      const settings = await getSettingsService().get();
      const current = get();
      if (current.status === 'idle') {
        const total = getDurationForMode(current.mode, settings);
        set({
          totalDurationSeconds: total,
          pausedRemainingSeconds: total,
          remainingSeconds: total,
          progressPercentage: 0,
        });
      }
    },

    start: async () => {
      const state = get();
      const now = Date.now();
      const secondsToRun =
        state.status === 'paused' ? state.pausedRemainingSeconds : state.totalDurationSeconds;
      const endsAt = now + secondsToRun * 1000;
      const startedAt = state.startedAt || new Date(now).toISOString();

      const updatedPersisted: PersistedTimerState = {
        ...state,
        status: 'running',
        endsAt,
        startedAt,
        pausedRemainingSeconds: secondsToRun,
      };

      saveState(updatedPersisted);
      set({
        ...updatedPersisted,
        remainingSeconds: secondsToRun,
      });

      // Update document title
      document.title = formatTitleCountdown(secondsToRun, state.mode);
    },

    pause: () => {
      const state = get();
      if (state.status !== 'running') return;

      const calc = calculateRemainingSeconds(
        state.endsAt,
        state.totalDurationSeconds,
        false,
        state.pausedRemainingSeconds
      );

      const updated: PersistedTimerState = {
        ...state,
        status: 'paused',
        endsAt: null,
        pausedRemainingSeconds: calc.remainingSeconds,
      };

      saveState(updated);
      set({
        ...updated,
        remainingSeconds: calc.remainingSeconds,
        progressPercentage: calc.progressPercentage,
      });

      document.title = `Paused · ${formatTitleCountdown(calc.remainingSeconds, state.mode)}`;
    },

    resume: () => {
      get().start();
    },

    reset: async () => {
      const state = get();
      const settings = await getSettingsService().get();
      const total = getDurationForMode(state.mode, settings);

      const updated: PersistedTimerState = {
        ...state,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        totalDurationSeconds: total,
        pausedRemainingSeconds: total,
      };

      saveState(updated);
      set({
        ...updated,
        remainingSeconds: total,
        progressPercentage: 0,
      });

      document.title = 'FocusForge — Student Study Planner';
    },

    skip: async () => {
      const state = get();
      const settings = await getSettingsService().get();
      const { nextMode, nextRounds } = getNextTimerCycle(
        state.mode,
        state.completedRounds,
        settings.longBreakInterval
      );
      const total = getDurationForMode(nextMode, settings);

      const updated: PersistedTimerState = {
        ...state,
        mode: nextMode,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        totalDurationSeconds: total,
        pausedRemainingSeconds: total,
        completedRounds: nextRounds,
      };

      saveState(updated);
      set({
        ...updated,
        remainingSeconds: total,
        progressPercentage: 0,
      });

      document.title = 'FocusForge — Student Study Planner';
    },

    setMode: async (mode: FocusMode) => {
      const state = get();
      const settings = await getSettingsService().get();
      const total = getDurationForMode(mode, settings);

      const updated: PersistedTimerState = {
        ...state,
        mode,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        totalDurationSeconds: total,
        pausedRemainingSeconds: total,
      };

      saveState(updated);
      set({
        ...updated,
        remainingSeconds: total,
        progressPercentage: 0,
      });

      document.title = 'FocusForge — Student Study Planner';
    },

    setSubject: (subject: string) => {
      const state = get();
      const updated = { ...state, subject };
      saveState(updated);
      set({ subject });
    },

    setLinkedTask: (taskId: string | null, taskTitle: string | null, subject?: string) => {
      const state = get();
      const nextSubject = subject || state.subject;
      const updated = {
        ...state,
        taskId,
        taskTitle,
        subject: nextSubject,
      };
      saveState(updated);
      set({ taskId, taskTitle, subject: nextSubject });
    },

    syncTick: async () => {
      const state = get();
      if (state.status !== 'running' || state.endsAt === null) return;

      const calc = calculateRemainingSeconds(
        state.endsAt,
        state.totalDurationSeconds,
        false,
        state.pausedRemainingSeconds
      );

      if (calc.isFinished) {
        // Complete current interval!
        const settings = await getSettingsService().get();

        // 1. Play sound chime if enabled
        if (settings.soundEnabled) {
          playChime(settings.soundVolume);
        }

        // 2. If it was a focus session, auto-record it to FocusSessionService
        if (state.mode === 'focus') {
          const durationMinutes = Math.round(state.totalDurationSeconds / 60);
          const endNow = new Date().toISOString();
          const startedAt = state.startedAt || new Date(Date.now() - state.totalDurationSeconds * 1000).toISOString();

          await getFocusSessionService().create({
            title: state.taskTitle || `${state.subject} Focus Session`,
            subject: state.subject,
            durationMinutes,
            startedAt,
            endedAt: endNow,
            mode: 'focus',
            taskId: state.taskId,
          });
        }

        // 3. Move to next mode
        const { nextMode, nextRounds } = getNextTimerCycle(
          state.mode,
          state.completedRounds,
          settings.longBreakInterval
        );
        const nextTotal = getDurationForMode(nextMode, settings);

        const updated: PersistedTimerState = {
          ...state,
          mode: nextMode,
          status: 'idle',
          endsAt: null,
          startedAt: null,
          totalDurationSeconds: nextTotal,
          pausedRemainingSeconds: nextTotal,
          completedRounds: nextRounds,
        };

        saveState(updated);
        set({
          ...updated,
          remainingSeconds: nextTotal,
          progressPercentage: 0,
        });

        document.title = `Completed! · FocusForge`;
      } else {
        set({
          remainingSeconds: calc.remainingSeconds,
          progressPercentage: calc.progressPercentage,
        });
        document.title = formatTitleCountdown(calc.remainingSeconds, state.mode);
      }
    },
  };
});

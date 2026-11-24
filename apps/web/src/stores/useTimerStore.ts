import { create } from 'zustand';
import type { FocusMode, Settings } from '@focusforge/shared';
import {
  calculateRemainingSeconds,
  formatTitleCountdown,
  calculateTaskRoundPlan,
} from '../utils/timer';
import { playChime } from '../utils/sound';
import { getFocusSessionService, getSettingsService } from '../services/serviceFactory';
import { queryClient } from '../queryClient';

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
  taskTotalDurationMinutes: number | null;
  taskFocusMinutesLogged: number;
  currentRound: number;
  totalRounds: number;
  isTaskComplete: boolean;
  clientSessionId: string | null;
}

interface TimerStoreState extends PersistedTimerState {
  remainingSeconds: number;
  progressPercentage: number;
  // Actions
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
  setMode: (mode: FocusMode) => Promise<void>;
  setSubject: (subject: string) => void;
  setLinkedTask: (
    taskId: string | null,
    taskTitle: string | null,
    subject?: string,
    estimatedMinutes?: number | null,
    initialLoggedMinutes?: number
  ) => Promise<void>;
  syncTick: () => Promise<void>;
  initialize: () => Promise<void>;
}

function generateClientSessionId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function loadPersistedState(): PersistedTimerState {
  try {
    const rawStr = localStorage.getItem(TIMER_STORAGE_KEY);
    if (rawStr) {
      const raw = JSON.parse(rawStr) as Partial<PersistedTimerState>;
      return {
        mode: raw.mode || 'focus',
        status: raw.status || 'idle',
        endsAt: raw.endsAt ?? null,
        startedAt: raw.startedAt ?? null,
        totalDurationSeconds: raw.totalDurationSeconds ?? 25 * 60,
        pausedRemainingSeconds: raw.pausedRemainingSeconds ?? 25 * 60,
        completedRounds: raw.completedRounds ?? 0,
        subject: raw.subject || 'General',
        taskId: raw.taskId ?? null,
        taskTitle: raw.taskTitle ?? null,
        taskTotalDurationMinutes: raw.taskTotalDurationMinutes ?? null,
        taskFocusMinutesLogged: raw.taskFocusMinutesLogged ?? 0,
        currentRound: raw.currentRound ?? 1,
        totalRounds: raw.totalRounds ?? 4,
        isTaskComplete: raw.isTaskComplete ?? false,
        clientSessionId: raw.clientSessionId ?? null,
      };
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
    taskTotalDurationMinutes: null,
    taskFocusMinutesLogged: 0,
    currentRound: 1,
    totalRounds: 4,
    isTaskComplete: false,
    clientSessionId: null,
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

// In-flight mutex to avoid duplicate session records during async network calls
let isRecordingSession = false;

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
      const persisted = loadPersistedState();
      const calc = calculateRemainingSeconds(
        persisted.endsAt,
        persisted.totalDurationSeconds,
        persisted.status !== 'running',
        persisted.pausedRemainingSeconds
      );

      const settings = await getSettingsService().get();
      const defaultFocusDuration = settings.focusDuration || 25;

      if (persisted.status === 'idle') {
        let total: number;

        if (persisted.mode === 'focus') {
          const plan = calculateTaskRoundPlan(
            persisted.taskTotalDurationMinutes,
            persisted.taskFocusMinutesLogged,
            persisted.completedRounds,
            defaultFocusDuration
          );
          total = plan.currentRoundDurationMinutes * 60;
          set({
            ...persisted,
            totalDurationSeconds: total,
            pausedRemainingSeconds: total,
            remainingSeconds: total,
            currentRound: plan.currentRound,
            totalRounds: plan.totalRounds,
            isTaskComplete: plan.isTaskComplete,
            progressPercentage: 0,
          });
        } else {
          total = getDurationForMode(persisted.mode, settings);
          set({
            ...persisted,
            totalDurationSeconds: total,
            pausedRemainingSeconds: total,
            remainingSeconds: total,
            progressPercentage: 0,
          });
        }
      } else {
        set({
          ...persisted,
          remainingSeconds: calc.remainingSeconds,
          progressPercentage: calc.progressPercentage,
        });
      }
    },

    start: async () => {
      const state = get();
      if (state.isTaskComplete && state.mode === 'focus') return;

      const now = Date.now();
      const secondsToRun =
        state.status === 'paused' ? state.pausedRemainingSeconds : state.totalDurationSeconds;
      const endsAt = now + secondsToRun * 1000;
      const startedAt = state.startedAt || new Date(now).toISOString();
      const clientSessionId = state.clientSessionId || generateClientSessionId();

      const updatedPersisted: PersistedTimerState = {
        ...state,
        status: 'running',
        endsAt,
        startedAt,
        pausedRemainingSeconds: secondsToRun,
        clientSessionId,
      };

      saveState(updatedPersisted);
      set({
        ...updatedPersisted,
        remainingSeconds: secondsToRun,
      });

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

    resume: async () => {
      await get().start();
    },

    reset: async () => {
      const state = get();
      const settings = await getSettingsService().get();
      const defaultFocusDuration = settings.focusDuration || 25;

      let total: number;
      if (state.mode === 'focus') {
        const plan = calculateTaskRoundPlan(
          state.taskTotalDurationMinutes,
          state.taskFocusMinutesLogged,
          state.completedRounds,
          defaultFocusDuration
        );
        total = plan.currentRoundDurationMinutes * 60;
      } else {
        total = getDurationForMode(state.mode, settings);
      }

      const updated: PersistedTimerState = {
        ...state,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        clientSessionId: null,
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
      if (isRecordingSession) return;
      isRecordingSession = true;

      try {
        const settings = await getSettingsService().get();
        const defaultFocusDuration = settings.focusDuration || 25;

        // Calculate actual elapsed seconds
        const currentRemaining =
          state.status === 'running' && state.endsAt !== null
            ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
            : state.pausedRemainingSeconds;
        const elapsedSeconds = Math.max(0, state.totalDurationSeconds - currentRemaining);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);

        let nextTaskFocusMinutesLogged = state.taskFocusMinutesLogged;
        let nextCompletedRounds = state.completedRounds;

        if (state.mode === 'focus') {
          // If focus session had elapsed time > 0, record it
          const remainingBudget = state.taskTotalDurationMinutes
            ? Math.max(0, state.taskTotalDurationMinutes - state.taskFocusMinutesLogged)
            : Infinity;
          const minutesToRecord = Math.min(elapsedMinutes, remainingBudget);

          if (minutesToRecord > 0) {
            nextTaskFocusMinutesLogged += minutesToRecord;
            const endNow = new Date().toISOString();
            const startedAt =
              state.startedAt || new Date(Date.now() - elapsedSeconds * 1000).toISOString();

            await getFocusSessionService().create({
              title: state.taskTitle || `${state.subject} Focus Session`,
              subject: state.subject,
              durationMinutes: minutesToRecord,
              startedAt,
              endedAt: endNow,
              mode: 'focus',
              taskId: state.taskId,
              clientSessionId: state.clientSessionId || generateClientSessionId(),
            });

            queryClient.invalidateQueries({ queryKey: ['focus_sessions'] });
          }

          nextCompletedRounds = state.completedRounds + 1;
        }

        // Calculate plan after this round
        const plan = calculateTaskRoundPlan(
          state.taskTotalDurationMinutes,
          nextTaskFocusMinutesLogged,
          nextCompletedRounds,
          defaultFocusDuration
        );

        let nextMode: FocusMode;
        let nextDurationSeconds: number;

        if (state.mode === 'focus') {
          if (plan.isTaskComplete) {
            nextMode = 'focus';
            nextDurationSeconds = 0;
          } else {
            if (nextCompletedRounds % settings.longBreakInterval === 0) {
              nextMode = 'long-break';
              nextDurationSeconds = settings.longBreakDuration * 60;
            } else {
              nextMode = 'short-break';
              nextDurationSeconds = settings.shortBreakDuration * 60;
            }
          }
        } else {
          // Skipping a break moves to next focus round
          nextMode = 'focus';
          nextDurationSeconds = plan.currentRoundDurationMinutes * 60;
        }

        const updated: PersistedTimerState = {
          ...state,
          mode: nextMode,
          status: 'idle',
          endsAt: null,
          startedAt: null,
          clientSessionId: null,
          totalDurationSeconds: nextDurationSeconds,
          pausedRemainingSeconds: nextDurationSeconds,
          completedRounds: nextCompletedRounds,
          taskFocusMinutesLogged: nextTaskFocusMinutesLogged,
          currentRound: plan.currentRound,
          totalRounds: plan.totalRounds,
          isTaskComplete: plan.isTaskComplete,
        };

        saveState(updated);
        set({
          ...updated,
          remainingSeconds: nextDurationSeconds,
          progressPercentage: 0,
        });

        document.title = plan.isTaskComplete
          ? 'Task Completed! · FocusForge'
          : 'FocusForge — Student Study Planner';
      } finally {
        isRecordingSession = false;
      }
    },

    setMode: async (mode: FocusMode) => {
      const state = get();
      const settings = await getSettingsService().get();
      const defaultFocusDuration = settings.focusDuration || 25;

      let total: number;
      if (mode === 'focus') {
        const plan = calculateTaskRoundPlan(
          state.taskTotalDurationMinutes,
          state.taskFocusMinutesLogged,
          state.completedRounds,
          defaultFocusDuration
        );
        total = plan.currentRoundDurationMinutes * 60;
      } else {
        total = getDurationForMode(mode, settings);
      }

      const updated: PersistedTimerState = {
        ...state,
        mode,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        clientSessionId: null,
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

    setLinkedTask: async (
      taskId: string | null,
      taskTitle: string | null,
      subject?: string,
      estimatedMinutes?: number | null,
      initialLoggedMinutes: number = 0
    ) => {
      const state = get();
      const settings = await getSettingsService().get();
      const defaultFocusDuration = settings.focusDuration || 25;
      const nextSubject = subject || (taskId ? state.subject : 'General');
      const taskDuration = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : null;

      const initialCompletedRounds =
        taskDuration && initialLoggedMinutes > 0
          ? Math.floor(initialLoggedMinutes / defaultFocusDuration)
          : 0;

      const plan = calculateTaskRoundPlan(
        taskDuration,
        initialLoggedMinutes,
        initialCompletedRounds,
        defaultFocusDuration
      );

      const initialDurationSeconds =
        state.mode === 'focus'
          ? plan.currentRoundDurationMinutes * 60
          : getDurationForMode(state.mode, settings);

      const updated: PersistedTimerState = {
        ...state,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        clientSessionId: null,
        taskId,
        taskTitle,
        subject: nextSubject,
        taskTotalDurationMinutes: taskDuration,
        taskFocusMinutesLogged: initialLoggedMinutes,
        completedRounds: initialCompletedRounds,
        currentRound: plan.currentRound,
        totalRounds: plan.totalRounds,
        isTaskComplete: plan.isTaskComplete,
        totalDurationSeconds: initialDurationSeconds,
        pausedRemainingSeconds: initialDurationSeconds,
      };

      saveState(updated);
      set({
        ...updated,
        remainingSeconds: initialDurationSeconds,
        progressPercentage: 0,
      });
    },

    syncTick: async () => {
      const state = get();
      if (state.status !== 'running' || state.endsAt === null || isRecordingSession) return;

      const calc = calculateRemainingSeconds(
        state.endsAt,
        state.totalDurationSeconds,
        false,
        state.pausedRemainingSeconds
      );

      if (calc.isFinished) {
        isRecordingSession = true;
        try {
          const settings = await getSettingsService().get();
          const defaultFocusDuration = settings.focusDuration || 25;

          // 1. Play sound chime if enabled
          if (settings.soundEnabled) {
            playChime(settings.soundVolume);
          }

          let nextTaskFocusMinutesLogged = state.taskFocusMinutesLogged;
          let nextCompletedRounds = state.completedRounds;

          // 2. If it was a focus session, auto-record it
          if (state.mode === 'focus') {
            const plannedMinutes = Math.round(state.totalDurationSeconds / 60);
            const remainingBudget = state.taskTotalDurationMinutes
              ? Math.max(0, state.taskTotalDurationMinutes - state.taskFocusMinutesLogged)
              : Infinity;
            const minutesToRecord = Math.min(plannedMinutes, remainingBudget);

            if (minutesToRecord > 0) {
              nextTaskFocusMinutesLogged += minutesToRecord;
              const endNow = new Date().toISOString();
              const startedAt =
                state.startedAt || new Date(Date.now() - state.totalDurationSeconds * 1000).toISOString();

              await getFocusSessionService().create({
                title: state.taskTitle || `${state.subject} Focus Session`,
                subject: state.subject,
                durationMinutes: minutesToRecord,
                startedAt,
                endedAt: endNow,
                mode: 'focus',
                taskId: state.taskId,
                clientSessionId: state.clientSessionId || generateClientSessionId(),
              });

              queryClient.invalidateQueries({ queryKey: ['focus_sessions'] });
            }

            nextCompletedRounds = state.completedRounds + 1;
          }

          // 3. Calculate plan after this round completes
          const plan = calculateTaskRoundPlan(
            state.taskTotalDurationMinutes,
            nextTaskFocusMinutesLogged,
            nextCompletedRounds,
            defaultFocusDuration
          );

          let nextMode: FocusMode;
          let nextDurationSeconds: number;

          if (state.mode === 'focus') {
            if (plan.isTaskComplete) {
              nextMode = 'focus';
              nextDurationSeconds = 0;
            } else {
              if (nextCompletedRounds % settings.longBreakInterval === 0) {
                nextMode = 'long-break';
                nextDurationSeconds = settings.longBreakDuration * 60;
              } else {
                nextMode = 'short-break';
                nextDurationSeconds = settings.shortBreakDuration * 60;
              }
            }
          } else {
            // Break completed, move to next focus round
            nextMode = 'focus';
            nextDurationSeconds = plan.currentRoundDurationMinutes * 60;
          }

          const updated: PersistedTimerState = {
            ...state,
            mode: nextMode,
            status: 'idle',
            endsAt: null,
            startedAt: null,
            clientSessionId: null,
            totalDurationSeconds: nextDurationSeconds,
            pausedRemainingSeconds: nextDurationSeconds,
            completedRounds: nextCompletedRounds,
            taskFocusMinutesLogged: nextTaskFocusMinutesLogged,
            currentRound: plan.currentRound,
            totalRounds: plan.totalRounds,
            isTaskComplete: plan.isTaskComplete,
          };

          saveState(updated);
          set({
            ...updated,
            remainingSeconds: nextDurationSeconds,
            progressPercentage: 0,
          });

          document.title = plan.isTaskComplete
            ? 'Task Completed! · FocusForge'
            : 'Completed! · FocusForge';
        } finally {
          isRecordingSession = false;
        }
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

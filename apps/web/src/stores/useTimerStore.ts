import { create } from 'zustand';
import type { FocusMode, Settings } from '@focusforge/shared';
import {
  calculateRemainingSeconds,
  formatTitleCountdown,
  calculateTaskRoundPlan,
  TIMER_DURATION_LIMITS,
  FIXED_LONG_BREAK_INTERVAL,
  validateDurationMinutes,
} from '../utils/timer';
import { playChime } from '../utils/sound';
import { alarmService } from '../services/alarmService';
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
  taskCompletedRoundsById: Record<string, number>;
}

export interface CustomDurationInput {
  focusDuration?: number;
  shortBreakDuration?: number;
  longBreakDuration?: number;
}

interface DurationConfig {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  longBreakInterval: number;
}

interface TimerStoreState extends PersistedTimerState, DurationConfig {
  remainingSeconds: number;
  progressPercentage: number;
  isAlarmActive: boolean;
  alarmPeriodName: string | null;
  // Actions
  start: () => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  reset: () => Promise<void>;
  skip: () => Promise<void>;
  pauseAlarm: () => void;
  setMode: (mode: FocusMode) => Promise<void>;
  setSubject: (subject: string) => void;
  setCustomDurations: (input: CustomDurationInput) => Promise<Settings>;
  resetDefaults: () => Promise<Settings>;
  applySettings: (
    settings: Pick<
      Settings,
      'focusDuration' | 'shortBreakDuration' | 'longBreakDuration'
    > & { longBreakInterval?: number }
  ) => void;
  setLinkedTask: (
    taskId: string | null,
    taskTitle: string | null,
    subject?: string,
    estimatedMinutes?: number | null,
    initialLoggedMinutes?: number,
    initialCompletedRounds?: number
  ) => Promise<void>;
  syncTick: () => Promise<void>;
  initialize: () => Promise<void>;
}

function generateClientSessionId(): string {
  return `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function sanitizeTaskCompletedRounds(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      normalized[key] = Math.floor(value);
    }
  }
  return normalized;
}

function pickPersistedState(state: PersistedTimerState): PersistedTimerState {
  return {
    mode: state.mode,
    status: state.status,
    endsAt: state.endsAt,
    startedAt: state.startedAt,
    totalDurationSeconds: state.totalDurationSeconds,
    pausedRemainingSeconds: state.pausedRemainingSeconds,
    completedRounds: state.completedRounds,
    subject: state.subject,
    taskId: state.taskId,
    taskTitle: state.taskTitle,
    taskTotalDurationMinutes: state.taskTotalDurationMinutes,
    taskFocusMinutesLogged: state.taskFocusMinutesLogged,
    currentRound: state.currentRound,
    totalRounds: state.totalRounds,
    isTaskComplete: state.isTaskComplete,
    clientSessionId: state.clientSessionId,
    taskCompletedRoundsById: state.taskCompletedRoundsById,
  };
}

/**
 * Resolves the reliable completed-round baseline for a linked task.
 * When an entry already exists in `taskCompletedRoundsById` (including `0`), it is authoritative.
 *
 * For legacy restored state lacking per-task history, aggregate `taskFocusMinutesLogged` cannot
 * mathematically prove how many historical rounds were completed vs. skipped early. As a safe,
 * conservative heuristic, this caps legacy `completedRounds` by
 * `Math.floor(taskFocusMinutesLogged / focusDuration)`:
 * - May undercount if `focusDuration` was later increased (e.g., 25m -> 45m).
 * - May overcount if multiple partial skips combined to reach `>= focusDuration`.
 */
function resolveLegacyTaskBaseline(
  state: Pick<
    PersistedTimerState,
    'taskId' | 'completedRounds' | 'taskFocusMinutesLogged' | 'taskCompletedRoundsById'
  >,
  focusDuration: number
): number {
  if (!state.taskId) return 0;
  const existing = state.taskCompletedRoundsById[state.taskId];
  if (existing !== undefined) return existing;
  const conservativeLoggedRounds = Math.floor(
    Math.max(0, state.taskFocusMinutesLogged) / Math.max(1, focusDuration)
  );
  return Math.max(0, Math.min(state.completedRounds, conservativeLoggedRounds));
}

function computeCompletedRoundCounters(
  state: Pick<
    PersistedTimerState,
    'taskId' | 'completedRounds' | 'taskFocusMinutesLogged' | 'taskCompletedRoundsById'
  >,
  focusDuration: number
): { nextCompletedRounds: number; nextTaskCompletedRoundsById: Record<string, number> } {
  if (state.taskId) {
    const prevReliable = resolveLegacyTaskBaseline(state, focusDuration);
    const nextReliable = prevReliable + 1;
    return {
      nextCompletedRounds: nextReliable,
      nextTaskCompletedRoundsById: {
        ...state.taskCompletedRoundsById,
        [state.taskId]: nextReliable,
      },
    };
  }
  return {
    nextCompletedRounds: state.completedRounds + 1,
    nextTaskCompletedRoundsById: state.taskCompletedRoundsById,
  };
}

function loadPersistedState(): PersistedTimerState {
  try {
    const rawStr = localStorage.getItem(TIMER_STORAGE_KEY);
    if (rawStr) {
      const raw = JSON.parse(rawStr) as Partial<PersistedTimerState>;
      const hasTask = Boolean(raw.taskTotalDurationMinutes && raw.taskTotalDurationMinutes > 0);
      const completedRounds =
        typeof raw.completedRounds === 'number' && Number.isFinite(raw.completedRounds)
          ? Math.max(0, Math.floor(raw.completedRounds))
          : 0;
      return {
        mode: raw.mode || 'focus',
        status: raw.status || 'idle',
        endsAt: raw.endsAt ?? null,
        startedAt: raw.startedAt ?? null,
        totalDurationSeconds: raw.totalDurationSeconds ?? 25 * 60,
        pausedRemainingSeconds: raw.pausedRemainingSeconds ?? 25 * 60,
        completedRounds,
        subject: raw.subject || 'General',
        taskId: raw.taskId ?? null,
        taskTitle: raw.taskTitle ?? null,
        taskTotalDurationMinutes: raw.taskTotalDurationMinutes ?? null,
        taskFocusMinutesLogged: raw.taskFocusMinutesLogged ?? 0,
        currentRound: hasTask
          ? raw.currentRound ?? 1
          : (completedRounds % FIXED_LONG_BREAK_INTERVAL) + 1,
        totalRounds: hasTask
          ? raw.totalRounds ?? FIXED_LONG_BREAK_INTERVAL
          : FIXED_LONG_BREAK_INTERVAL,
        isTaskComplete: raw.isTaskComplete ?? false,
        clientSessionId: raw.clientSessionId ?? null,
        taskCompletedRoundsById: sanitizeTaskCompletedRounds(raw.taskCompletedRoundsById),
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
    totalRounds: FIXED_LONG_BREAK_INTERVAL,
    isTaskComplete: false,
    clientSessionId: null,
    taskCompletedRoundsById: {},
  };
}

function saveState(state: PersistedTimerState): void {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save timer state:', err);
  }
}

function pickDurationConfig(
  settings: Pick<
    Settings,
    'focusDuration' | 'shortBreakDuration' | 'longBreakDuration'
  > & { longBreakInterval?: number }
): DurationConfig {
  return {
    focusDuration: settings.focusDuration || TIMER_DURATION_LIMITS.focus.default,
    shortBreakDuration: settings.shortBreakDuration || TIMER_DURATION_LIMITS.shortBreak.default,
    longBreakDuration: settings.longBreakDuration || TIMER_DURATION_LIMITS.longBreak.default,
    // Long break interval is fixed at 5 focus rounds
    longBreakInterval: FIXED_LONG_BREAK_INTERVAL,
  };
}

function getDurationForMode(mode: FocusMode, config: DurationConfig): number {
  switch (mode) {
    case 'focus':
      return config.focusDuration * 60;
    case 'short-break':
      return config.shortBreakDuration * 60;
    case 'long-break':
      return config.longBreakDuration * 60;
  }
}

function computeIdleModeState(
  state: Pick<
    PersistedTimerState,
    'taskTotalDurationMinutes' | 'taskFocusMinutesLogged' | 'completedRounds'
  >,
  mode: FocusMode,
  config: DurationConfig
) {
  const plan = calculateTaskRoundPlan(
    state.taskTotalDurationMinutes,
    state.taskFocusMinutesLogged,
    state.completedRounds,
    config.focusDuration,
    config.longBreakInterval
  );
  const totalDurationSeconds =
    mode === 'focus' ? plan.currentRoundDurationMinutes * 60 : getDurationForMode(mode, config);

  return { plan, totalDurationSeconds };
}

/**
 * Resolves the next mode, round plan, and duration after a focus or break period completes/skips.
 * Ensures breaks are skipped after a linked task's final round completes.
 */
function resolveNextSessionAfterCompletion(
  state: Pick<PersistedTimerState, 'mode' | 'taskTotalDurationMinutes'>,
  config: DurationConfig,
  nextTaskFocusMinutesLogged: number,
  nextCompletedRounds: number,
  didCompleteFocusRound: boolean = true
) {
  const plan = calculateTaskRoundPlan(
    state.taskTotalDurationMinutes,
    nextTaskFocusMinutesLogged,
    nextCompletedRounds,
    config.focusDuration,
    config.longBreakInterval
  );

  let nextMode: FocusMode;
  let nextDurationSeconds: number;

  if (state.mode === 'focus') {
    if (plan.isTaskComplete) {
      nextMode = 'focus';
      nextDurationSeconds = 0;
    } else if (
      didCompleteFocusRound &&
      nextCompletedRounds > 0 &&
      nextCompletedRounds % config.longBreakInterval === 0
    ) {
      nextMode = 'long-break';
      nextDurationSeconds = config.longBreakDuration * 60;
    } else {
      nextMode = 'short-break';
      nextDurationSeconds = config.shortBreakDuration * 60;
    }
  } else {
    nextMode = 'focus';
    nextDurationSeconds = plan.currentRoundDurationMinutes * 60;
  }

  return { plan, nextMode, nextDurationSeconds };
}

// In-flight mutex to avoid duplicate session records during async network calls
let isRecordingSession = false;
let lastAlarmEndsAt: number | null = null;

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
    focusDuration: TIMER_DURATION_LIMITS.focus.default,
    shortBreakDuration: TIMER_DURATION_LIMITS.shortBreak.default,
    longBreakDuration: TIMER_DURATION_LIMITS.longBreak.default,
    longBreakInterval: FIXED_LONG_BREAK_INTERVAL,
    remainingSeconds: initialCalc.remainingSeconds,
    progressPercentage: initialCalc.progressPercentage,
    isAlarmActive: false,
    alarmPeriodName: null,

    initialize: async () => {
      const persisted = loadPersistedState();
      const calc = calculateRemainingSeconds(
        persisted.endsAt,
        persisted.totalDurationSeconds,
        persisted.status !== 'running',
        persisted.pausedRemainingSeconds
      );

      const settings = await getSettingsService().get();
      const config = pickDurationConfig(settings);

      // Seed reliable baseline and reconcile completedRounds once when restoring legacy
      // persisted task state lacking per-task history (preserve active countdown fields unchanged).
      let migratedPersisted = persisted;
      if (persisted.taskId && persisted.taskCompletedRoundsById[persisted.taskId] === undefined) {
        const baseline = resolveLegacyTaskBaseline(persisted, config.focusDuration);
        migratedPersisted = {
          ...persisted,
          completedRounds: baseline,
          taskCompletedRoundsById: {
            ...persisted.taskCompletedRoundsById,
            [persisted.taskId]: baseline,
          },
        };
        if (
          migratedPersisted.status !== 'idle' &&
          migratedPersisted.taskTotalDurationMinutes &&
          migratedPersisted.taskTotalDurationMinutes > 0
        ) {
          const plan = calculateTaskRoundPlan(
            migratedPersisted.taskTotalDurationMinutes,
            migratedPersisted.taskFocusMinutesLogged,
            baseline,
            config.focusDuration,
            config.longBreakInterval
          );
          migratedPersisted = {
            ...migratedPersisted,
            currentRound: plan.currentRound,
            totalRounds: plan.totalRounds,
            isTaskComplete: plan.isTaskComplete,
          };
        }
        saveState(migratedPersisted);
      }

      if (migratedPersisted.status === 'idle') {
        const { plan, totalDurationSeconds } = computeIdleModeState(
          migratedPersisted,
          migratedPersisted.mode,
          config
        );
        set({
          ...migratedPersisted,
          ...config,
          totalDurationSeconds,
          pausedRemainingSeconds: totalDurationSeconds,
          remainingSeconds: totalDurationSeconds,
          currentRound: plan.currentRound,
          totalRounds: plan.totalRounds,
          isTaskComplete: plan.isTaskComplete,
          progressPercentage: 0,
        });
      } else {
        const hasTask = Boolean(
          migratedPersisted.taskTotalDurationMinutes &&
            migratedPersisted.taskTotalDurationMinutes > 0
        );
        set({
          ...migratedPersisted,
          ...config,
          ...(hasTask
            ? {}
            : {
                totalRounds: FIXED_LONG_BREAK_INTERVAL,
                currentRound: (migratedPersisted.completedRounds % FIXED_LONG_BREAK_INTERVAL) + 1,
              }),
          remainingSeconds: calc.remainingSeconds,
          progressPercentage: calc.progressPercentage,
        });
      }
    },

    applySettings: (settings) => {
      const state = get();
      const config = pickDurationConfig(settings);

      // Preserve active (running or paused) session countdown and round plan unchanged;
      // updated durations apply to the next session automatically.
      if (state.status !== 'idle') {
        set({ ...config });
        return;
      }

      const { plan, totalDurationSeconds } = computeIdleModeState(state, state.mode, config);
      const updated: PersistedTimerState = {
        ...pickPersistedState(state),
        totalDurationSeconds,
        pausedRemainingSeconds: totalDurationSeconds,
        currentRound: plan.currentRound,
        totalRounds: plan.totalRounds,
        isTaskComplete: plan.isTaskComplete,
      };
      saveState(updated);
      set({
        ...updated,
        ...config,
        remainingSeconds: totalDurationSeconds,
        progressPercentage: 0,
      });
    },

    setCustomDurations: async (input) => {
      const validated: CustomDurationInput = {};

      if (input.focusDuration !== undefined) {
        const res = validateDurationMinutes(
          input.focusDuration,
          TIMER_DURATION_LIMITS.focus.min,
          TIMER_DURATION_LIMITS.focus.max
        );
        if (!res.valid) throw new Error(res.error);
        validated.focusDuration = res.value;
      }

      if (input.shortBreakDuration !== undefined) {
        const res = validateDurationMinutes(
          input.shortBreakDuration,
          TIMER_DURATION_LIMITS.shortBreak.min,
          TIMER_DURATION_LIMITS.shortBreak.max
        );
        if (!res.valid) throw new Error(res.error);
        validated.shortBreakDuration = res.value;
      }

      if (input.longBreakDuration !== undefined) {
        const res = validateDurationMinutes(
          input.longBreakDuration,
          TIMER_DURATION_LIMITS.longBreak.min,
          TIMER_DURATION_LIMITS.longBreak.max
        );
        if (!res.valid) throw new Error(res.error);
        validated.longBreakDuration = res.value;
      }

      const updatedSettings = await getSettingsService().update(validated);
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      get().applySettings(updatedSettings);
      return updatedSettings;
    },

    resetDefaults: async () => {
      const updatedSettings = await getSettingsService().update({
        focusDuration: TIMER_DURATION_LIMITS.focus.default,
        shortBreakDuration: TIMER_DURATION_LIMITS.shortBreak.default,
        longBreakDuration: TIMER_DURATION_LIMITS.longBreak.default,
        longBreakInterval: FIXED_LONG_BREAK_INTERVAL,
      });
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      get().applySettings(updatedSettings);
      return updatedSettings;
    },

    pauseAlarm: () => {
      alarmService.stop();
      set({
        isAlarmActive: false,
        alarmPeriodName: null,
      });
      document.title = 'FocusForge — Student Study Planner';
    },

    start: async () => {
      const state = get();
      if (state.isTaskComplete && state.mode === 'focus') return;

      lastAlarmEndsAt = null;
      if (state.isAlarmActive) {
        alarmService.stop();
      }
      alarmService.unlock();

      const now = Date.now();
      const secondsToRun =
        state.status === 'paused' ? state.pausedRemainingSeconds : state.totalDurationSeconds;
      const endsAt = now + secondsToRun * 1000;
      const startedAt = state.startedAt || new Date(now).toISOString();
      const clientSessionId = state.clientSessionId || generateClientSessionId();

      const updatedPersisted: PersistedTimerState = {
        ...pickPersistedState(state),
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
        isAlarmActive: false,
        alarmPeriodName: null,
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
        ...pickPersistedState(state),
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
      lastAlarmEndsAt = null;
      if (state.isAlarmActive) {
        alarmService.stop();
      }
      const settings = await getSettingsService().get();
      const config = pickDurationConfig(settings);
      const { plan, totalDurationSeconds: total } = computeIdleModeState(
        state,
        state.mode,
        config
      );

      const updated: PersistedTimerState = {
        ...pickPersistedState(state),
        status: 'idle',
        endsAt: null,
        startedAt: null,
        clientSessionId: null,
        totalDurationSeconds: total,
        pausedRemainingSeconds: total,
        currentRound: plan.currentRound,
        totalRounds: plan.totalRounds,
        isTaskComplete: plan.isTaskComplete,
      };

      saveState(updated);
      set({
        ...updated,
        ...config,
        remainingSeconds: total,
        progressPercentage: 0,
        isAlarmActive: false,
        alarmPeriodName: null,
      });

      document.title = 'FocusForge — Student Study Planner';
    },

    skip: async () => {
      const state = get();
      lastAlarmEndsAt = null;
      if (state.isAlarmActive) {
        alarmService.stop();
      }
      if (isRecordingSession) return;
      isRecordingSession = true;

      try {
        // Calculate actual elapsed seconds
        const currentRemaining =
          state.status === 'running' && state.endsAt !== null
            ? Math.max(0, Math.ceil((state.endsAt - Date.now()) / 1000))
            : state.pausedRemainingSeconds;
        const elapsedSeconds = Math.max(0, state.totalDurationSeconds - currentRemaining);
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);

        const isFullFocusRoundCompleted =
          state.mode === 'focus' &&
          state.totalDurationSeconds > 0 &&
          elapsedSeconds >= state.totalDurationSeconds;

        let nextTaskFocusMinutesLogged = state.taskFocusMinutesLogged;
        let nextCompletedRounds = state.completedRounds;
        let nextTaskCompletedRoundsById = state.taskCompletedRoundsById;

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
        }

        // Obtain the latest duration configuration after any awaited session creation
        const latestSettings = await getSettingsService().get();
        const latestConfig = pickDurationConfig(latestSettings);

        // Only advance completed rounds and reliable history if the full planned focus round elapsed;
        // partial or zero-duration skips must not inflate completed rounds or advance the long-break cycle.
        if (isFullFocusRoundCompleted) {
          ({ nextCompletedRounds, nextTaskCompletedRoundsById } = computeCompletedRoundCounters(
            state,
            latestConfig.focusDuration
          ));
        }

        const { plan, nextMode, nextDurationSeconds } = resolveNextSessionAfterCompletion(
          state,
          latestConfig,
          nextTaskFocusMinutesLogged,
          nextCompletedRounds,
          isFullFocusRoundCompleted
        );

        const updated: PersistedTimerState = {
          ...pickPersistedState(state),
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
          taskCompletedRoundsById: nextTaskCompletedRoundsById,
        };

        saveState(updated);
        set({
          ...updated,
          ...latestConfig,
          remainingSeconds: nextDurationSeconds,
          progressPercentage: 0,
          isAlarmActive: false,
          alarmPeriodName: null,
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
      lastAlarmEndsAt = null;
      if (state.isAlarmActive) {
        alarmService.stop();
      }
      const settings = await getSettingsService().get();
      const config = pickDurationConfig(settings);
      const { plan, totalDurationSeconds: total } = computeIdleModeState(state, mode, config);

      const updated: PersistedTimerState = {
        ...pickPersistedState(state),
        mode,
        status: 'idle',
        endsAt: null,
        startedAt: null,
        clientSessionId: null,
        totalDurationSeconds: total,
        pausedRemainingSeconds: total,
        currentRound: plan.currentRound,
        totalRounds: plan.totalRounds,
        isTaskComplete: plan.isTaskComplete,
      };

      saveState(updated);
      set({
        ...updated,
        ...config,
        remainingSeconds: total,
        progressPercentage: 0,
        isAlarmActive: false,
        alarmPeriodName: null,
      });

      document.title = 'FocusForge — Student Study Planner';
    },

    setSubject: (subject: string) => {
      const state = get();
      const updated = { ...pickPersistedState(state), subject };
      saveState(updated);
      set({ subject });
    },

    setLinkedTask: async (
      taskId: string | null,
      taskTitle: string | null,
      subject?: string,
      estimatedMinutes?: number | null,
      initialLoggedMinutes: number = 0,
      initialCompletedRoundsOverride?: number
    ) => {
      const state = get();
      lastAlarmEndsAt = null;
      if (state.isAlarmActive) {
        alarmService.stop();
      }
      const settings = await getSettingsService().get();
      const config = pickDurationConfig(settings);
      // Re-read latest store state after awaiting settings so concurrent syncTick()/skip()
      // updates to taskCompletedRoundsById are preserved and never overwritten.
      const latestState = get();
      const latestTaskCompletedRoundsById = latestState.taskCompletedRoundsById;
      const nextSubject = subject || (taskId ? latestState.subject : 'General');
      const taskDuration = estimatedMinutes && estimatedMinutes > 0 ? estimatedMinutes : null;

      let initialCompletedRounds: number;
      if (initialCompletedRoundsOverride !== undefined) {
        initialCompletedRounds = Math.max(0, Math.floor(initialCompletedRoundsOverride));
      } else if (taskId !== null && latestTaskCompletedRoundsById[taskId] !== undefined) {
        // Use reliable completed-round history persisted for this task
        initialCompletedRounds = Math.max(0, latestTaskCompletedRoundsById[taskId]);
      } else if (
        taskId !== null &&
        latestState.taskId === taskId &&
        latestState.completedRounds > 0
      ) {
        // Preserve active task's existing round state when relinked
        initialCompletedRounds = Math.max(0, latestState.completedRounds);
      } else if (taskDuration && initialLoggedMinutes > 0) {
        // Explicit conservative fallback when no reliable completed-round history exists:
        // estimate from logged minutes under current focusDuration without counting partial sessions.
        initialCompletedRounds = Math.floor(initialLoggedMinutes / config.focusDuration);
      } else {
        initialCompletedRounds = 0;
      }

      // Seed the task's reliable completion history when linking without an entry,
      // and never overwrite existing reliable history with a lower value.
      let nextTaskCompletedRoundsById = latestTaskCompletedRoundsById;
      if (taskId !== null) {
        const existingReliable = latestTaskCompletedRoundsById[taskId];
        const nextReliable =
          existingReliable === undefined
            ? initialCompletedRounds
            : Math.max(existingReliable, initialCompletedRounds);
        if (nextReliable !== existingReliable) {
          nextTaskCompletedRoundsById = {
            ...latestTaskCompletedRoundsById,
            [taskId]: nextReliable,
          };
        }
      }

      const plan = calculateTaskRoundPlan(
        taskDuration,
        initialLoggedMinutes,
        initialCompletedRounds,
        config.focusDuration,
        config.longBreakInterval
      );

      const initialDurationSeconds =
        latestState.mode === 'focus'
          ? plan.currentRoundDurationMinutes * 60
          : getDurationForMode(latestState.mode, config);

      const updated: PersistedTimerState = {
        ...pickPersistedState(latestState),
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
        taskCompletedRoundsById: nextTaskCompletedRoundsById,
      };

      saveState(updated);
      set({
        ...updated,
        ...config,
        remainingSeconds: initialDurationSeconds,
        progressPercentage: 0,
        isAlarmActive: false,
        alarmPeriodName: null,
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
        // Prevent duplicate alarms if this timer endsAt was already processed
        if (lastAlarmEndsAt !== null && lastAlarmEndsAt === state.endsAt) {
          return;
        }
        lastAlarmEndsAt = state.endsAt;
        isRecordingSession = true;
        try {
          const settings = await getSettingsService().get();
          const config = pickDurationConfig(settings);

          const completedMode = state.mode;
          let completedPeriodName: string;
          if (completedMode === 'focus') {
            completedPeriodName = state.taskTitle
              ? `${state.taskTitle} (Focus Session)`
              : `${state.subject} Focus Session`;
          } else if (completedMode === 'short-break') {
            completedPeriodName = 'Short Break';
          } else {
            completedPeriodName = 'Long Break';
          }

          // Trigger continuous audible alarm if enabled
          const isAlarmEnabled = settings.alarmEnabled ?? settings.soundEnabled ?? true;
          const alarmVolume = settings.alarmVolume ?? settings.soundVolume ?? 70;
          const alarmSound = settings.alarmSound || 'chime';

          if (isAlarmEnabled) {
            alarmService.play({ sound: alarmSound, volume: alarmVolume });
          } else if (settings.soundEnabled) {
            playChime(settings.soundVolume);
          }

          let nextTaskFocusMinutesLogged = state.taskFocusMinutesLogged;
          let nextCompletedRounds = state.completedRounds;
          let nextTaskCompletedRoundsById = state.taskCompletedRoundsById;

          let latestConfig = config;

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

              // Refresh duration configuration after session creation resolves so concurrent
              // settings updates during the async write are preserved and used for the next period.
              const refreshedSettings = await getSettingsService().get();
              latestConfig = pickDurationConfig(refreshedSettings);
            }

            ({ nextCompletedRounds, nextTaskCompletedRoundsById } = computeCompletedRoundCounters(
              state,
              latestConfig.focusDuration
            ));
          }

          // 3. Calculate plan after this round completes
          const { plan, nextMode, nextDurationSeconds } = resolveNextSessionAfterCompletion(
            state,
            latestConfig,
            nextTaskFocusMinutesLogged,
            nextCompletedRounds,
            true
          );

          const updated: PersistedTimerState = {
            ...pickPersistedState(state),
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
            taskCompletedRoundsById: nextTaskCompletedRoundsById,
          };

          saveState(updated);
          set({
            ...updated,
            ...latestConfig,
            remainingSeconds: nextDurationSeconds,
            progressPercentage: 0,
            isAlarmActive: isAlarmEnabled,
            alarmPeriodName: isAlarmEnabled ? completedPeriodName : null,
          });

          document.title = isAlarmEnabled
            ? `Time's up! · ${completedPeriodName} · FocusForge`
            : plan.isTaskComplete
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

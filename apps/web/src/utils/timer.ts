import type { FocusMode } from '@focusforge/shared';

export interface TimerRemaining {
  remainingSeconds: number;
  totalSeconds: number;
  progressPercentage: number;
  isFinished: boolean;
}

/**
 * Calculates remaining seconds using timestamp difference
 * Prevents drift in background tabs or across browser restarts
 */
export function calculateRemainingSeconds(
  endsAt: number | null,
  totalSeconds: number,
  isPaused: boolean,
  pausedRemainingSeconds: number
): TimerRemaining {
  if (isPaused || endsAt === null) {
    const clamped = Math.max(0, pausedRemainingSeconds);
    const progress = totalSeconds > 0 ? ((totalSeconds - clamped) / totalSeconds) * 100 : 0;
    return {
      remainingSeconds: clamped,
      totalSeconds,
      progressPercentage: Math.min(100, Math.max(0, progress)),
      isFinished: clamped <= 0,
    };
  }

  const now = Date.now();
  const diffMs = endsAt - now;
  const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));
  const progress = totalSeconds > 0 ? ((totalSeconds - remainingSeconds) / totalSeconds) * 100 : 0;

  return {
    remainingSeconds,
    totalSeconds,
    progressPercentage: Math.min(100, Math.max(0, progress)),
    isFinished: remainingSeconds <= 0,
  };
}

/**
 * Generates an array of focus session durations in minutes for a given task duration.
 * E.g. For a 180-minute task with 25-minute default sessions:
 * generates 7 sessions of 25 minutes and a final session of 5 minutes [25, 25, 25, 25, 25, 25, 25, 5].
 */
export function calculateTaskSessions(
  taskDurationMinutes: number,
  defaultSessionMinutes: number = 25
): number[] {
  if (taskDurationMinutes <= 0) return [];
  const defaultSession = Math.max(1, defaultSessionMinutes);
  const fullSessions = Math.floor(taskDurationMinutes / defaultSession);
  const remainder = taskDurationMinutes % defaultSession;

  const sessions: number[] = Array(fullSessions).fill(defaultSession);
  if (remainder > 0) {
    sessions.push(remainder);
  }
  return sessions;
}

export interface TaskRoundPlan {
  totalRounds: number;
  currentRound: number;
  currentRoundDurationMinutes: number;
  remainingTaskMinutes: number;
  isTaskComplete: boolean;
  sessions: number[];
}

/**
 * Calculates dynamic round counts, current round index, and planned duration
 * based on task duration, focus time logged so far, and completed rounds.
 */
export function calculateTaskRoundPlan(
  taskTotalMinutes: number | null | undefined,
  loggedFocusMinutes: number,
  completedRounds: number,
  defaultFocusDurationMinutes: number = 25
): TaskRoundPlan {
  const defaultDuration = Math.max(1, defaultFocusDurationMinutes);

  if (!taskTotalMinutes || taskTotalMinutes <= 0) {
    const totalRounds = 4;
    const currentRound = (completedRounds % totalRounds) + 1;
    return {
      totalRounds,
      currentRound,
      currentRoundDurationMinutes: defaultDuration,
      remainingTaskMinutes: 0,
      isTaskComplete: false,
      sessions: Array(totalRounds).fill(defaultDuration),
    };
  }

  const allSessions = calculateTaskSessions(taskTotalMinutes, defaultDuration);
  const impliedCompletedRounds =
    loggedFocusMinutes > 0 ? Math.floor(loggedFocusMinutes / defaultDuration) : 0;
  const effectiveCompletedRounds = Math.max(completedRounds, impliedCompletedRounds);

  const remainingTaskMinutes = Math.max(0, taskTotalMinutes - loggedFocusMinutes);

  if (remainingTaskMinutes <= 0) {
    const totalRounds = Math.max(effectiveCompletedRounds, allSessions.length);
    return {
      totalRounds,
      currentRound: totalRounds,
      currentRoundDurationMinutes: 0,
      remainingTaskMinutes: 0,
      isTaskComplete: true,
      sessions: allSessions,
    };
  }

  // Calculate remaining sessions needed based on remaining focus minutes
  const remainingSessions = calculateTaskSessions(remainingTaskMinutes, defaultDuration);
  const totalRounds = effectiveCompletedRounds + remainingSessions.length;
  const currentRound = effectiveCompletedRounds + 1;
  const currentRoundDurationMinutes = remainingSessions[0] || defaultDuration;

  return {
    totalRounds,
    currentRound,
    currentRoundDurationMinutes,
    remainingTaskMinutes,
    isTaskComplete: false,
    sessions: remainingSessions,
  };
}

/**
 * Determines the next mode and round count after a cycle finishes or skips
 */
export function getNextTimerCycle(
  currentMode: FocusMode,
  completedFocusRounds: number,
  longBreakInterval: number,
  isTaskComplete: boolean = false
): { nextMode: FocusMode; nextRounds: number } {
  if (isTaskComplete) {
    return { nextMode: 'focus', nextRounds: completedFocusRounds };
  }

  if (currentMode === 'focus') {
    const newRounds = completedFocusRounds + 1;
    if (newRounds % longBreakInterval === 0) {
      return { nextMode: 'long-break', nextRounds: newRounds };
    }
    return { nextMode: 'short-break', nextRounds: newRounds };
  } else {
    // Both short-break and long-break lead back to focus
    return { nextMode: 'focus', nextRounds: completedFocusRounds };
  }
}

/**
 * Formats countdown for document title e.g. "24:13 · Focus"
 */
export function formatTitleCountdown(remainingSeconds: number, mode: FocusMode): string {
  const mins = Math.floor(remainingSeconds / 60);
  const secs = remainingSeconds % 60;
  const time = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  const modeLabels: Record<FocusMode, string> = {
    focus: 'Focus',
    'short-break': 'Short Break',
    'long-break': 'Long Break',
  };

  return `${time} · ${modeLabels[mode]}`;
}

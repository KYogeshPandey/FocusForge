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
 * Determines the next mode and round count after a cycle finishes or skips
 */
export function getNextTimerCycle(
  currentMode: FocusMode,
  completedFocusRounds: number,
  longBreakInterval: number
): { nextMode: FocusMode; nextRounds: number } {
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

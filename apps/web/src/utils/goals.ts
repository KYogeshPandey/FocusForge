import { isWithinInterval, parseISO } from 'date-fns';
import type { FocusSession } from '@focusforge/shared';
import { getWeekDateRange } from './dates.js';

export interface GoalProgressResult {
  targetMinutes: number;
  completedMinutes: number;
  percentage: number;
  remainingMinutes: number;
  isCompleted: boolean;
  sessionsCount: number;
}

/**
 * Calculates weekly goal progress strictly from recorded focus sessions within the week
 */
export function calculateWeeklyGoalProgress(
  targetMinutes: number,
  sessions: FocusSession[],
  referenceDate: Date = new Date(),
  weekStartsOnMonday: boolean = true
): GoalProgressResult {
  const { startDate, endDate } = getWeekDateRange(referenceDate, weekStartsOnMonday);

  // Only focus sessions (not breaks) within the current week interval count
  const thisWeekSessions = sessions.filter((s) => {
    if (s.mode !== 'focus') return false;
    const sessionDate = parseISO(s.startedAt);
    return isWithinInterval(sessionDate, { start: startDate, end: endDate });
  });

  const completedMinutes = Math.round(
    thisWeekSessions.reduce((acc, s) => acc + s.durationMinutes, 0)
  );

  const percentage = targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;
  const remainingMinutes = Math.max(0, targetMinutes - completedMinutes);
  const isCompleted = completedMinutes >= targetMinutes;

  return {
    targetMinutes,
    completedMinutes,
    percentage,
    remainingMinutes,
    isCompleted,
    sessionsCount: thisWeekSessions.length,
  };
}

import { format, subDays, parseISO, isSameDay } from 'date-fns';
import type { HabitCompletion } from '@focusforge/shared';

export interface HabitStreakResult {
  currentStreak: number;
  bestStreak: number;
  completedToday: boolean;
  completionRate7d: number;
}

/**
 * Calculates streak metrics for a specific habit according to business rules:
 * - A streak counts consecutive days with a completion
 * - Today does not break a streak until the day ends
 */
export function calculateHabitStreak(
  habitId: string,
  completions: HabitCompletion[],
  referenceDate: Date = new Date()
): HabitStreakResult {
  const habitCompletions = completions.filter((c) => c.habitId === habitId && c.completed);
  const completionDates = new Set(habitCompletions.map((c) => c.date));

  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  const completedToday = completionDates.has(todayStr);

  // Calculate current streak
  let currentStreak = 0;
  // If completed today, we start checking from today backward.
  // If NOT completed today, today doesn't break the streak yet, so we check from yesterday backward.
  let checkDate = completedToday ? referenceDate : subDays(referenceDate, 1);
  
  while (true) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    if (completionDates.has(dateStr)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Calculate best streak across all history
  // Sort distinct completed dates chronologically
  const sortedDates = Array.from(completionDates).sort();
  let bestStreak = 0;
  let runningStreak = 0;
  let lastDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const currentDate = parseISO(dateStr);
    if (!lastDate) {
      runningStreak = 1;
    } else {
      // Check if this date is exactly 1 day after lastDate
      const nextExpected = subDays(currentDate, 1);
      if (isSameDay(nextExpected, lastDate)) {
        runningStreak++;
      } else {
        runningStreak = 1;
      }
    }
    lastDate = currentDate;
    if (runningStreak > bestStreak) {
      bestStreak = runningStreak;
    }
  }

  // Best streak must at least be equal to current streak
  bestStreak = Math.max(bestStreak, currentStreak);

  // Calculate 7-day completion rate
  let completedPast7 = 0;
  for (let i = 0; i < 7; i++) {
    const dStr = format(subDays(referenceDate, i), 'yyyy-MM-dd');
    if (completionDates.has(dStr)) {
      completedPast7++;
    }
  }
  const completionRate7d = Math.round((completedPast7 / 7) * 100);

  return {
    currentStreak,
    bestStreak,
    completedToday,
    completionRate7d,
  };
}

/**
 * Calculates global activity streak (days with focus session or habit completion)
 */
export function calculateOverallStreak(
  activeDates: Set<string>,
  referenceDate: Date = new Date()
): { currentStreak: number; bestStreak: number } {
  const todayStr = format(referenceDate, 'yyyy-MM-dd');
  const completedToday = activeDates.has(todayStr);

  let currentStreak = 0;
  let checkDate = completedToday ? referenceDate : subDays(referenceDate, 1);

  while (true) {
    const dateStr = format(checkDate, 'yyyy-MM-dd');
    if (activeDates.has(dateStr)) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      break;
    }
  }

  // Best streak
  const sorted = Array.from(activeDates).sort();
  let bestStreak = 0;
  let running = 0;
  let last: Date | null = null;

  for (const dStr of sorted) {
    const curr = parseISO(dStr);
    if (!last) {
      running = 1;
    } else {
      const prev = subDays(curr, 1);
      if (isSameDay(prev, last)) {
        running++;
      } else {
        running = 1;
      }
    }
    last = curr;
    if (running > bestStreak) {
      bestStreak = running;
    }
  }

  bestStreak = Math.max(bestStreak, currentStreak);

  return { currentStreak, bestStreak };
}

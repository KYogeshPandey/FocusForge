import { format, subDays, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import type { FocusSession, Task, Habit, HabitCompletion } from '@focusforge/shared';

export interface DailyStudyStat {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Mon" or "Oct 24"
  minutes: number;
  hours: number;
  sessionsCount: number;
}

export interface SubjectStudyStat {
  subject: string;
  minutes: number;
  hours: number;
  percentage: number;
  color: string;
}

export interface TaskMetrics {
  total: number;
  completed: number;
  inProgress: number;
  todo: number;
  overdue: number;
  completionRate: number; // 0 - 100
}

export interface HabitConsistencyStat {
  habitId: string;
  title: string;
  category: string;
  color: string;
  totalDays: number;
  completedDays: number;
  percentage: number;
}

const SUBJECT_COLORS = [
  '#8B5CF6', // primary purple
  '#3B82F6', // secondary blue
  '#22C55E', // green
  '#F59E0B', // amber
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#F97316', // orange
];

/**
 * Aggregates daily focus study time for the selected period (7, 30, 90 days)
 */
export function aggregateStudyMinutesByDay(
  sessions: FocusSession[],
  daysCount: number,
  referenceDate: Date = new Date()
): DailyStudyStat[] {
  const result: DailyStudyStat[] = [];
  const sessionMap = new Map<string, { minutes: number; count: number }>();

  // Filter only focus mode
  for (const session of sessions) {
    if (session.mode !== 'focus') continue;
    const dateStr = session.startedAt.slice(0, 10);
    const prev = sessionMap.get(dateStr) || { minutes: 0, count: 0 };
    sessionMap.set(dateStr, {
      minutes: prev.minutes + session.durationMinutes,
      count: prev.count + 1,
    });
  }

  // Generate days in chronological order
  for (let i = daysCount - 1; i >= 0; i--) {
    const d = subDays(referenceDate, i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const label = daysCount === 7 ? format(d, 'EEE') : format(d, 'MMM d');
    const stat = sessionMap.get(dateStr) || { minutes: 0, count: 0 };
    
    result.push({
      date: dateStr,
      label,
      minutes: Math.round(stat.minutes),
      hours: Number((stat.minutes / 60).toFixed(1)),
      sessionsCount: stat.count,
    });
  }

  return result;
}

/**
 * Aggregates study minutes grouped by subject within a given time range
 */
export function aggregateTimeBySubject(
  sessions: FocusSession[],
  daysCount: number,
  referenceDate: Date = new Date()
): SubjectStudyStat[] {
  const startDate = startOfDay(subDays(referenceDate, daysCount - 1));
  const endDate = endOfDay(referenceDate);

  const subjectMap = new Map<string, number>();
  let totalMinutes = 0;

  for (const session of sessions) {
    if (session.mode !== 'focus') continue;
    const sessionTime = parseISO(session.startedAt);
    if (isWithinInterval(sessionTime, { start: startDate, end: endDate })) {
      const subject = session.subject || 'General';
      const prev = subjectMap.get(subject) || 0;
      subjectMap.set(subject, prev + session.durationMinutes);
      totalMinutes += session.durationMinutes;
    }
  }

  if (totalMinutes === 0) return [];

  const sorted = Array.from(subjectMap.entries()).sort((a, b) => b[1] - a[1]);

  return sorted.map(([subject, minutes], index) => {
    const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length] || '#8B5CF6';
    return {
      subject,
      minutes: Math.round(minutes),
      hours: Number((minutes / 60).toFixed(1)),
      percentage: Math.round((minutes / totalMinutes) * 100),
      color,
    };
  });
}

/**
 * Computes task completion rate and counts
 */
export function calculateTaskMetrics(tasks: Task[]): TaskMetrics {
  const total = tasks.length;
  if (total === 0) {
    return { total: 0, completed: 0, inProgress: 0, todo: 0, overdue: 0, completionRate: 0 };
  }

  let completed = 0;
  let inProgress = 0;
  let todo = 0;
  let overdue = 0;
  const today = startOfDay(new Date());

  for (const task of tasks) {
    if (task.status === 'done') {
      completed++;
    } else {
      if (task.status === 'in-progress') inProgress++;
      if (task.status === 'todo') todo++;

      if (task.dueDate) {
        const due = startOfDay(parseISO(task.dueDate));
        if (due < today) {
          overdue++;
        }
      }
    }
  }

  const completionRate = Math.round((completed / total) * 100);

  return {
    total,
    completed,
    inProgress,
    todo,
    overdue,
    completionRate,
  };
}

/**
 * Aggregates habit consistency over the past N days
 */
export function aggregateHabitConsistency(
  habits: Habit[],
  completions: HabitCompletion[],
  daysCount: number,
  referenceDate: Date = new Date()
): { overallRate: number; habitStats: HabitConsistencyStat[] } {
  const activeHabits = habits.filter((h) => h.active);
  if (activeHabits.length === 0 || daysCount === 0) {
    return { overallRate: 0, habitStats: [] };
  }

  const startDate = startOfDay(subDays(referenceDate, daysCount - 1));
  const endDate = endOfDay(referenceDate);

  let totalPossible = activeHabits.length * daysCount;
  let totalCompleted = 0;

  const habitStats: HabitConsistencyStat[] = activeHabits.map((habit) => {
    const habitComps = completions.filter((c) => {
      if (c.habitId !== habit.id || !c.completed) return false;
      const compDate = parseISO(c.date);
      return isWithinInterval(compDate, { start: startDate, end: endDate });
    });

    const completedDays = habitComps.length;
    totalCompleted += completedDays;
    const percentage = Math.round((completedDays / daysCount) * 100);

    return {
      habitId: habit.id,
      title: habit.title,
      category: habit.category,
      color: habit.color,
      totalDays: daysCount,
      completedDays,
      percentage,
    };
  });

  const overallRate = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;

  return {
    overallRate,
    habitStats,
  };
}

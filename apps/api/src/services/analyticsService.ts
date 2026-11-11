import { FocusSession } from '../models/FocusSession.js';
import { Task } from '../models/Task.js';
import { Habit } from '../models/Habit.js';
import { HabitCompletion } from '../models/HabitCompletion.js';
import { Goal } from '../models/Goal.js';
import { Types } from 'mongoose';

const SUBJECT_COLORS = [
  '#8B5CF6',
  '#3B82F6',
  '#22C55E',
  '#F59E0B',
  '#EC4899',
  '#14B8A6',
  '#6366F1',
  '#F97316',
];

export interface AnalyticsSummaryResult {
  rangeDays: number;
  dailyStudyStats: Array<{
    date: string;
    label: string;
    minutes: number;
    hours: number;
    sessionsCount: number;
  }>;
  subjectStudyStats: Array<{
    subject: string;
    minutes: number;
    hours: number;
    percentage: number;
    color: string;
  }>;
  taskMetrics: {
    total: number;
    completed: number;
    inProgress: number;
    todo: number;
    overdue: number;
    completionRate: number;
  };
  habitConsistency: {
    overallRate: number;
    habitStats: Array<{
      habitId: string;
      title: string;
      category: string;
      color: string;
      totalDays: number;
      completedDays: number;
      percentage: number;
    }>;
  };
  streaks: {
    currentStreak: number;
    bestStreak: number;
  };
  weeklyGoalProgress: {
    targetMinutes: number;
    completedMinutes: number;
    percentage: number;
    remainingMinutes: number;
    isCompleted: boolean;
    sessionsCount: number;
  };
}

export class AnalyticsService {
  async getSummary(userId: string, rangeDays = 7): Promise<AnalyticsSummaryResult> {
    const userObjectId = new Types.ObjectId(userId);
    const now = new Date();

    // 1. Fetch data for this user
    const [tasks, habits, completions, focusSessions, goal] = await Promise.all([
      Task.find({ userId: userObjectId }),
      Habit.find({ userId: userObjectId }),
      HabitCompletion.find({ userId: userObjectId, completed: true }),
      FocusSession.find({ userId: userObjectId, mode: 'focus' }),
      Goal.findOne({ userId: userObjectId }),
    ]);

    // Format helpers
    const formatDate = (d: Date) => d.toISOString().slice(0, 10);
    const subDays = (d: Date, days: number) => new Date(d.getTime() - days * 86400000);

    // 2. Daily Study Stats for range
    const sessionDateMap = new Map<string, { minutes: number; count: number }>();
    for (const session of focusSessions) {
      const dStr = session.startedAt.slice(0, 10);
      const prev = sessionDateMap.get(dStr) || { minutes: 0, count: 0 };
      sessionDateMap.set(dStr, {
        minutes: prev.minutes + session.durationMinutes,
        count: prev.count + 1,
      });
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const dailyStudyStats = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = subDays(now, i);
      const dateStr = formatDate(d);
      const label = rangeDays === 7 ? dayNames[d.getDay()]! : `${monthNames[d.getMonth()]} ${d.getDate()}`;
      const stat = sessionDateMap.get(dateStr) || { minutes: 0, count: 0 };

      dailyStudyStats.push({
        date: dateStr,
        label,
        minutes: Math.round(stat.minutes),
        hours: Number((stat.minutes / 60).toFixed(1)),
        sessionsCount: stat.count,
      });
    }

    // 3. Subject breakdown in range
    const rangeStartDateStr = formatDate(subDays(now, rangeDays - 1));
    const rangeEndDateStr = formatDate(now);

    const subjectMap = new Map<string, number>();
    let totalRangeMinutes = 0;

    for (const session of focusSessions) {
      const sessionDateStr = session.startedAt.slice(0, 10);
      if (sessionDateStr >= rangeStartDateStr && sessionDateStr <= rangeEndDateStr) {
        const sub = session.subject || 'General';
        subjectMap.set(sub, (subjectMap.get(sub) || 0) + session.durationMinutes);
        totalRangeMinutes += session.durationMinutes;
      }
    }

    const subjectStudyStats = Array.from(subjectMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([subject, minutes], index) => ({
        subject,
        minutes: Math.round(minutes),
        hours: Number((minutes / 60).toFixed(1)),
        percentage: totalRangeMinutes > 0 ? Math.round((minutes / totalRangeMinutes) * 100) : 0,
        color: SUBJECT_COLORS[index % SUBJECT_COLORS.length] || '#8B5CF6',
      }));

    // 4. Task Metrics
    const totalTasks = tasks.length;
    let completedTasks = 0;
    let inProgressTasks = 0;
    let todoTasks = 0;
    let overdueTasks = 0;
    const todayStr = formatDate(now);

    for (const task of tasks) {
      if (task.status === 'done') {
        completedTasks++;
      } else {
        if (task.status === 'in-progress') inProgressTasks++;
        if (task.status === 'todo') todoTasks++;
        if (task.dueDate && task.dueDate < todayStr) {
          overdueTasks++;
        }
      }
    }

    const taskMetrics = {
      total: totalTasks,
      completed: completedTasks,
      inProgress: inProgressTasks,
      todo: todoTasks,
      overdue: overdueTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    };

    // 5. Habit Consistency
    const activeHabits = habits.filter((h) => h.active);
    let totalCompletedHabits = 0;
    const totalPossibleHabits = activeHabits.length * rangeDays;

    const habitStats = activeHabits.map((h) => {
      const habitIdStr = h._id.toString();
      const count = completions.filter(
        (c) =>
          c.habitId.toString() === habitIdStr &&
          c.date >= rangeStartDateStr &&
          c.date <= rangeEndDateStr
      ).length;

      totalCompletedHabits += count;
      const percentage = rangeDays > 0 ? Math.round((count / rangeDays) * 100) : 0;

      return {
        habitId: habitIdStr,
        title: h.title,
        category: h.category,
        color: h.color,
        totalDays: rangeDays,
        completedDays: count,
        percentage,
      };
    });

    const habitConsistency = {
      overallRate:
        totalPossibleHabits > 0
          ? Math.round((totalCompletedHabits / totalPossibleHabits) * 100)
          : 0,
      habitStats,
    };

    // 6. Streaks (Global Activity: days with focus session or habit completion)
    const activeDates = new Set<string>();
    for (const s of focusSessions) {
      activeDates.add(s.startedAt.slice(0, 10));
    }
    for (const c of completions) {
      activeDates.add(c.date);
    }

    const completedToday = activeDates.has(todayStr);
    let currentStreak = 0;
    let checkDate = completedToday ? now : subDays(now, 1);

    while (true) {
      const dStr = formatDate(checkDate);
      if (activeDates.has(dStr)) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    const sortedDates = Array.from(activeDates).sort();
    let bestStreak = 0;
    let runningStreak = 0;
    let lastDate: Date | null = null;

    for (const dStr of sortedDates) {
      const curr = new Date(dStr + 'T00:00:00Z');
      if (!lastDate) {
        runningStreak = 1;
      } else {
        const diffDays = Math.round((curr.getTime() - lastDate.getTime()) / 86400000);
        if (diffDays === 1) {
          runningStreak++;
        } else {
          runningStreak = 1;
        }
      }
      lastDate = curr;
      if (runningStreak > bestStreak) {
        bestStreak = runningStreak;
      }
    }
    bestStreak = Math.max(bestStreak, currentStreak);

    // 7. Weekly Goal Progress (Monday to Sunday)
    const targetMinutes = goal?.targetMinutesWeekly || 600;
    // Calculate start of current week (Monday)
    const currentDayOfWeek = now.getDay(); // 0 is Sun, 1 is Mon...
    const diffToMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const mondayStr = formatDate(monday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const sundayStr = formatDate(sunday);

    const thisWeekSessions = focusSessions.filter((s) => {
      const dStr = s.startedAt.slice(0, 10);
      return dStr >= mondayStr && dStr <= sundayStr;
    });

    const completedMinutes = Math.round(
      thisWeekSessions.reduce((acc, s) => acc + s.durationMinutes, 0)
    );
    const goalPercentage =
      targetMinutes > 0 ? Math.min(100, Math.round((completedMinutes / targetMinutes) * 100)) : 0;

    const weeklyGoalProgress = {
      targetMinutes,
      completedMinutes,
      percentage: goalPercentage,
      remainingMinutes: Math.max(0, targetMinutes - completedMinutes),
      isCompleted: completedMinutes >= targetMinutes,
      sessionsCount: thisWeekSessions.length,
    };

    return {
      rangeDays,
      dailyStudyStats,
      subjectStudyStats,
      taskMetrics,
      habitConsistency,
      streaks: {
        currentStreak,
        bestStreak,
      },
      weeklyGoalProgress,
    };
  }
}

export const analyticsService = new AnalyticsService();

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../stores/useAuthStore';
import { apiClient } from '../services/api/apiClient';
import { useFocusSessions } from './useFocusSessions';
import { useTasks } from './useTasks';
import { useHabits, useHabitCompletions } from './useHabits';
import { useGoal } from './useGoals';
import {
  aggregateStudyMinutesByDay,
  aggregateTimeBySubject,
  calculateTaskMetrics,
  aggregateHabitConsistency,
  type DailyStudyStat,
  type SubjectStudyStat,
  type TaskMetrics,
  type HabitConsistencyStat,
} from '../utils/analytics';
import { calculateOverallStreak } from '../utils/streaks';

export interface AnalyticsSummaryData {
  rangeDays: number;
  dailyStudyStats: DailyStudyStat[];
  subjectStudyStats: SubjectStudyStat[];
  taskMetrics: TaskMetrics;
  habitConsistency: {
    overallRate: number;
    habitStats: HabitConsistencyStat[];
  };
  streaks: {
    currentStreak: number;
    bestStreak: number;
  };
  weeklyGoalProgress: {
    targetMinutes: number;
    completedMinutes: number;
    percentage: number;
  };
}

export function useAnalyticsSummary(range: '7' | '30' | '90') {
  const { status, user } = useAuthStore();
  const isAuthenticated = status === 'authenticated';
  const scope = isAuthenticated && user?.id ? user.id : 'guest';

  // Guest mode dependencies
  const { data: focusSessions = [] } = useFocusSessions();
  const { data: tasks = [] } = useTasks();
  const { data: habits = [] } = useHabits();
  const { data: completions = [] } = useHabitCompletions();
  const { data: goal } = useGoal();

  return useQuery({
    queryKey: ['analytics_summary', scope, range],
    queryFn: async (): Promise<AnalyticsSummaryData> => {
      if (isAuthenticated) {
        return apiClient.get<AnalyticsSummaryData>(`/analytics/summary?range=${range}`);
      }

      // Guest / Local calculation
      const daysCount = Number(range);
      const dailyStats = aggregateStudyMinutesByDay(focusSessions, daysCount);
      const subjectStats = aggregateTimeBySubject(focusSessions, daysCount);
      const tMetrics = calculateTaskMetrics(tasks);
      const hConsistency = aggregateHabitConsistency(habits, completions, daysCount);
      const activeDates = new Set<string>();
      focusSessions.forEach((s) => activeDates.add(s.startedAt.slice(0, 10)));
      const streakInfo = calculateOverallStreak(activeDates);

      const targetMinutes = goal?.targetMinutesWeekly || 900;
      // Last 7 days study minutes for weekly goal progress
      const last7DaysStats = aggregateStudyMinutesByDay(focusSessions, 7);
      const completedMinutes = last7DaysStats.reduce((acc, d) => acc + d.minutes, 0);
      const percentage = Math.min(100, Math.round((completedMinutes / targetMinutes) * 100));

      return {
        rangeDays: daysCount,
        dailyStudyStats: dailyStats,
        subjectStudyStats: subjectStats,
        taskMetrics: tMetrics,
        habitConsistency: hConsistency,
        streaks: streakInfo,
        weeklyGoalProgress: {
          targetMinutes,
          completedMinutes,
          percentage,
        },
      };
    },
    // Keep local computation responsive when sessions/tasks/habits change in guest mode
    enabled: true,
  });
}

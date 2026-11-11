import { useState, useMemo } from 'react';
import { useAnalyticsSummary } from '../hooks/useAnalyticsSummary';
import { Tabs } from '../components/ui/Tabs';
import { StudyTimeBarChart } from '../components/charts/StudyTimeBarChart';
import { SubjectDonutChart } from '../components/charts/SubjectDonutChart';
import { TaskCompletionChart } from '../components/charts/TaskCompletionChart';
import { HabitConsistencyChart } from '../components/charts/HabitConsistencyChart';
import { formatDuration } from '../utils/dates';
import { StatCard } from '../components/ui/StatCard';
import { Clock, BookOpen, CheckSquare, Flame, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';

type RangeOption = '7' | '30' | '90';

export default function AnalyticsPage() {
  const [range, setRange] = useState<RangeOption>('7');
  const { data: summary, isLoading, isError, refetch } = useAnalyticsSummary(range);

  const daysCount = Number(range);

  const dailyStudyStats = useMemo(() => summary?.dailyStudyStats || [], [summary?.dailyStudyStats]);
  const subjectStats = useMemo(() => summary?.subjectStudyStats || [], [summary?.subjectStudyStats]);
  const taskMetrics = summary?.taskMetrics || {
    total: 0,
    completed: 0,
    inProgress: 0,
    todo: 0,
    overdue: 0,
    completionRate: 0,
  };
  const habitConsistency = summary?.habitConsistency || {
    overallRate: 0,
    habitStats: [],
  };

  // Total minutes in range
  const totalMinutesInRange = useMemo(() => {
    return dailyStudyStats.reduce((acc, d) => acc + d.minutes, 0);
  }, [dailyStudyStats]);

  // Daily average in range
  const dailyAverageMinutes = useMemo(() => {
    return Math.round(totalMinutesInRange / daysCount);
  }, [totalMinutesInRange, daysCount]);

  if (isError) {
    return (
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="p-8 bg-surface border border-border rounded-card text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-danger mx-auto" />
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-text">Failed to load analytics</h2>
            <p className="text-xs text-text-muted">
              We encountered an issue fetching your study metrics.
            </p>
          </div>
          <Button onClick={() => refetch()} variant="secondary" className="gap-2 mx-auto">
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header with Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Analytics
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Data-driven insights into your study habits, subjects, and completion rates.
          </p>
        </div>

        {/* 7 / 30 / 90 Days Range Tabs */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-muted">Timeframe:</span>
          <Tabs<RangeOption>
            tabs={[
              { id: '7', label: 'Last 7 Days' },
              { id: '30', label: 'Last 30 Days' },
              { id: '90', label: 'Last 90 Days' },
            ]}
            activeTab={range}
            onChange={setRange}
          />
        </div>
      </div>

      {/* Summary Stat Cards for this range */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Study Time"
          value={isLoading ? '...' : formatDuration(totalMinutesInRange)}
          icon={<Clock className="w-5 h-5" />}
          subtitle={`${(totalMinutesInRange / 60).toFixed(1)} hours logged`}
          iconBgColor="bg-primary-soft text-primary"
        />

        <StatCard
          label="Daily Average"
          value={isLoading ? '...' : formatDuration(dailyAverageMinutes)}
          icon={<BookOpen className="w-5 h-5" />}
          subtitle={`Across ${daysCount} days`}
          iconBgColor="bg-secondary/15 text-secondary"
        />

        <StatCard
          label="Task Completion"
          value={isLoading ? '...' : `${taskMetrics.completionRate}%`}
          icon={<CheckSquare className="w-5 h-5" />}
          subtitle={`${taskMetrics.completed} of ${taskMetrics.total} tasks done`}
          iconBgColor="bg-success/15 text-success"
        />

        <StatCard
          label="Habit Consistency"
          value={isLoading ? '...' : `${habitConsistency.overallRate}%`}
          icon={<Flame className="w-5 h-5 fill-current" />}
          subtitle={`Over past ${daysCount} days`}
          iconBgColor="bg-warning/15 text-warning"
        />
      </div>

      {/* Row 1 Charts: Daily Study Activity + Subject Time Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7">
          <StudyTimeBarChart
            data={dailyStudyStats}
            title={`Daily Study Minutes (${daysCount} Days)`}
            insight={`Average of ${formatDuration(dailyAverageMinutes)} per day.`}
          />
        </div>
        <div className="lg:col-span-5">
          <SubjectDonutChart
            data={subjectStats}
            title="Time Distribution by Subject"
          />
        </div>
      </div>

      {/* Row 2 Charts: Task Metrics + Habit Consistency Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskCompletionChart metrics={taskMetrics} />
        <HabitConsistencyChart
          stats={habitConsistency.habitStats}
          overallRate={habitConsistency.overallRate}
        />
      </div>
    </div>
  );
}

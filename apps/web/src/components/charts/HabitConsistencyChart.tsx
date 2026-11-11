import { Flame } from 'lucide-react';
import type { HabitConsistencyStat } from '../../utils/analytics';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

export interface HabitConsistencyChartProps {
  stats: HabitConsistencyStat[];
  overallRate: number;
}

export function HabitConsistencyChart({ stats, overallRate }: HabitConsistencyChartProps) {
  const hasData = stats.length > 0;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div>
          <CardTitle>Habit Consistency</CardTitle>
          <CardDescription>
            {overallRate}% average daily routine adherence.
          </CardDescription>
        </div>
        <div className="w-8 h-8 rounded-button bg-warning/15 text-warning flex items-center justify-center">
          <Flame className="w-4 h-4" />
        </div>
      </CardHeader>

      {!hasData ? (
        <EmptyState
          icon={<Flame className="w-6 h-6" />}
          title="No habit statistics available"
          description="Create and check off habits to measure your routine consistency."
        />
      ) : (
        <div className="space-y-3.5 my-2">
          {stats.map((habit) => (
            <div key={habit.habitId} className="space-y-1">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className="text-text truncate">{habit.title}</span>
                </div>
                <span className="tabular-nums text-text-muted shrink-0 ml-2">
                  {habit.completedDays} / {habit.totalDays}d ({habit.percentage}%)
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-normal"
                  style={{
                    width: `${habit.percentage}%`,
                    backgroundColor: habit.color || 'var(--primary)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

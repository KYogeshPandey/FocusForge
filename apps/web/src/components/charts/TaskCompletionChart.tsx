import { CheckSquare } from 'lucide-react';
import type { TaskMetrics } from '../../utils/analytics';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';

export interface TaskCompletionChartProps {
  metrics: TaskMetrics;
}

export function TaskCompletionChart({ metrics }: TaskCompletionChartProps) {
  const { total, completed, inProgress, todo, overdue, completionRate } = metrics;

  return (
    <Card className="flex flex-col justify-between">
      <CardHeader>
        <div>
          <CardTitle>Task Completion</CardTitle>
          <CardDescription>
            {completionRate}% of assignments and tasks completed.
          </CardDescription>
        </div>
        <div className="w-8 h-8 rounded-button bg-success/15 text-success flex items-center justify-center">
          <CheckSquare className="w-4 h-4" />
        </div>
      </CardHeader>

      <div className="space-y-4 my-2">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold text-text mb-1.5">
            <span>Overall Progress</span>
            <span className="tabular-nums font-bold text-success">{completionRate}%</span>
          </div>
          <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden flex">
            <div
              className="bg-success transition-all duration-normal"
              style={{ width: `${completionRate}%` }}
              title={`Completed: ${completed}`}
            />
            <div
              className="bg-secondary transition-all duration-normal"
              style={{ width: total > 0 ? `${(inProgress / total) * 100}%` : '0%' }}
              title={`In Progress: ${inProgress}`}
            />
            <div
              className="bg-warning transition-all duration-normal"
              style={{ width: total > 0 ? `${(todo / total) * 100}%` : '0%' }}
              title={`To Do: ${todo}`}
            />
          </div>
        </div>

        {/* Detailed Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
          <div className="p-2.5 bg-surface-2/60 rounded-button text-center">
            <div className="text-base font-bold text-success tabular-nums">{completed}</div>
            <div className="text-[11px] text-text-muted mt-0.5">Completed</div>
          </div>
          <div className="p-2.5 bg-surface-2/60 rounded-button text-center">
            <div className="text-base font-bold text-secondary tabular-nums">{inProgress}</div>
            <div className="text-[11px] text-text-muted mt-0.5">In Progress</div>
          </div>
          <div className="p-2.5 bg-surface-2/60 rounded-button text-center">
            <div className="text-base font-bold text-text tabular-nums">{todo}</div>
            <div className="text-[11px] text-text-muted mt-0.5">To Do</div>
          </div>
          <div className="p-2.5 bg-surface-2/60 rounded-button text-center">
            <div className="text-base font-bold text-danger tabular-nums">{overdue}</div>
            <div className="text-[11px] text-text-muted mt-0.5">Overdue</div>
          </div>
        </div>
      </div>
    </Card>
  );
}

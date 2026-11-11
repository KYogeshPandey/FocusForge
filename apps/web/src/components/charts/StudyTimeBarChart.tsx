import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Table, BarChart2 } from 'lucide-react';
import type { DailyStudyStat } from '../../utils/analytics';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

export interface StudyTimeBarChartProps {
  data: DailyStudyStat[];
  title?: string;
  insight?: string;
}

export function StudyTimeBarChart({
  data,
  title = 'Study Time',
  insight,
}: StudyTimeBarChartProps) {
  const [showTable, setShowTable] = useState(false);

  const totalMinutes = data.reduce((acc, d) => acc + d.minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const defaultInsight = insight || `Total of ${totalHours} hours recorded in this period.`;

  const hasData = totalMinutes > 0;

  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{defaultInsight}</CardDescription>
        </div>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          aria-label={showTable ? 'Switch to chart view' : 'Switch to accessible table view'}
          className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          {showTable ? (
            <>
              <BarChart2 className="w-4 h-4" />
              <span className="hidden sm:inline">Chart</span>
            </>
          ) : (
            <>
              <Table className="w-4 h-4" />
              <span className="hidden sm:inline">Data table</span>
            </>
          )}
        </button>
      </CardHeader>

      {!hasData ? (
        <EmptyState
          icon={<BarChart2 className="w-6 h-6" />}
          title="No study sessions recorded yet"
          description="Complete your first focus timer interval to see your study time charted here."
        />
      ) : showTable ? (
        /* Accessible Table Alternative */
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Daily Study Time Breakdown</caption>
            <thead className="border-b border-border text-text-muted">
              <tr>
                <th scope="col" className="pb-2 font-semibold">Date</th>
                <th scope="col" className="pb-2 font-semibold">Minutes</th>
                <th scope="col" className="pb-2 font-semibold">Hours</th>
                <th scope="col" className="pb-2 font-semibold">Sessions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((row) => (
                <tr key={row.date} className="hover:bg-surface-2/40">
                  <td className="py-2 font-medium text-text">{row.label} ({row.date})</td>
                  <td className="py-2 text-text-muted tabular-nums">{row.minutes}m</td>
                  <td className="py-2 text-text-muted tabular-nums">{row.hours}h</td>
                  <td className="py-2 text-text-muted tabular-nums">{row.sessionsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        /* Recharts Interactive Bar Chart */
        <div role="region" className="w-full h-64 sm:h-72 mt-2" aria-label="Study Time Bar Chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="var(--text-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--text-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}m`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0]?.payload as DailyStudyStat;
                    return (
                      <div className="bg-surface border border-border rounded-button p-2.5 shadow-modal text-xs">
                        <div className="font-semibold text-text mb-1">
                          {item.label} ({item.date})
                        </div>
                        <div className="text-primary font-bold">
                          {item.minutes} mins ({item.hours} hrs)
                        </div>
                        <div className="text-[10px] text-text-muted mt-0.5">
                          {item.sessionsCount} focus {item.sessionsCount === 1 ? 'block' : 'blocks'}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar
                dataKey="minutes"
                fill="var(--primary)"
                radius={[6, 6, 0, 0]}
                maxBarSize={38}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

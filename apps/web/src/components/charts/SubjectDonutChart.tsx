import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Table, PieChart as PieIcon } from 'lucide-react';
import type { SubjectStudyStat } from '../../utils/analytics';
import { Card, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';

export interface SubjectDonutChartProps {
  data: SubjectStudyStat[];
  title?: string;
  insight?: string;
}

export function SubjectDonutChart({
  data,
  title = 'Time by Subject',
  insight,
}: SubjectDonutChartProps) {
  const [showTable, setShowTable] = useState(false);

  const topSubject = data[0];
  const defaultInsight =
    insight ||
    (topSubject
      ? `Most time dedicated to ${topSubject.subject} (${topSubject.percentage}%).`
      : 'Subject time distribution across recorded sessions.');

  const hasData = data.length > 0;

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
          aria-label={showTable ? 'Switch to donut chart' : 'Switch to subject table view'}
          className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors flex items-center gap-1.5 text-xs font-medium"
        >
          {showTable ? (
            <>
              <PieIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Donut</span>
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
          icon={<PieIcon className="w-6 h-6" />}
          title="No subject data available"
          description="Log or complete focus sessions with subjects to see time breakdown."
        />
      ) : showTable ? (
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left text-xs">
            <caption className="sr-only">Subject Time Breakdown</caption>
            <thead className="border-b border-border text-text-muted">
              <tr>
                <th scope="col" className="pb-2 font-semibold">Subject</th>
                <th scope="col" className="pb-2 font-semibold">Duration</th>
                <th scope="col" className="pb-2 font-semibold">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {data.map((row) => (
                <tr key={row.subject} className="hover:bg-surface-2/40">
                  <td className="py-2 flex items-center gap-2 font-medium text-text">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                    {row.subject}
                  </td>
                  <td className="py-2 text-text-muted tabular-nums">
                    {row.minutes}m ({row.hours}h)
                  </td>
                  <td className="py-2 text-text-muted tabular-nums font-semibold">
                    {row.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-2">
          {/* Donut Graphic */}
          <div className="w-48 h-48 relative shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0]?.payload as SubjectStudyStat;
                      return (
                        <div className="bg-surface border border-border rounded-button p-2 shadow-modal text-xs">
                          <span className="font-semibold text-text">{item.subject}</span>:{' '}
                          <span className="font-bold">{item.minutes}m</span> ({item.percentage}%)
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Pie
                  data={data}
                  dataKey="minutes"
                  nameKey="subject"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {data.map((entry) => (
                    <Cell key={entry.subject} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Details */}
          <div className="flex-1 space-y-2 w-full max-h-52 overflow-y-auto">
            {data.map((item) => (
              <div
                key={item.subject}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-button bg-surface-2/40"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-text truncate">{item.subject}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 tabular-nums">
                  <span className="text-text-muted">{item.hours}h</span>
                  <span className="font-bold text-text w-8 text-right">{item.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

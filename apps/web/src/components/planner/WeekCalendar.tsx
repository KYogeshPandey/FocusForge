import { format, isSameDay } from 'date-fns';
import type { StudySession } from '@focusforge/shared';
import { formatDuration } from '../../utils/dates';
import { cn } from '../../utils/cn';

export interface WeekCalendarProps {
  days: Date[];
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  sessions: StudySession[];
  onEditSession: (s: StudySession) => void;
}

export function WeekCalendar({
  days,
  selectedDate,
  onSelectDate,
  sessions,
  onEditSession,
}: WeekCalendarProps) {
  const today = new Date();

  return (
    <div className="bg-surface border border-border rounded-card p-4 overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[650px]">
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSelected = isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);

          const daySessions = sessions
            .filter((s) => s.date === dateStr)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(day)}
              className={cn(
                'flex flex-col rounded-card p-2.5 transition-all min-h-[160px] cursor-pointer border',
                isSelected
                  ? 'bg-surface-2 border-primary ring-1 ring-primary'
                  : 'bg-surface border-border hover:border-text-subtle/50'
              )}
            >
              {/* Day header */}
              <div className="flex items-center justify-between pb-2 border-b border-border/60 mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase">
                  {format(day, 'EEE')}
                </span>
                <span
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
                    isToday
                      ? 'bg-primary-btn text-white'
                      : isSelected
                      ? 'text-primary font-bold'
                      : 'text-text'
                  )}
                >
                  {format(day, 'd')}
                </span>
              </div>

              {/* Day session blocks */}
              <div className="flex-1 space-y-1.5 overflow-y-auto">
                {daySessions.map((sess) => (
                  <div
                    key={sess.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSession(sess);
                    }}
                    className={cn(
                      'p-1.5 rounded-[6px] text-left text-xs transition-all border leading-tight select-none',
                      sess.status === 'completed'
                        ? 'bg-success/15 border-success/30 text-success line-through'
                        : sess.status === 'skipped'
                        ? 'bg-surface-2 border-border/60 text-text-subtle'
                        : 'bg-primary-soft border-primary/30 text-text hover:border-primary'
                    )}
                    title={`${sess.startTime} - ${sess.title} (${sess.subject})`}
                  >
                    <div className="font-semibold truncate text-[11px]">{sess.title}</div>
                    <div className="text-[10px] text-text-muted flex items-center justify-between mt-0.5">
                      <span>{sess.startTime}</span>
                      <span>{formatDuration(sess.durationMinutes)}</span>
                    </div>
                  </div>
                ))}
                {daySessions.length === 0 && (
                  <div className="h-full flex items-center justify-center text-[10px] text-text-subtle italic">
                    Free day
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

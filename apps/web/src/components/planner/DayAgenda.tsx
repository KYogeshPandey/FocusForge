import { Plus, Calendar } from 'lucide-react';
import type { StudySession } from '@focusforge/shared';
import { SessionCard } from './SessionCard';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/EmptyState';
import { formatDuration } from '../../utils/dates';

export interface DayAgendaProps {
  dateStr: string;
  sessions: StudySession[];
  onAddSession: () => void;
  onEditSession: (session: StudySession) => void;
}

export function DayAgenda({
  sessions,
  onAddSession,
  onEditSession,
}: DayAgendaProps) {
  // Sort chronologically by startTime
  const sorted = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const totalMinutes = sorted.reduce((acc, s) => acc + s.durationMinutes, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text">Scheduled Sessions</h3>
          <p className="text-xs text-text-muted mt-0.5">
            {sorted.length} {sorted.length === 1 ? 'block' : 'blocks'} · Total:{' '}
            <span className="font-semibold text-text">{formatDuration(totalMinutes)}</span>
          </p>
        </div>
        <Button size="sm" onClick={onAddSession} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Schedule Session
        </Button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-6 h-6" />}
          title="No study blocks scheduled for this day"
          description="Plan your study intervals ahead of time to stay focused and beat procrastination."
          actionLabel="Schedule Focus Block"
          onAction={onAddSession}
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              onEdit={onEditSession}
            />
          ))}
        </div>
      )}
    </div>
  );
}

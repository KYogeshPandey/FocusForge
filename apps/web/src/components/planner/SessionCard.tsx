import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Play, CheckCircle2, XCircle, Pencil, Trash2 } from 'lucide-react';
import type { StudySession } from '@focusforge/shared';
import { formatDuration } from '../../utils/dates';
import { useUpdateStudySession, useDeleteStudySession } from '../../hooks/useStudySessions';
import { useTimerStore } from '../../stores/useTimerStore';
import { useToastStore } from '../../stores/useToastStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../utils/cn';

export interface SessionCardProps {
  session: StudySession;
  onEdit: (session: StudySession) => void;
}

export function SessionCard({ session, onEdit }: SessionCardProps) {
  const navigate = useNavigate();
  const updateMutation = useUpdateStudySession();
  const deleteMutation = useDeleteStudySession();
  const { setLinkedTask, setMode, reset } = useTimerStore();
  const { addToast } = useToastStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isCompleted = session.status === 'completed';
  const isSkipped = session.status === 'skipped';

  const handleStartFocus = () => {
    // Pre-fill timer with this session's title & subject, then navigate to /timer
    reset();
    setMode('focus');
    setLinkedTask(session.taskId || null, session.title, session.subject);
    addToast({
      type: 'info',
      title: 'Timer Ready',
      message: `Timer pre-filled for "${session.title}". Click Start to begin focusing.`,
    });
    navigate('/timer');
  };

  const handleStatusChange = (newStatus: StudySession['status']) => {
    updateMutation.mutate({
      id: session.id,
      patch: { status: newStatus },
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(session.id);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        className={cn(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface border border-border rounded-card hover:border-text-subtle/50 transition-colors',
          isCompleted && 'bg-surface/90 border-border/70',
          isSkipped && 'border-dashed border-text-subtle/40'
        )}
      >
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-2.5 h-10 rounded-full bg-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4
                className={cn(
                  'text-sm font-semibold text-text truncate',
                  isCompleted && 'line-through text-text-muted',
                  isSkipped && 'italic text-text-subtle'
                )}
              >
                {session.title}
              </h4>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-text-muted font-medium border border-border shrink-0">
                {session.subject}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted mt-1.5">
              <span className="flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5" />
                {session.startTime} ({formatDuration(session.durationMinutes)})
              </span>
              {session.notes && (
                <span className="text-text-subtle truncate max-w-xs">{session.notes}</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
          {/* Status Quick Buttons */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleStatusChange(isCompleted ? 'scheduled' : 'completed')}
              title={isCompleted ? 'Mark as scheduled' : 'Mark as completed'}
              aria-label="Toggle completed"
              className={cn(
                'p-1.5 rounded-button transition-colors',
                isCompleted
                  ? 'text-success bg-success/15'
                  : 'text-text-muted hover:text-success hover:bg-surface-2'
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleStatusChange(isSkipped ? 'scheduled' : 'skipped')}
              title={isSkipped ? 'Unskip session' : 'Skip session'}
              aria-label="Toggle skipped"
              className={cn(
                'p-1.5 rounded-button transition-colors',
                isSkipped
                  ? 'text-warning bg-warning/15'
                  : 'text-text-muted hover:text-warning hover:bg-surface-2'
              )}
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          {/* Start Focus shortcut button */}
          {!isCompleted && !isSkipped && (
            <button
              type="button"
              onClick={handleStartFocus}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-primary-soft text-primary hover:bg-primary hover:text-white rounded-button transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Start Focus</span>
            </button>
          )}

          {/* Edit / Delete */}
          <div className="flex items-center gap-1 ml-1">
            <button
              type="button"
              onClick={() => onEdit(session)}
              aria-label={`Edit session "${session.title}"`}
              className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label={`Delete session "${session.title}"`}
              className="p-1.5 text-text-muted hover:text-danger rounded-button hover:bg-surface-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Planned Session"
        message={`Are you sure you want to remove "${session.title}" from your study schedule?`}
        confirmLabel="Delete"
      />
    </>
  );
}

import { useState } from 'react';
import { Clock, Calendar, Pencil, Trash2 } from 'lucide-react';
import type { Task } from '@focusforge/shared';
import { PriorityBadge } from '../ui/Badge';
import { formatDisplayDate, isOverdue, formatDuration } from '../../utils/dates';
import { useToggleTask, useDeleteTask } from '../../hooks/useTasks';
import { useToastStore } from '../../stores/useToastStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../utils/cn';

export interface TaskItemProps {
  task: Task;
  onEdit: (task: Task) => void;
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const toggleMutation = useToggleTask();
  const deleteMutation = useDeleteTask();
  const { addToast } = useToastStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isDone = task.status === 'done';
  const overdue = isOverdue(task.dueDate, isDone);

  const handleToggle = () => {
    toggleMutation.mutate(task.id);
  };

  const handleDelete = () => {
    const deletedTask = { ...task };
    deleteMutation.mutate(task.id, {
      onSuccess: () => {
        addToast({
          type: 'info',
          title: 'Task deleted',
          message: `"${task.title}" has been deleted.`,
          action: {
            label: 'Undo',
            onClick: () => {
              // Re-create the task
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { id, createdAt, updatedAt, ...rest } = deletedTask;
              // using taskService create
              import('../../services/taskService').then(({ taskService }) => {
                taskService.create(rest).then(() => {
                  window.location.reload();
                });
              });
            },
          },
        });
      },
    });
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div
        className={cn(
          'group flex items-start gap-3.5 p-3.5 sm:p-4 bg-surface border border-border rounded-card transition-all duration-fast hover:border-text-subtle/50',
          isDone && 'opacity-65 bg-surface/50'
        )}
      >
        {/* Toggle Checkbox */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={toggleMutation.isPending}
          aria-label={isDone ? `Mark "${task.title}" as incomplete` : `Mark "${task.title}" as complete`}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-[6px] border transition-colors flex items-center justify-center shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isDone
              ? 'bg-success border-success text-white'
              : 'border-border bg-surface-2 hover:border-primary text-transparent'
          )}
        >
          <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        {/* Task Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <span
              className={cn(
                'text-sm font-medium text-text leading-snug break-words transition-all',
                isDone && 'line-through text-text-muted'
              )}
            >
              {task.title}
            </span>

            {/* Quick Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity shrink-0">
              <button
                type="button"
                onClick={() => onEdit(task)}
                aria-label={`Edit task "${task.title}"`}
                className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                aria-label={`Delete task "${task.title}"`}
                className="p-1.5 text-text-muted hover:text-danger rounded-button hover:bg-surface-2 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Badges / Chips Row */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            {/* Subject */}
            <span className="px-2 py-0.5 rounded-full bg-surface-2 text-text-muted font-medium border border-border text-[11px]">
              {task.subject}
            </span>

            {/* Priority */}
            <PriorityBadge priority={task.priority} />

            {/* Due date */}
            {task.dueDate && (
              <span
                className={cn(
                  'flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                  overdue
                    ? 'bg-danger/15 text-danger border border-danger/30'
                    : 'bg-surface-2 text-text-muted'
                )}
              >
                <Calendar className="w-3 h-3" />
                {formatDisplayDate(task.dueDate)}
                {overdue && ' (Overdue)'}
              </span>
            )}

            {/* Estimated time */}
            {task.estimatedMinutes && (
              <span className="flex items-center gap-1 text-[11px] text-text-subtle">
                <Clock className="w-3 h-3" />
                {formatDuration(task.estimatedMinutes)}
              </span>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Task"
        message={`Are you sure you want to delete "${task.title}"? You can undo this action from the notification.`}
        confirmLabel="Delete"
      />
    </>
  );
}

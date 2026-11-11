import { useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import type { Habit, HabitCompletion } from '@focusforge/shared';
import { calculateHabitStreak } from '../../utils/streaks';
import { StreakBadge } from './StreakBadge';
import { useToggleHabitCompletion, useDeleteHabit } from '../../hooks/useHabits';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { cn } from '../../utils/cn';

export interface HabitRowProps {
  habit: Habit;
  completions: HabitCompletion[];
  past7Days: { dateStr: string; label: string; isToday: boolean }[];
  onEdit: (habit: Habit) => void;
}

export function HabitRow({ habit, completions, past7Days, onEdit }: HabitRowProps) {
  const toggleMutation = useToggleHabitCompletion();
  const deleteMutation = useDeleteHabit();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const streak = calculateHabitStreak(habit.id, completions);

  const completionSet = new Set(
    completions.filter((c) => c.habitId === habit.id && c.completed).map((c) => c.date)
  );

  const handleToggle = (dateStr: string) => {
    toggleMutation.mutate({
      habitId: habit.id,
      date: dateStr,
    });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface border border-border rounded-card hover:border-text-subtle/40 transition-colors">
        {/* Habit Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-3.5 h-3.5 rounded-full shrink-0"
            style={{ backgroundColor: habit.color || 'var(--primary)' }}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-text truncate">{habit.title}</h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-surface-2 text-text-muted border border-border shrink-0">
                {habit.category}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
              <span>{streak.completionRate7d}% weekly consistency</span>
            </div>
          </div>
        </div>

        {/* Streaks & 7-Day Grid */}
        <div className="flex items-center justify-between sm:justify-end gap-5">
          <StreakBadge
            currentStreak={streak.currentStreak}
            bestStreak={streak.bestStreak}
            completedToday={streak.completedToday}
          />

          {/* 7-Day Checks */}
          <div className="flex items-center gap-2">
            {past7Days.map((day) => {
              const isCompleted = completionSet.has(day.dateStr);

              return (
                <button
                  key={day.dateStr}
                  type="button"
                  onClick={() => handleToggle(day.dateStr)}
                  disabled={toggleMutation.isPending}
                  aria-label={`${isCompleted ? 'Mark incomplete' : 'Mark complete'} for ${day.label}`}
                  className={cn(
                    'w-8 h-8 rounded-full border flex items-center justify-center transition-all select-none',
                    isCompleted
                      ? 'bg-success border-success text-white'
                      : day.isToday
                      ? 'bg-surface-2 border-primary/50 text-text hover:border-primary'
                      : 'bg-surface-2 border-border text-transparent hover:border-text-subtle'
                  )}
                  title={`${day.dateStr} (${day.label}) - ${isCompleted ? 'Completed' : 'Not completed'}`}
                >
                  <Check
                    className={cn(
                      'w-4 h-4 stroke-[2.5]',
                      isCompleted ? 'opacity-100' : 'opacity-0 hover:opacity-40 text-text-muted'
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 border-l border-border/60 pl-3">
            <button
              type="button"
              onClick={() => onEdit(habit)}
              aria-label={`Edit habit "${habit.title}"`}
              className="p-1.5 text-text-muted hover:text-text rounded-button hover:bg-surface-2 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label={`Delete habit "${habit.title}"`}
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
        onConfirm={() => {
          deleteMutation.mutate(habit.id);
          setShowDeleteConfirm(false);
        }}
        title="Delete Habit"
        message={`Are you sure you want to delete "${habit.title}"? This will remove its streak history.`}
        confirmLabel="Delete"
      />
    </>
  );
}

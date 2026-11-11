import { useState, useMemo } from 'react';
import { Plus, Flame } from 'lucide-react';
import { format, subDays } from 'date-fns';
import type { Habit } from '@focusforge/shared';
import { useHabits, useHabitCompletions } from '../hooks/useHabits';
import { HabitRow } from '../components/habits/HabitRow';
import { HabitFormModal } from '../components/habits/HabitFormModal';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

export default function HabitsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [habitToEdit, setHabitToEdit] = useState<Habit | null>(null);

  const { data: habits = [], isLoading: habitsLoading } = useHabits();
  const { data: completions = [], isLoading: completionsLoading } = useHabitCompletions();

  // Generate the last 7 calendar days ending today
  const past7Days = useMemo(() => {
    const today = new Date();
    const days: { dateStr: string; label: string; isToday: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i);
      days.push({
        dateStr: format(d, 'yyyy-MM-dd'),
        label: i === 0 ? 'Today' : format(d, 'EEE'),
        isToday: i === 0,
      });
    }
    return days;
  }, []);

  const handleEdit = (habit: Habit) => {
    setHabitToEdit(habit);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setHabitToEdit(null);
    setIsModalOpen(true);
  };

  const isLoading = habitsLoading || completionsLoading;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
            Habit Tracker
          </h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Build consistency through daily study and problem-solving habits.
          </p>
        </div>

        <Button onClick={handleCreateNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span>Add Habit</span>
        </Button>
      </div>

      {/* Habits Table / List Header */}
      {habits.length > 0 && (
        <div className="hidden sm:flex items-center justify-between px-4 text-xs font-semibold text-text-muted uppercase tracking-wider">
          <span>Habit Details</span>
          <div className="flex items-center gap-5">
            <span className="w-20 text-center">Streak</span>
            <div className="flex items-center gap-2">
              {past7Days.map((d) => (
                <span
                  key={d.dateStr}
                  className={`w-8 text-center ${d.isToday ? 'text-primary font-bold' : ''}`}
                >
                  {d.label.slice(0, 3)}
                </span>
              ))}
            </div>
            <span className="w-16 text-right">Actions</span>
          </div>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
          <Skeleton className="h-20 w-full rounded-card" />
        </div>
      ) : habits.length === 0 ? (
        <EmptyState
          icon={<Flame className="w-6 h-6" />}
          title="No habits tracked yet"
          description="Build daily discipline by tracking LeetCode problems, textbook readings, and revision blocks."
          actionLabel="Create First Habit"
          onAction={handleCreateNew}
        />
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              completions={completions}
              past7Days={past7Days}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Habit Modal */}
      <HabitFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        habitToEdit={habitToEdit}
      />
    </div>
  );
}

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HabitRow } from '../src/components/habits/HabitRow';
import { StreakBadge } from '../src/components/habits/StreakBadge';
import type { Habit, HabitCompletion } from '@focusforge/shared';
import * as habitsHooks from '../src/hooks/useHabits';

vi.mock('../src/hooks/useHabits', () => ({
  useToggleHabitCompletion: vi.fn(),
  useDeleteHabit: vi.fn(),
}));

describe('Habit Component & Streak Display', () => {
  const mockHabit: Habit = {
    id: 'habit-101',
    userId: 'user-1',
    title: 'Daily LeetCode Problem',
    category: 'study',
    frequency: 'daily',
    targetPerDay: 1,
    active: true,
    color: '#8b5cf6',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockPast7Days = [
    { dateStr: '2026-10-22', label: 'Thu', isToday: false },
    { dateStr: '2026-10-23', label: 'Fri', isToday: false },
    { dateStr: '2026-10-24', label: 'Sat', isToday: false },
    { dateStr: '2026-10-25', label: 'Sun', isToday: false },
    { dateStr: '2026-10-26', label: 'Mon', isToday: false },
    { dateStr: '2026-10-27', label: 'Tue', isToday: false },
    { dateStr: '2026-10-28', label: 'Wed', isToday: true },
  ];

  it('renders StreakBadge with flame and streak numbers', () => {
    const { rerender } = render(
      <StreakBadge currentStreak={5} bestStreak={12} completedToday={false} />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('/ 12d')).toBeInTheDocument();
    expect(screen.getByTitle(/Current streak: 5 days/i)).toBeInTheDocument();

    rerender(<StreakBadge currentStreak={6} bestStreak={12} completedToday={true} />);
    const badge = screen.getByTitle('Current streak: 6 days | Best streak: 12 days');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('text-warning');
  });

  it('renders HabitRow and triggers toggle mutation on date button click', () => {
    const mutateSpy = vi.fn();
    vi.mocked(habitsHooks.useToggleHabitCompletion).mockReturnValue({
      mutate: mutateSpy,
      isPending: false,
    } as any);

    vi.mocked(habitsHooks.useDeleteHabit).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    const completions: HabitCompletion[] = [
      {
        id: 'c-1',
        userId: 'user-1',
        habitId: 'habit-101',
        date: '2026-10-27',
        completed: true,
        createdAt: new Date().toISOString(),
      },
    ];

    render(
      <HabitRow
        habit={mockHabit}
        completions={completions}
        past7Days={mockPast7Days}
        onEdit={vi.fn()}
      />
    );

    expect(screen.getByText('Daily LeetCode Problem')).toBeInTheDocument();
    expect(screen.getByText('study')).toBeInTheDocument();

    // Find the toggle button for today (Wed)
    const todayBtn = screen.getByLabelText(/Mark complete for Wed/i);
    expect(todayBtn).toBeInTheDocument();

    fireEvent.click(todayBtn);

    expect(mutateSpy).toHaveBeenCalledWith({
      habitId: 'habit-101',
      date: '2026-10-28',
    });
  });
});

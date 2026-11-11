import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { filterAndSortTasks, groupTasks } from '../src/utils/taskFilters';
import type { Task } from '@focusforge/shared';

describe('Task Filtering and Sorting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-27T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  const mockTasks: Task[] = [
    {
      id: '1',
      userId: 'u1',
      title: 'Math Assignment 4',
      subject: 'Mathematics',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-10-27',
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '',
    },
    {
      id: '2',
      userId: 'u1',
      title: 'OS Process Scheduling',
      subject: 'Computer Science',
      priority: 'medium',
      status: 'in-progress',
      dueDate: '2026-10-30',
      createdAt: '2026-10-26T12:00:00Z',
      updatedAt: '',
    },
    {
      id: '3',
      userId: 'u1',
      title: 'Read Physics Chapter 3',
      subject: 'Physics',
      priority: 'low',
      status: 'done',
      dueDate: null,
      createdAt: '2026-10-24T09:00:00Z',
      updatedAt: '',
    },
  ];

  it('filters by search keyword in title or subject', () => {
    const res = filterAndSortTasks(mockTasks, { search: 'Scheduling' });
    expect(res.length).toBe(1);
    expect(res[0]?.id).toBe('2');

    const resSubject = filterAndSortTasks(mockTasks, { search: 'physics' });
    expect(resSubject.length).toBe(1);
    expect(resSubject[0]?.id).toBe('3');
  });

  it('filters by status and priority', () => {
    const todoOnly = filterAndSortTasks(mockTasks, { status: 'todo' });
    expect(todoOnly.length).toBe(1);
    expect(todoOnly[0]?.id).toBe('1');

    const highPriority = filterAndSortTasks(mockTasks, { priority: 'high' });
    expect(highPriority.length).toBe(1);
    expect(highPriority[0]?.id).toBe('1');
  });

  it('sorts by priority desc (high -> medium -> low)', () => {
    const res = filterAndSortTasks(mockTasks, { sortBy: 'priorityDesc' });
    expect(res[0]?.priority).toBe('high');
    expect(res[1]?.priority).toBe('medium');
    expect(res[2]?.priority).toBe('low');
  });

  it('sorts by dueDateAsc with null dates at the end', () => {
    const res = filterAndSortTasks(mockTasks, { sortBy: 'dueDateAsc' });
    expect(res[0]?.dueDate).toBe('2026-10-27');
    expect(res[1]?.dueDate).toBe('2026-10-30');
    expect(res[2]?.dueDate).toBeNull();
  });

  it('groups tasks into Today, Upcoming, No date, and Completed', () => {
    const grouped = groupTasks(mockTasks);
    // Task 3 is 'done' -> completed
    expect(grouped.completed.length).toBe(1);
    expect(grouped.completed[0]?.id).toBe('3');

    // Task 2 is due in future (2026-10-30) -> upcoming
    expect(grouped.upcoming.length).toBe(1);
    expect(grouped.upcoming[0]?.id).toBe('2');
  });
});

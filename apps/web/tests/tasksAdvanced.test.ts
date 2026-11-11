import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CreateTaskInputSchema, type Task } from '@focusforge/shared';
import { filterAndSortTasks, groupTasks } from '../src/utils/taskFilters';
import { useToastStore } from '../src/stores/useToastStore';

describe('Advanced Tasks Logic (Validation, Filters, Grouping, and Undo)', () => {
  beforeEach(() => {
    useToastStore.getState().clearToasts();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-28T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const sampleTasks: Task[] = [
    {
      id: 'task-1',
      userId: 'user-1',
      title: 'Math Assignment 4',
      subject: 'Math',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-10-28',
      createdAt: '2026-10-25T10:00:00.000Z',
      updatedAt: '2026-10-25T10:00:00.000Z',
    },
    {
      id: 'task-2',
      userId: 'user-1',
      title: 'Chemistry Lab Report',
      subject: 'Science',
      priority: 'low',
      status: 'in-progress',
      dueDate: '2026-11-05',
      createdAt: '2026-10-26T10:00:00.000Z',
      updatedAt: '2026-10-26T10:00:00.000Z',
    },
    {
      id: 'task-3',
      userId: 'user-1',
      title: 'Literature Essay',
      subject: 'English',
      priority: 'medium',
      status: 'done',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
      completedAt: '2026-10-27T10:00:00.000Z',
    },
    {
      id: 'task-4',
      userId: 'user-1',
      title: 'Random Review',
      subject: 'General',
      priority: 'medium',
      status: 'todo',
      dueDate: null,
      createdAt: '2026-10-27T10:00:00.000Z',
      updatedAt: '2026-10-27T10:00:00.000Z',
    },
  ];

  it('validates task inputs strictly via shared schema', () => {
    // Valid input
    const valid = CreateTaskInputSchema.safeParse({
      title: 'Study Chapter 5',
      subject: 'Biology',
      priority: 'medium',
      estimatedMinutes: 60,
    });
    expect(valid.success).toBe(true);

    // Rejects empty title
    const emptyTitle = CreateTaskInputSchema.safeParse({
      title: '   ',
      subject: 'Biology',
    });
    expect(emptyTitle.success).toBe(false);

    // Rejects invalid priority
    const invalidPriority = CreateTaskInputSchema.safeParse({
      title: 'Study Chapter 5',
      subject: 'Biology',
      priority: 'super-urgent',
    });
    expect(invalidPriority.success).toBe(false);
  });

  it('filters tasks by status, priority, and search keyword', () => {
    // Filter status = in-progress
    const inProgress = filterAndSortTasks(sampleTasks, { status: 'in-progress' });
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]!.title).toBe('Chemistry Lab Report');

    // Filter priority = high
    const high = filterAndSortTasks(sampleTasks, { priority: 'high' });
    expect(high).toHaveLength(1);
    expect(high[0]!.title).toBe('Math Assignment 4');

    // Search query
    const searched = filterAndSortTasks(sampleTasks, { search: 'literature' });
    expect(searched).toHaveLength(1);
    expect(searched[0]!.title).toBe('Literature Essay');
  });

  it('sorts tasks by priority descending and dueDate ascending', () => {
    const sortedByPriority = filterAndSortTasks(sampleTasks, { sortBy: 'priorityDesc' });
    expect(sortedByPriority[0]!.priority).toBe('high');
    expect(sortedByPriority[sortedByPriority.length - 1]!.priority).toBe('low');

    const sortedByDueDate = filterAndSortTasks(sampleTasks, { sortBy: 'dueDateAsc' });
    expect(sortedByDueDate[0]!.title).toBe('Math Assignment 4'); // earliest due date (2026-10-28)
  });

  it('groups tasks accurately into today/overdue, upcoming, noDate, and completed buckets', () => {
    const groups = groupTasks(sampleTasks);

    expect(groups.completed).toHaveLength(1);
    expect(groups.completed[0]!.id).toBe('task-3');

    expect(groups.noDate).toHaveLength(1);
    expect(groups.noDate[0]!.id).toBe('task-4');

    expect(groups.upcoming).toHaveLength(1);
    expect(groups.upcoming[0]!.id).toBe('task-2');
  });

  it('handles undo-delete toast flow properly', () => {
    let deletedTask: Task | null = sampleTasks[0]!;
    let restoredTask: Task | null = null;

    // Trigger delete with undo toast
    useToastStore.getState().addToast({
      type: 'info',
      title: 'Task deleted',
      message: `"${deletedTask.title}" was removed.`,
      action: {
        label: 'Undo',
        onClick: () => {
          restoredTask = deletedTask;
        },
      },
    });

    const activeToasts = useToastStore.getState().toasts;
    expect(activeToasts).toHaveLength(1);
    expect(activeToasts[0]!.action?.label).toBe('Undo');

    // Trigger undo action
    activeToasts[0]!.action?.onClick();

    expect(restoredTask).not.toBeNull();
    expect((restoredTask as unknown as Task).id).toBe('task-1');
  });
});

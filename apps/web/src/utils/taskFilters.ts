import { parseISO, startOfDay, isBefore, isSameDay } from 'date-fns';
import type { Task, TaskFilter, TaskPriority } from '@focusforge/shared';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function filterAndSortTasks(tasks: Task[], filters?: TaskFilter): Task[] {
  let result = [...tasks];

  if (!filters) return result;

  // Search filter (title or subject)
  if (filters.search && filters.search.trim() !== '') {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(
      (t) => t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    );
  }

  // Status filter
  if (filters.status && filters.status !== 'all') {
    result = result.filter((t) => t.status === filters.status);
  }

  // Priority filter
  if (filters.priority && filters.priority !== 'all') {
    result = result.filter((t) => t.priority === filters.priority);
  }

  // Subject filter
  if (filters.subject && filters.subject !== 'all' && filters.subject.trim() !== '') {
    result = result.filter((t) => t.subject === filters.subject);
  }

  // Sort
  const sortBy = filters.sortBy || 'createdAtDesc';
  result.sort((a, b) => {
    if (sortBy === 'priorityDesc') {
      return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    }
    if (sortBy === 'dueDateAsc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (sortBy === 'dueDateDesc') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return b.dueDate.localeCompare(a.dueDate);
    }
    // createdAtDesc default
    return b.createdAt.localeCompare(a.createdAt);
  });

  return result;
}

export interface GroupedTasks {
  today: Task[];
  upcoming: Task[];
  noDate: Task[];
  completed: Task[];
}

/**
 * Groups tasks into Today / Upcoming / No date / Completed
 */
export function groupTasks(tasks: Task[]): GroupedTasks {
  const todayDate = startOfDay(new Date());

  const grouped: GroupedTasks = {
    today: [],
    upcoming: [],
    noDate: [],
    completed: [],
  };

  for (const task of tasks) {
    if (task.status === 'done') {
      grouped.completed.push(task);
      continue;
    }

    if (!task.dueDate) {
      grouped.noDate.push(task);
      continue;
    }

    const taskDate = startOfDay(parseISO(task.dueDate));
    if (isSameDay(taskDate, todayDate) || isBefore(taskDate, todayDate)) {
      // Due today or overdue -> goes to Today/Overdue section
      grouped.today.push(task);
    } else {
      grouped.upcoming.push(task);
    }
  }

  return grouped;
}

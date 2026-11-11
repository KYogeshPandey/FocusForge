import { Search, SlidersHorizontal } from 'lucide-react';
import type { TaskFilter, TaskPriority, TaskStatus } from '@focusforge/shared';

export interface TaskFiltersProps {
  filters: TaskFilter;
  onChange: (filters: TaskFilter) => void;
  subjects: string[];
}

export function TaskFilters({ filters, onChange, subjects }: TaskFiltersProps) {
  return (
    <div className="flex flex-col gap-3 bg-surface p-4 border border-border rounded-card">
      <div className="flex flex-col sm:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filters.search || ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            placeholder="Search tasks by title or subject..."
            aria-label="Search tasks"
            className="w-full h-10 pl-9 pr-4 text-sm bg-surface-2 text-text border border-border rounded-input placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
        </div>

        {/* Sort */}
        <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-text-muted shrink-0 hidden sm:block" />
          <select
            value={filters.sortBy || 'createdAtDesc'}
            onChange={(e) =>
              onChange({
                ...filters,
                sortBy: e.target.value as TaskFilter['sortBy'],
              })
            }
            aria-label="Sort tasks"
            className="w-full sm:w-44 h-10 px-3 text-xs font-medium bg-surface-2 text-text border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="createdAtDesc">Newest First</option>
            <option value="dueDateAsc">Due Date (Earliest)</option>
            <option value="dueDateDesc">Due Date (Latest)</option>
            <option value="priorityDesc">Priority (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Pill Filters Row */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60 text-xs">
        {/* Status Select */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted font-medium">Status:</span>
          <select
            value={filters.status || 'all'}
            onChange={(e) =>
              onChange({
                ...filters,
                status: e.target.value as TaskStatus | 'all',
              })
            }
            aria-label="Filter by status"
            className="h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-button focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="todo">To Do</option>
            <option value="in-progress">In Progress</option>
            <option value="done">Completed</option>
          </select>
        </div>

        {/* Priority Select */}
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted font-medium">Priority:</span>
          <select
            value={filters.priority || 'all'}
            onChange={(e) =>
              onChange({
                ...filters,
                priority: e.target.value as TaskPriority | 'all',
              })
            }
            aria-label="Filter by priority"
            className="h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-button focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Subject Select */}
        {subjects.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted font-medium">Subject:</span>
            <select
              value={filters.subject || 'all'}
              onChange={(e) =>
                onChange({
                  ...filters,
                  subject: e.target.value === 'all' ? undefined : e.target.value,
                })
              }
              aria-label="Filter by subject"
              className="h-8 px-2.5 text-xs bg-surface-2 text-text border border-border rounded-button focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px] truncate"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}

        {(filters.search ||
          (filters.status && filters.status !== 'all') ||
          (filters.priority && filters.priority !== 'all') ||
          filters.subject) && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="ml-auto text-xs text-primary hover:text-primary-hover font-semibold"
          >
            Reset Filters
          </button>
        )}
      </div>
    </div>
  );
}

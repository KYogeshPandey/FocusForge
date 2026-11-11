import { useState, useMemo } from 'react';
import { Plus, CheckSquare, Search } from 'lucide-react';
import type { Task, TaskFilter } from '@focusforge/shared';
import { useTasks } from '../hooks/useTasks';
import { groupTasks } from '../utils/taskFilters';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { TaskGroup } from '../components/tasks/TaskGroup';
import { TaskFormModal } from '../components/tasks/TaskFormModal';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilter>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const { data: tasks = [], isLoading } = useTasks(filters);
  const { data: allTasks = [] } = useTasks(); // for distinct subjects

  const subjects = useMemo(() => {
    const set = new Set<string>();
    allTasks.forEach((t) => {
      if (t.subject) set.add(t.subject);
    });
    return Array.from(set).sort();
  }, [allTasks]);

  const grouped = useMemo(() => {
    return groupTasks(tasks);
  }, [tasks]);

  const handleEdit = (task: Task) => {
    setTaskToEdit(task);
    setIsModalOpen(true);
  };

  const handleCreateNew = () => {
    setTaskToEdit(null);
    setIsModalOpen(true);
  };

  const totalFiltered = tasks.length;
  const isFiltering =
    Boolean(filters.search) ||
    (Boolean(filters.status) && filters.status !== 'all') ||
    (Boolean(filters.priority) && filters.priority !== 'all') ||
    Boolean(filters.subject);

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">Tasks</h1>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            Manage your assignments, readings, and study tasks.
          </p>
        </div>

        <Button onClick={handleCreateNew} className="gap-2 shrink-0">
          <Plus className="w-4 h-4" />
          <span>Add Task</span>
        </Button>
      </div>

      {/* Filters Toolbar */}
      <TaskFilters filters={filters} onChange={setFilters} subjects={subjects} />

      {/* Content Area */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : totalFiltered === 0 ? (
        isFiltering ? (
          <EmptyState
            icon={<Search className="w-6 h-6" />}
            title="No matching tasks found"
            description="Try modifying your search keywords or clearing status/priority filters."
            actionLabel="Clear Filters"
            onAction={() => setFilters({})}
          />
        ) : (
          <EmptyState
            icon={<CheckSquare className="w-6 h-6" />}
            title="No tasks yet"
            description="Add your first study task to organize your day and prioritize your coursework."
            actionLabel="Create Task"
            onAction={handleCreateNew}
          />
        )
      ) : (
        <div className="space-y-6">
          <TaskGroup
            title="Due Today & Overdue"
            tasks={grouped.today}
            badgeCountColor="bg-danger/15 text-danger font-bold"
            onEdit={handleEdit}
          />

          <TaskGroup
            title="Upcoming"
            tasks={grouped.upcoming}
            badgeCountColor="bg-secondary/15 text-secondary"
            onEdit={handleEdit}
          />

          <TaskGroup
            title="No Due Date"
            tasks={grouped.noDate}
            onEdit={handleEdit}
          />

          <TaskGroup
            title="Completed"
            tasks={grouped.completed}
            defaultOpen={false}
            badgeCountColor="bg-success/15 text-success"
            onEdit={handleEdit}
          />
        </div>
      )}

      {/* Add / Edit Task Modal */}
      <TaskFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        taskToEdit={taskToEdit}
      />
    </div>
  );
}

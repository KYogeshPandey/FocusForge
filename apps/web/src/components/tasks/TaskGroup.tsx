import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Task } from '@focusforge/shared';
import { TaskItem } from './TaskItem';

export interface TaskGroupProps {
  title: string;
  tasks: Task[];
  defaultOpen?: boolean;
  onEdit: (task: Task) => void;
  badgeCountColor?: string;
}

export function TaskGroup({
  title,
  tasks,
  defaultOpen = true,
  onEdit,
  badgeCountColor = 'bg-surface-2 text-text-muted',
}: TaskGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (tasks.length === 0) return null;

  return (
    <section className="space-y-2.5">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs font-bold text-text-muted uppercase tracking-wider hover:text-text transition-colors select-none py-1"
        aria-expanded={isOpen}
      >
        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>{title}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${badgeCountColor}`}>
          {tasks.length}
        </span>
      </button>

      {isOpen && (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={onEdit} />
          ))}
        </div>
      )}
    </section>
  );
}

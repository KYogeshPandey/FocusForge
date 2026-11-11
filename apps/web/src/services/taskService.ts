import { LocalStorageAdapter } from './storage/storageAdapter';
import { filterAndSortTasks } from '../utils/taskFilters';
import {
  TaskSchema,
  CreateTaskInputSchema,
  type Task,
  type CreateTaskInput,
  type UpdateTaskInput,
  type TaskFilter,
} from '@focusforge/shared';

export interface ITaskService {
  list(filters?: TaskFilter): Promise<Task[]>;
  getById(id: string): Promise<Task | null>;
  create(input: CreateTaskInput): Promise<Task>;
  update(id: string, patch: UpdateTaskInput): Promise<Task>;
  remove(id: string): Promise<void>;
  toggleStatus(id: string): Promise<Task>;
}

export class TaskService implements ITaskService {
  async list(filters?: TaskFilter): Promise<Task[]> {
    const raw = LocalStorageAdapter.getItem<Task[]>(LocalStorageAdapter.tasksKey, []);
    return filterAndSortTasks(raw, filters);
  }

  async getById(id: string): Promise<Task | null> {
    const tasks = await this.list();
    return tasks.find((t) => t.id === id) || null;
  }

  async create(input: CreateTaskInput): Promise<Task> {
    const validated = CreateTaskInputSchema.parse(input);
    const now = new Date().toISOString();
    const newTask: Task = {
      ...validated,
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: validated.userId || 'user-default',
      createdAt: now,
      updatedAt: now,
      completedAt: validated.status === 'done' ? now : null,
    };

    // Validate complete Task
    TaskSchema.parse(newTask);

    const tasks = LocalStorageAdapter.getItem<Task[]>(LocalStorageAdapter.tasksKey, []);
    tasks.unshift(newTask);
    LocalStorageAdapter.setItem(LocalStorageAdapter.tasksKey, tasks);

    return newTask;
  }

  async update(id: string, patch: UpdateTaskInput): Promise<Task> {
    const tasks = LocalStorageAdapter.getItem<Task[]>(LocalStorageAdapter.tasksKey, []);
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error(`Task with ID ${id} not found`);
    }

    const current = tasks[index]!;
    const now = new Date().toISOString();
    const statusChangedToDone = patch.status === 'done' && current.status !== 'done';
    const statusChangedFromDone = patch.status && patch.status !== 'done' && current.status === 'done';

    const updatedTask: Task = {
      ...current,
      ...patch,
      completedAt: statusChangedToDone
        ? now
        : statusChangedFromDone
        ? null
        : current.completedAt,
      updatedAt: now,
    };

    TaskSchema.parse(updatedTask);
    tasks[index] = updatedTask;
    LocalStorageAdapter.setItem(LocalStorageAdapter.tasksKey, tasks);

    return updatedTask;
  }

  async remove(id: string): Promise<void> {
    const tasks = LocalStorageAdapter.getItem<Task[]>(LocalStorageAdapter.tasksKey, []);
    const filtered = tasks.filter((t) => t.id !== id);
    LocalStorageAdapter.setItem(LocalStorageAdapter.tasksKey, filtered);
  }

  async toggleStatus(id: string): Promise<Task> {
    const task = await this.getById(id);
    if (!task) {
      throw new Error(`Task with ID ${id} not found`);
    }
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    return this.update(id, { status: nextStatus });
  }
}

export const taskService = new TaskService();

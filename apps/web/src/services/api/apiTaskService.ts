import { apiClient } from './apiClient';
import { ApiError } from './apiError';
import type { ITaskService } from '../taskService';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '@focusforge/shared';

export class ApiTaskService implements ITaskService {
  async list(filters?: TaskFilter): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters?.priority && filters.priority !== 'all') params.set('priority', filters.priority);
    if (filters?.subject && filters.subject !== 'all') params.set('subject', filters.subject);
    if (filters?.search) params.set('search', filters.search);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    params.set('limit', '100');

    const queryString = params.toString();
    const endpoint = queryString ? `/tasks?${queryString}` : '/tasks';
    const result = await apiClient.get<{ items: Task[]; total: number }>(endpoint);
    return result.items || [];
  }

  async getById(id: string): Promise<Task | null> {
    try {
      return await apiClient.get<Task>(`/tasks/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async create(input: CreateTaskInput): Promise<Task> {
    return apiClient.post<Task>('/tasks', input);
  }

  async update(id: string, patch: UpdateTaskInput): Promise<Task> {
    return apiClient.patch<Task>(`/tasks/${id}`, patch);
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/tasks/${id}`);
  }

  async toggleStatus(id: string): Promise<Task> {
    const current = await this.getById(id);
    if (!current) {
      throw new Error(`Task with ID ${id} not found`);
    }
    const nextStatus = current.status === 'done' ? 'todo' : 'done';
    return this.update(id, { status: nextStatus });
  }
}

export const apiTaskService = new ApiTaskService();

import { apiClient } from './apiClient';
import { ApiError } from './apiError';
import type { IHabitService } from '../habitService';
import type {
  Habit,
  CreateHabitInput,
  UpdateHabitInput,
  HabitCompletion,
  ToggleHabitInput,
} from '@focusforge/shared';

export class ApiHabitService implements IHabitService {
  async list(includeArchived = false): Promise<Habit[]> {
    const endpoint = includeArchived ? '/habits?includeArchived=true' : '/habits';
    return apiClient.get<Habit[]>(endpoint);
  }

  async getById(id: string): Promise<Habit | null> {
    try {
      return await apiClient.get<Habit>(`/habits/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async create(input: CreateHabitInput): Promise<Habit> {
    return apiClient.post<Habit>('/habits', input);
  }

  async update(id: string, patch: UpdateHabitInput): Promise<Habit> {
    return apiClient.patch<Habit>(`/habits/${id}`, patch);
  }

  async archive(id: string): Promise<Habit> {
    return this.update(id, { active: false });
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/habits/${id}`);
  }

  async listCompletions(habitId?: string): Promise<HabitCompletion[]> {
    const endpoint = habitId ? `/habits/completions?habitId=${habitId}` : '/habits/completions';
    return apiClient.get<HabitCompletion[]>(endpoint);
  }

  async toggleCompletion(input: ToggleHabitInput): Promise<HabitCompletion> {
    return apiClient.post<HabitCompletion>(`/habits/${input.habitId}/completions`, {
      date: input.date,
      completed: input.completed,
    });
  }
}

export const apiHabitService = new ApiHabitService();

import { apiClient } from './apiClient';
import type { IGoalService } from '../goalService';
import type { Goal, UpdateGoalInput } from '@focusforge/shared';

export class ApiGoalService implements IGoalService {
  async get(): Promise<Goal> {
    return apiClient.get<Goal>('/goals');
  }

  async update(input: UpdateGoalInput): Promise<Goal> {
    const current = await this.get();
    return apiClient.patch<Goal>(`/goals/${current.id}`, input);
  }
}

export const apiGoalService = new ApiGoalService();

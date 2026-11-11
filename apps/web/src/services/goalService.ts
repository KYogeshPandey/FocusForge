import { LocalStorageAdapter } from './storage/storageAdapter';
import {
  GoalSchema,
  UpdateGoalInputSchema,
  type Goal,
  type UpdateGoalInput,
} from '@focusforge/shared';

export interface IGoalService {
  get(): Promise<Goal>;
  update(input: UpdateGoalInput): Promise<Goal>;
}

export class GoalService implements IGoalService {
  async get(): Promise<Goal> {
    const raw = LocalStorageAdapter.getItem<Goal>(LocalStorageAdapter.goalKey, {
      id: 'goal-default',
      userId: 'user-default',
      targetMinutesWeekly: 900,
      updatedAt: new Date().toISOString(),
    });
    return raw;
  }

  async update(input: UpdateGoalInput): Promise<Goal> {
    const validated = UpdateGoalInputSchema.parse(input);
    const current = await this.get();
    const updated: Goal = {
      ...current,
      ...validated,
      updatedAt: new Date().toISOString(),
    };

    GoalSchema.parse(updated);
    LocalStorageAdapter.setItem(LocalStorageAdapter.goalKey, updated);
    return updated;
  }
}

export const goalService = new GoalService();

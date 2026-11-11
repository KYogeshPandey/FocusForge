import { Goal } from '../models/Goal.js';
import { AppError } from '../utils/AppError.js';
import type { UpdateGoalInput } from '@focusforge/shared';

export class GoalService {
  async get(userId: string) {
    let goal = await Goal.findOne({ userId });
    if (!goal) {
      // Auto-initialize default goal if none exists
      goal = await Goal.create({
        userId,
        targetMinutesWeekly: 600,
      });
    }
    return goal.toJSON();
  }

  async create(userId: string, input: UpdateGoalInput & { weekStartDate?: string }) {
    const goal = await Goal.create({
      userId,
      targetMinutesWeekly: input.targetMinutesWeekly,
      targetSessionsWeekly: input.targetSessionsWeekly,
      weekStartDate: input.weekStartDate,
    });
    return goal.toJSON();
  }

  async update(userId: string, goalId: string, patch: UpdateGoalInput) {
    const goal = await Goal.findOne({ _id: goalId, userId });
    if (!goal) {
      throw AppError.notFound('Goal not found');
    }

    if (patch.targetMinutesWeekly !== undefined) {
      goal.targetMinutesWeekly = patch.targetMinutesWeekly;
    }
    if (patch.targetSessionsWeekly !== undefined) {
      goal.targetSessionsWeekly = patch.targetSessionsWeekly;
    }

    await goal.save();
    return goal.toJSON();
  }

  async delete(userId: string, goalId: string) {
    const goal = await Goal.findOneAndDelete({ _id: goalId, userId });
    if (!goal) {
      throw AppError.notFound('Goal not found');
    }
  }
}

export const goalService = new GoalService();

import type { FilterQuery } from 'mongoose';
import { Habit, type IHabit } from '../models/Habit.js';
import { HabitCompletion, type IHabitCompletion } from '../models/HabitCompletion.js';
import { AppError } from '../utils/AppError.js';
import type { CreateHabitInput, UpdateHabitInput } from '@focusforge/shared';

export class HabitService {
  async list(userId: string, includeArchived = false) {
    const query: FilterQuery<IHabit> = { userId };
    if (!includeArchived) {
      query.active = true;
    }
    const habits = await Habit.find(query).sort({ createdAt: -1 });
    return habits.map((h) => h.toJSON());
  }

  async getById(userId: string, habitId: string) {
    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      throw AppError.notFound('Habit not found');
    }
    return habit.toJSON();
  }

  async create(userId: string, input: CreateHabitInput) {
    const habit = await Habit.create({
      userId,
      title: input.title,
      category: input.category,
      frequency: input.frequency || 'daily',
      targetPerDay: input.targetPerDay || 1,
      color: input.color || '#8B5CF6',
      active: input.active !== undefined ? input.active : true,
    });
    return habit.toJSON();
  }

  async update(userId: string, habitId: string, patch: UpdateHabitInput) {
    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      throw AppError.notFound('Habit not found');
    }

    if (patch.title !== undefined) habit.title = patch.title;
    if (patch.category !== undefined) habit.category = patch.category;
    if (patch.frequency !== undefined) habit.frequency = patch.frequency;
    if (patch.targetPerDay !== undefined) habit.targetPerDay = patch.targetPerDay;
    if (patch.color !== undefined) habit.color = patch.color;
    if (patch.active !== undefined) habit.active = patch.active;

    await habit.save();
    return habit.toJSON();
  }

  async delete(userId: string, habitId: string) {
    const habit = await Habit.findOneAndDelete({ _id: habitId, userId });
    if (!habit) {
      throw AppError.notFound('Habit not found');
    }
    // Cascade delete associated completions for this user & habit
    await HabitCompletion.deleteMany({ userId, habitId });
  }

  // --- Habit Completions ---

  async listCompletions(userId: string, options: { from?: string; to?: string; habitId?: string } = {}) {
    const query: FilterQuery<IHabitCompletion> = { userId };

    if (options.habitId) {
      // Verify habit belongs to user
      const habit = await Habit.findOne({ _id: options.habitId, userId });
      if (!habit) {
        throw AppError.notFound('Habit not found');
      }
      query.habitId = options.habitId;
    }

    if (options.from || options.to) {
      query.date = {};
      if (options.from) query.date.$gte = options.from;
      if (options.to) query.date.$lte = options.to;
    }

    const completions = await HabitCompletion.find(query).sort({ date: -1 });
    return completions.map((c) => c.toJSON());
  }

  async recordCompletion(
    userId: string,
    habitId: string,
    date: string,
    completed: boolean = true
  ) {
    // Ownership check: habit must belong to this user
    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      throw AppError.notFound('Habit not found');
    }

    // Upsert completion record (idempotent for given date)
    const completion = await HabitCompletion.findOneAndUpdate(
      { userId, habitId, date },
      { $set: { completed } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    return completion.toJSON();
  }

  async deleteCompletion(userId: string, habitId: string, date: string) {
    // Ownership check
    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) {
      throw AppError.notFound('Habit not found');
    }

    const result = await HabitCompletion.findOneAndDelete({ userId, habitId, date });
    if (!result) {
      throw AppError.notFound('Habit completion not found for specified date');
    }
  }
}

export const habitService = new HabitService();

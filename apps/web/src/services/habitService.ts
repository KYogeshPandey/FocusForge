import { LocalStorageAdapter } from './storage/storageAdapter';
import {
  HabitSchema,
  CreateHabitInputSchema,
  HabitCompletionSchema,
  type Habit,
  type CreateHabitInput,
  type UpdateHabitInput,
  type HabitCompletion,
  type ToggleHabitInput,
} from '@focusforge/shared';

export interface IHabitService {
  list(includeArchived?: boolean): Promise<Habit[]>;
  getById(id: string): Promise<Habit | null>;
  create(input: CreateHabitInput): Promise<Habit>;
  update(id: string, patch: UpdateHabitInput): Promise<Habit>;
  archive(id: string): Promise<Habit>;
  remove(id: string): Promise<void>;
  listCompletions(habitId?: string): Promise<HabitCompletion[]>;
  toggleCompletion(input: ToggleHabitInput): Promise<HabitCompletion>;
}

export class HabitService implements IHabitService {
  async list(includeArchived = false): Promise<Habit[]> {
    const raw = LocalStorageAdapter.getItem<Habit[]>(LocalStorageAdapter.habitsKey, []);
    if (includeArchived) return raw;
    return raw.filter((h) => h.active);
  }

  async getById(id: string): Promise<Habit | null> {
    const habits = await this.list(true);
    return habits.find((h) => h.id === id) || null;
  }

  async create(input: CreateHabitInput): Promise<Habit> {
    const validated = CreateHabitInputSchema.parse(input);
    const now = new Date().toISOString();
    const newHabit: Habit = {
      ...validated,
      id: `habit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: validated.userId || 'user-default',
      createdAt: now,
      updatedAt: now,
    };

    HabitSchema.parse(newHabit);

    const habits = LocalStorageAdapter.getItem<Habit[]>(LocalStorageAdapter.habitsKey, []);
    habits.unshift(newHabit);
    LocalStorageAdapter.setItem(LocalStorageAdapter.habitsKey, habits);

    return newHabit;
  }

  async update(id: string, patch: UpdateHabitInput): Promise<Habit> {
    const habits = LocalStorageAdapter.getItem<Habit[]>(LocalStorageAdapter.habitsKey, []);
    const index = habits.findIndex((h) => h.id === id);
    if (index === -1) {
      throw new Error(`Habit with ID ${id} not found`);
    }

    const current = habits[index]!;
    const now = new Date().toISOString();
    const updated: Habit = {
      ...current,
      ...patch,
      updatedAt: now,
    };

    HabitSchema.parse(updated);
    habits[index] = updated;
    LocalStorageAdapter.setItem(LocalStorageAdapter.habitsKey, habits);

    return updated;
  }

  async archive(id: string): Promise<Habit> {
    return this.update(id, { active: false });
  }

  async remove(id: string): Promise<void> {
    const habits = LocalStorageAdapter.getItem<Habit[]>(LocalStorageAdapter.habitsKey, []);
    const filtered = habits.filter((h) => h.id !== id);
    LocalStorageAdapter.setItem(LocalStorageAdapter.habitsKey, filtered);

    // Also remove associated completions
    const comps = LocalStorageAdapter.getItem<HabitCompletion[]>(
      LocalStorageAdapter.habitCompletionsKey,
      []
    );
    const filteredComps = comps.filter((c) => c.habitId !== id);
    LocalStorageAdapter.setItem(LocalStorageAdapter.habitCompletionsKey, filteredComps);
  }

  async listCompletions(habitId?: string): Promise<HabitCompletion[]> {
    const comps = LocalStorageAdapter.getItem<HabitCompletion[]>(
      LocalStorageAdapter.habitCompletionsKey,
      []
    );
    if (!habitId) return comps;
    return comps.filter((c) => c.habitId === habitId);
  }

  async toggleCompletion(input: ToggleHabitInput): Promise<HabitCompletion> {
    const comps = LocalStorageAdapter.getItem<HabitCompletion[]>(
      LocalStorageAdapter.habitCompletionsKey,
      []
    );

    const existingIndex = comps.findIndex(
      (c) => c.habitId === input.habitId && c.date === input.date
    );

    if (existingIndex !== -1) {
      const existing = comps[existingIndex]!;
      const nextCompleted = input.completed !== undefined ? input.completed : !existing.completed;
      
      const updated: HabitCompletion = {
        ...existing,
        completed: nextCompleted,
      };

      comps[existingIndex] = updated;
      LocalStorageAdapter.setItem(LocalStorageAdapter.habitCompletionsKey, comps);
      return updated;
    } else {
      const newCompletion: HabitCompletion = {
        id: `comp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: 'user-default',
        habitId: input.habitId,
        date: input.date,
        completed: input.completed !== undefined ? input.completed : true,
        createdAt: new Date().toISOString(),
      };

      HabitCompletionSchema.parse(newCompletion);
      comps.push(newCompletion);
      LocalStorageAdapter.setItem(LocalStorageAdapter.habitCompletionsKey, comps);
      return newCompletion;
    }
  }
}

export const habitService = new HabitService();

import { z } from 'zod';

export const HabitFrequencySchema = z.enum(['daily', 'weekdays', 'weekends']);
export type HabitFrequency = z.infer<typeof HabitFrequencySchema>;

export const HabitSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  title: z.string().min(1, 'Habit title is required').max(80, 'Title cannot exceed 80 characters'),
  category: z.string().min(1, 'Category is required').max(40),
  frequency: HabitFrequencySchema.default('daily'),
  targetPerDay: z.number().int().min(1).default(1),
  color: z.string().default('#8B5CF6'),
  active: z.boolean().default(true),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Habit = z.infer<typeof HabitSchema>;

export const CreateHabitInputSchema = HabitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
});
export type CreateHabitInput = z.infer<typeof CreateHabitInputSchema>;

export const UpdateHabitInputSchema = CreateHabitInputSchema.partial();
export type UpdateHabitInput = z.infer<typeof UpdateHabitInputSchema>;

export const HabitCompletionSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  habitId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  completed: z.boolean(),
  createdAt: z.string(),
});
export type HabitCompletion = z.infer<typeof HabitCompletionSchema>;

export const ToggleHabitInputSchema = z.object({
  habitId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  completed: z.boolean().optional(),
});
export type ToggleHabitInput = z.infer<typeof ToggleHabitInputSchema>;

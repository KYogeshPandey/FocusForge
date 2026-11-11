import { z } from 'zod';
import { CreateTaskInputSchema } from './task.js';
import { CreateHabitInputSchema } from './habit.js';
import { CreateStudySessionInputSchema, CreateFocusSessionInputSchema } from './session.js';
import { UpdateGoalInputSchema } from './goal.js';
import { UpdateSettingsInputSchema } from './settings.js';

export const ImportTaskSchema = CreateTaskInputSchema.extend({
  id: z.string().optional(),
  completedAt: z.string().nullable().optional(),
});

export const ImportHabitSchema = CreateHabitInputSchema.extend({
  id: z.string().optional(),
});

export const ImportStudySessionSchema = CreateStudySessionInputSchema.extend({
  id: z.string().optional(),
});

export const ImportFocusSessionSchema = CreateFocusSessionInputSchema.extend({
  id: z.string().optional(),
});

export const ImportDataSchema = z.object({
  tasks: z.array(ImportTaskSchema).optional().default([]),
  habits: z.array(ImportHabitSchema).optional().default([]),
  habitCompletions: z
    .array(
      z.object({
        habitId: z.string(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
        completed: z.boolean().default(true),
      })
    )
    .optional()
    .default([]),
  studySessions: z.array(ImportStudySessionSchema).optional().default([]),
  focusSessions: z.array(ImportFocusSessionSchema).optional().default([]),
  goal: UpdateGoalInputSchema.optional(),
  settings: UpdateSettingsInputSchema.optional(),
});
export type ImportData = z.infer<typeof ImportDataSchema>;

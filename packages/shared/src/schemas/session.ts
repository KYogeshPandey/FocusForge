import { z } from 'zod';

// Planned Study Session
export const StudySessionStatusSchema = z.enum(['scheduled', 'completed', 'skipped']);
export type StudySessionStatus = z.infer<typeof StudySessionStatusSchema>;

export const StudySessionSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  title: z.string().min(1, 'Title is required').max(100),
  subject: z.string().min(1, 'Subject is required').max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Start time must be HH:MM'),
  durationMinutes: z.number().int().min(5).max(720),
  taskId: z.string().nullable().optional(),
  status: StudySessionStatusSchema.default('scheduled'),
  notes: z.string().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type StudySession = z.infer<typeof StudySessionSchema>;

export const CreateStudySessionInputSchema = StudySessionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  userId: z.string().optional(),
  status: StudySessionStatusSchema.default('scheduled'),
});
export type CreateStudySessionInput = z.infer<typeof CreateStudySessionInputSchema>;

export const UpdateStudySessionInputSchema = CreateStudySessionInputSchema.partial();
export type UpdateStudySessionInput = z.infer<typeof UpdateStudySessionInputSchema>;

// Recorded Focus Session (from Pomodoro timer or manual log)
export const FocusModeSchema = z.enum(['focus', 'short-break', 'long-break']);
export type FocusMode = z.infer<typeof FocusModeSchema>;

export const FocusSessionSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  clientSessionId: z.string().optional(),
  title: z.string().min(1).max(100),
  subject: z.string().min(1).max(50),
  durationMinutes: z.number().min(1).max(720),
  startedAt: z.string(), // ISO string
  endedAt: z.string(), // ISO string
  mode: FocusModeSchema.default('focus'),
  taskId: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type FocusSession = z.infer<typeof FocusSessionSchema>;

export const CreateFocusSessionInputSchema = FocusSessionSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  userId: z.string().optional(),
  clientSessionId: z.string().optional(),
});
export type CreateFocusSessionInput = z.infer<typeof CreateFocusSessionInputSchema>;

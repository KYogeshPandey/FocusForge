import { z } from 'zod';

export const GoalSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  targetMinutesWeekly: z.number().int().min(30).max(10080), // 30 min to 7 days
  targetSessionsWeekly: z.number().int().min(1).max(100).optional(),
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  updatedAt: z.string(),
});
export type Goal = z.infer<typeof GoalSchema>;

export const UpdateGoalInputSchema = z.object({
  targetMinutesWeekly: z.number().int().min(30, 'Goal must be at least 30 minutes').max(10080, 'Cannot exceed 168 hours'),
  targetSessionsWeekly: z.number().int().min(1).max(100).optional(),
});
export type UpdateGoalInput = z.infer<typeof UpdateGoalInputSchema>;

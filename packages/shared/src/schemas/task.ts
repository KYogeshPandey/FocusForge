import { z } from 'zod';

export const TaskPrioritySchema = z.enum(['low', 'medium', 'high']);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum(['todo', 'in-progress', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  userId: z.string().default('user-default'),
  title: z.string().trim().min(1, 'Task title is required').max(120, 'Title cannot exceed 120 characters'),
  subject: z.string().trim().min(1, 'Subject is required').max(50),
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('todo'),
  dueDate: z.string().nullable().optional(), // YYYY-MM-DD or ISO string
  estimatedMinutes: z.number().int().min(1).max(1440).nullable().optional(),
  completedAt: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskInputSchema = TaskSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
}).extend({
  userId: z.string().optional(),
  priority: TaskPrioritySchema.default('medium'),
  status: TaskStatusSchema.default('todo'),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const UpdateTaskInputSchema = CreateTaskInputSchema.partial();
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const TaskFilterSchema = z.object({
  search: z.string().optional(),
  status: z.union([TaskStatusSchema, z.literal('all')]).optional(),
  priority: z.union([TaskPrioritySchema, z.literal('all')]).optional(),
  subject: z.string().optional(),
  sortBy: z.enum(['dueDateAsc', 'dueDateDesc', 'priorityDesc', 'createdAtDesc']).optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

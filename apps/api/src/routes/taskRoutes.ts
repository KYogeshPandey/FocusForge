import { Router } from 'express';
import { z } from 'zod';
import { taskController } from '../controllers/taskController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, ObjectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  CreateTaskInputSchema,
  UpdateTaskInputSchema,
} from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

const TaskParamsSchema = z.object({
  id: ObjectIdSchema,
});

const TaskQuerySchema = z.object({
  status: z.enum(['todo', 'in-progress', 'done', 'all']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'all']).optional(),
  subject: z.string().optional(),
  search: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  sortBy: z.enum(['dueDateAsc', 'dueDateDesc', 'priorityDesc', 'createdAtDesc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

router.get(
  '/',
  validate({ query: TaskQuerySchema }),
  asyncHandler((req, res) => taskController.list(req, res))
);

router.post(
  '/',
  validate({ body: CreateTaskInputSchema }),
  asyncHandler((req, res) => taskController.create(req, res))
);

router.get(
  '/:id',
  validate({ params: TaskParamsSchema }),
  asyncHandler((req, res) => taskController.getById(req, res))
);

router.patch(
  '/:id',
  validate({ params: TaskParamsSchema, body: UpdateTaskInputSchema }),
  asyncHandler((req, res) => taskController.update(req, res))
);

router.delete(
  '/:id',
  validate({ params: TaskParamsSchema }),
  asyncHandler((req, res) => taskController.delete(req, res))
);

export const taskRoutes = router;

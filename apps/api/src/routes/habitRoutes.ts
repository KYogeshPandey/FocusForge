import { Router } from 'express';
import { z } from 'zod';
import { habitController } from '../controllers/habitController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, ObjectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  CreateHabitInputSchema,
  UpdateHabitInputSchema,
} from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

const HabitParamsSchema = z.object({
  id: ObjectIdSchema,
});

const CompletionParamsSchema = z.object({
  id: ObjectIdSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
});

const ListCompletionsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  habitId: ObjectIdSchema.optional(),
});

const RecordCompletionBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  completed: z.boolean().optional(),
});

// 1. Completions query route (registered before /:id)
router.get(
  '/completions',
  validate({ query: ListCompletionsQuerySchema }),
  asyncHandler((req, res) => habitController.listCompletions(req, res))
);

// 2. Habits collection routes
router.get(
  '/',
  validate({
    query: z.object({ includeArchived: z.enum(['true', 'false']).optional() }),
  }),
  asyncHandler((req, res) => habitController.list(req, res))
);

router.post(
  '/',
  validate({ body: CreateHabitInputSchema }),
  asyncHandler((req, res) => habitController.create(req, res))
);

// 3. Single habit routes
router.get(
  '/:id',
  validate({ params: HabitParamsSchema }),
  asyncHandler((req, res) => habitController.getById(req, res))
);

router.patch(
  '/:id',
  validate({ params: HabitParamsSchema, body: UpdateHabitInputSchema }),
  asyncHandler((req, res) => habitController.update(req, res))
);

router.delete(
  '/:id',
  validate({ params: HabitParamsSchema }),
  asyncHandler((req, res) => habitController.delete(req, res))
);

// 4. Habit completion toggle/deletion per habit
router.post(
  '/:id/completions',
  validate({ params: HabitParamsSchema, body: RecordCompletionBodySchema }),
  asyncHandler((req, res) => habitController.recordCompletion(req, res))
);

router.delete(
  '/:id/completions/:date',
  validate({ params: CompletionParamsSchema }),
  asyncHandler((req, res) => habitController.deleteCompletion(req, res))
);

export const habitRoutes = router;

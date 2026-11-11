import { Router } from 'express';
import { z } from 'zod';
import { goalController } from '../controllers/goalController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, ObjectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { UpdateGoalInputSchema } from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

const GoalParamsSchema = z.object({
  id: ObjectIdSchema,
});

router.get(
  '/',
  asyncHandler((req, res) => goalController.get(req, res))
);

router.post(
  '/',
  validate({ body: UpdateGoalInputSchema }),
  asyncHandler((req, res) => goalController.create(req, res))
);

router.patch(
  '/:id',
  validate({ params: GoalParamsSchema, body: UpdateGoalInputSchema }),
  asyncHandler((req, res) => goalController.update(req, res))
);

router.delete(
  '/:id',
  validate({ params: GoalParamsSchema }),
  asyncHandler((req, res) => goalController.delete(req, res))
);

export const goalRoutes = router;

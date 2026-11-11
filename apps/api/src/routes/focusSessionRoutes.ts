import { Router } from 'express';
import { z } from 'zod';
import { focusSessionController } from '../controllers/focusSessionController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, ObjectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { CreateFocusSessionInputSchema } from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

const FocusSessionParamsSchema = z.object({
  id: ObjectIdSchema,
});

const FocusSessionQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
});

router.get(
  '/',
  validate({ query: FocusSessionQuerySchema }),
  asyncHandler((req, res) => focusSessionController.list(req, res))
);

router.post(
  '/',
  validate({ body: CreateFocusSessionInputSchema }),
  asyncHandler((req, res) => focusSessionController.create(req, res))
);

router.delete(
  '/:id',
  validate({ params: FocusSessionParamsSchema }),
  asyncHandler((req, res) => focusSessionController.delete(req, res))
);

export const focusSessionRoutes = router;

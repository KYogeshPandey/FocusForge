import { Router } from 'express';
import { z } from 'zod';
import { studySessionController } from '../controllers/studySessionController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, ObjectIdSchema } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  CreateStudySessionInputSchema,
  UpdateStudySessionInputSchema,
} from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

const SessionParamsSchema = z.object({
  id: ObjectIdSchema,
});

const SessionQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

router.get(
  '/',
  validate({ query: SessionQuerySchema }),
  asyncHandler((req, res) => studySessionController.list(req, res))
);

router.post(
  '/',
  validate({ body: CreateStudySessionInputSchema }),
  asyncHandler((req, res) => studySessionController.create(req, res))
);

router.get(
  '/:id',
  validate({ params: SessionParamsSchema }),
  asyncHandler((req, res) => studySessionController.getById(req, res))
);

router.patch(
  '/:id',
  validate({ params: SessionParamsSchema, body: UpdateStudySessionInputSchema }),
  asyncHandler((req, res) => studySessionController.update(req, res))
);

router.delete(
  '/:id',
  validate({ params: SessionParamsSchema }),
  asyncHandler((req, res) => studySessionController.delete(req, res))
);

export const studySessionRoutes = router;

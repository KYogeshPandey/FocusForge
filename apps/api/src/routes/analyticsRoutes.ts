import { Router } from 'express';
import { z } from 'zod';
import { analyticsController } from '../controllers/analyticsController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth);

const AnalyticsQuerySchema = z.object({
  range: z.enum(['7', '30', '90']).optional(),
});

router.get(
  '/summary',
  validate({ query: AnalyticsQuerySchema }),
  asyncHandler((req, res) => analyticsController.getSummary(req, res))
);

export const analyticsRoutes = router;

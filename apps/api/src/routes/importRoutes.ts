import { Router } from 'express';
import { importController } from '../controllers/importController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ImportDataSchema } from '@focusforge/shared';

const router = Router();
router.use(requireAuth);

router.post(
  '/',
  validate({ body: ImportDataSchema }),
  asyncHandler((req, res) => importController.importData(req, res))
);

export const importRoutes = router;

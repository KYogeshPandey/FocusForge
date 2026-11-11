import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import {
  RegisterInputSchema,
  LoginInputSchema,
  ChangePasswordInputSchema,
  UpdateUserMeInputSchema,
  DeleteAccountInputSchema,
} from '@focusforge/shared';

const router = Router();

// Public auth routes
router.post(
  '/register',
  authLimiter,
  validate({ body: RegisterInputSchema }),
  asyncHandler((req, res) => authController.register(req, res))
);

router.post(
  '/login',
  authLimiter,
  validate({ body: LoginInputSchema }),
  asyncHandler((req, res) => authController.login(req, res))
);

router.post(
  '/refresh',
  authLimiter,
  asyncHandler((req, res) => authController.refresh(req, res))
);

router.post(
  '/logout',
  asyncHandler((req, res) => authController.logout(req, res))
);

// Protected user management routes
router.get(
  '/me',
  requireAuth,
  asyncHandler((req, res) => authController.getMe(req, res))
);

router.patch(
  '/me',
  requireAuth,
  validate({ body: UpdateUserMeInputSchema }),
  asyncHandler((req, res) => authController.updateMe(req, res))
);

router.post(
  '/change-password',
  requireAuth,
  validate({ body: ChangePasswordInputSchema }),
  asyncHandler((req, res) => authController.changePassword(req, res))
);

router.delete(
  '/me',
  requireAuth,
  validate({ body: DeleteAccountInputSchema }),
  asyncHandler((req, res) => authController.deleteAccount(req, res))
);

export const authRoutes = router;

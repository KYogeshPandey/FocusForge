import type { Request, Response } from 'express';
import { authService } from '../services/authService.js';
import {
  sendSuccess,
  sendNoContent,
} from '../utils/response.js';
import {
  getRefreshTokenCookieOptions,
  REFRESH_COOKIE_NAME,
} from '../utils/tokens.js';
import type {
  RegisterInput,
  LoginInput,
  ChangePasswordInput,
  UpdateUserMeInput,
  DeleteAccountInput,
} from '@focusforge/shared';

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    const input: RegisterInput = req.body;
    const result = await authService.register(input);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshTokenString,
      getRefreshTokenCookieOptions()
    );

    sendSuccess(
      res,
      {
        user: result.user,
        accessToken: result.accessToken,
      },
      201
    );
  }

  async login(req: Request, res: Response): Promise<void> {
    const input: LoginInput = req.body;
    const result = await authService.login(input);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.refreshTokenString,
      getRefreshTokenCookieOptions()
    );

    sendSuccess(res, {
      user: result.user,
      accessToken: result.accessToken,
    });
  }

  async refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    const result = await authService.refresh(token);

    res.cookie(
      REFRESH_COOKIE_NAME,
      result.newRefreshTokenString,
      getRefreshTokenCookieOptions()
    );

    sendSuccess(res, {
      accessToken: result.accessToken,
    });
  }

  async logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    await authService.logout(token);

    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshTokenCookieOptions(),
      maxAge: 0,
    });

    sendSuccess(res, { message: 'Successfully logged out' });
  }

  async getMe(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const user = await authService.getMe(userId);
    sendSuccess(res, user);
  }

  async updateMe(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input: UpdateUserMeInput = req.body;
    const updated = await authService.updateMe(userId, input);
    sendSuccess(res, updated);
  }

  async changePassword(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input: ChangePasswordInput = req.body;
    await authService.changePassword(userId, input);
    sendSuccess(res, { message: 'Password changed successfully' });
  }

  async deleteAccount(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const input: DeleteAccountInput = req.body;
    await authService.deleteAccount(userId, input.password);

    res.clearCookie(REFRESH_COOKIE_NAME, {
      ...getRefreshTokenCookieOptions(),
      maxAge: 0,
    });

    sendNoContent(res);
  }
}

export const authController = new AuthController();

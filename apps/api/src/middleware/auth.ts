import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, hashToken, REFRESH_COOKIE_NAME } from '../utils/tokens.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { AppError } from '../utils/AppError.js';

export interface AuthenticatedUser {
  id: string;
}

// Augment Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header with Bearer token');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    throw AppError.unauthorized('Bearer token missing');
  }

  try {
    const payload = verifyAccessToken(token);
    if (!payload.sub) {
      throw AppError.unauthorized('Invalid token payload: missing subject');
    }
    req.user = { id: payload.sub };
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
    }
    throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid');
  }
}

/**
 * Middleware that validates the caller has an active authenticated session.
 * Specifically designed for session-maintenance endpoints (like /activity)
 * so that expired 15-minute access tokens do not break the 72-hour refresh session lifecycle.
 * Accepts either an active HttpOnly refresh cookie or Bearer access token.
 */
export async function requireSessionAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];
  const authHeader = req.headers.authorization;

  // 1. HttpOnly refresh cookie validation
  if (cookieToken) {
    const presentedHash = hashToken(cookieToken);
    const tokenRecord = await RefreshToken.findOne({ tokenHash: presentedHash });

    if (!tokenRecord) {
      throw AppError.unauthorized('Invalid or expired session');
    }

    if (tokenRecord.revokedAt) {
      // Check if it was rotated concurrently within 30s
      const gracePeriodMs = 30 * 1000;
      if (tokenRecord.replacedBy && Date.now() - tokenRecord.revokedAt.getTime() < gracePeriodMs) {
        req.user = { id: tokenRecord.userId.toString() };
        return next();
      }
      throw AppError.unauthorized('Session has been revoked');
    }

    if (tokenRecord.expiresAt.getTime() <= Date.now()) {
      throw AppError.unauthorized('Session expired due to 3 days of inactivity');
    }

    req.user = { id: tokenRecord.userId.toString() };
    return next();
  }

  // 2. Bearer access token fallback
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token) {
      try {
        const payload = verifyAccessToken(token);
        if (payload.sub) {
          req.user = { id: payload.sub };
          return next();
        }
      } catch (err: unknown) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new AppError(401, 'TOKEN_EXPIRED', 'Access token has expired');
        }
        throw new AppError(401, 'INVALID_TOKEN', 'Access token is invalid');
      }
    }
  }

  // Neither valid cookie nor valid Bearer token provided
  throw AppError.unauthorized('Authentication session required');
}

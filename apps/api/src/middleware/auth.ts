import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyAccessToken, hashToken, REFRESH_COOKIE_NAME } from '../utils/tokens.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { Session } from '../models/Session.js';
import { resolveActiveRotationChain } from '../services/authService.js';
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
 * Specifically designed for session-maintenance endpoints (like /activity).
 * Requires a valid refresh-cookie-backed session; Bearer-only tokens cannot extend sessions.
 */
export async function requireSessionAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const cookieToken = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!cookieToken) {
    throw AppError.unauthorized('Authentication session required');
  }

  const presentedHash = hashToken(cookieToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash: presentedHash });

  if (!tokenRecord) {
    throw AppError.unauthorized('Invalid or expired session');
  }

  // Capture comparison timestamp immediately AFTER database read
  const now = new Date();

  // Future timestamp validation
  if (tokenRecord.revokedAt && tokenRecord.revokedAt.getTime() > now.getTime()) {
    throw AppError.unauthorized('Invalid session timestamp');
  }

  // If token belongs to a stable session, verify session is active and unrevoked
  if (tokenRecord.sessionId) {
    const session = await Session.findById(tokenRecord.sessionId);
    if (!session || session.revokedAt != null) {
      if (session?.revokedAt && session.revokedAt.getTime() > now.getTime()) {
        throw AppError.unauthorized('Invalid session timestamp');
      }
      throw AppError.unauthorized('Session has been revoked');
    }
    if (session.expiresAt.getTime() <= now.getTime()) {
      throw AppError.unauthorized('Session has expired. Please log in again.');
    }
  }

  // If token is revoked, check concurrent rotation grace period
  if (tokenRecord.revokedAt) {
    const gracePeriodMs = 30 * 1000;
    const timeSinceRevoke = now.getTime() - tokenRecord.revokedAt.getTime();

    if (tokenRecord.replacedBy && timeSinceRevoke >= 0 && timeSinceRevoke < gracePeriodMs) {
      // Resolve active terminal token in rotation chain
      const terminalRecord = await resolveActiveRotationChain(tokenRecord, now);

      if (terminalRecord) {
        req.user = { id: terminalRecord.userId.toString() };
        return next();
      }
    }
    throw AppError.unauthorized('Session has been revoked');
  }

  if (tokenRecord.expiresAt.getTime() <= now.getTime()) {
    throw AppError.unauthorized('Session has expired. Please log in again.');
  }

  // Mark token as used if first time presented
  if (!tokenRecord.firstUsedAt) {
    tokenRecord.firstUsedAt = now;
    await tokenRecord.save();
  }

  req.user = { id: tokenRecord.userId.toString() };
  return next();
}

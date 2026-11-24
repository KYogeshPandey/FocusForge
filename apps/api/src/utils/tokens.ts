import jwt, { type SignOptions } from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { CookieOptions } from 'express';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  sub: string; // userId
}

export function generateAccessToken(userId: string): string {
  const options: SignOptions = {
    expiresIn: env.ACCESS_TOKEN_TTL as SignOptions['expiresIn'],
  };
  return jwt.sign({ sub: userId }, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
}

export function generateRefreshTokenString(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export const INACTIVITY_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 hours (3 days) in ms

export function getRefreshTokenCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = env.NODE_ENV === 'production';
  const effectiveMaxAge =
    typeof maxAgeMs === 'number' ? Math.max(0, Math.floor(maxAgeMs)) : INACTIVITY_TIMEOUT_MS;
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: effectiveMaxAge,
  };
}

export const REFRESH_COOKIE_NAME = 'focusforge_refresh_token';

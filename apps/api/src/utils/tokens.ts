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

export const MAX_REFRESH_TOKEN_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000; // 10 years maximum boundary
export const MIN_REFRESH_TOKEN_TTL_MS = 1; // 1 millisecond minimum boundary

/**
 * Parses duration strings like '365d', '7d', '24h', '60m', '30s', '1000ms' into milliseconds.
 * Safely validates against zero, negative, malformed, non-finite, and excessively large TTL values,
 * falling back to defaultMs.
 */
export function parseDurationToMs(
  durationStr?: string,
  defaultMs: number = 365 * 24 * 60 * 60 * 1000
): number {
  if (!durationStr || typeof durationStr !== 'string') {
    return defaultMs;
  }
  const trimmed = durationStr.trim();
  const match = trimmed.match(/^(\d+)(ms|s|m|h|d|w|y)?$/i);
  let parsedMs: number;

  if (!match || !match[1]) {
    // Only accept pure integer digit strings like '1000'.
    // Reject scientific notation (e.g. '1e3'), floats, or malformed formats and fall back to defaultMs.
    if (/^\d+$/.test(trimmed)) {
      parsedMs = parseInt(trimmed, 10);
    } else {
      parsedMs = defaultMs;
    }
  } else {
    const value = parseInt(match[1], 10);
    const unit = (match[2] || 'ms').toLowerCase();
    switch (unit) {
      case 'ms':
        parsedMs = value;
        break;
      case 's':
        parsedMs = value * 1000;
        break;
      case 'm':
        parsedMs = value * 60 * 1000;
        break;
      case 'h':
        parsedMs = value * 60 * 60 * 1000;
        break;
      case 'd':
        parsedMs = value * 24 * 60 * 60 * 1000;
        break;
      case 'w':
        parsedMs = value * 7 * 24 * 60 * 60 * 1000;
        break;
      case 'y':
        parsedMs = value * 365 * 24 * 60 * 60 * 1000;
        break;
      default:
        parsedMs = defaultMs;
    }
  }

  // Safety boundary check:
  // Reject non-finite (Infinity / NaN), <= 0 (zero / negative), or excessively large (> 10 years)
  if (
    !Number.isFinite(parsedMs) ||
    parsedMs < MIN_REFRESH_TOKEN_TTL_MS ||
    parsedMs > MAX_REFRESH_TOKEN_TTL_MS
  ) {
    return defaultMs;
  }

  return parsedMs;
}

/**
 * Returns the effective refresh token TTL in milliseconds,
 * respecting REFRESH_TOKEN_TTL from environment if set, with a 365-day default.
 */
export function getRefreshTokenTtlMs(): number {
  const configuredTtl = process.env.REFRESH_TOKEN_TTL || env.REFRESH_TOKEN_TTL || '365d';
  return parseDurationToMs(configuredTtl, 365 * 24 * 60 * 60 * 1000);
}

export const REFRESH_TOKEN_TTL_DAYS = 365;
export const REFRESH_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // Default 365 days in ms (31,536,000,000 ms)
export const INACTIVITY_TIMEOUT_MS = REFRESH_TOKEN_TTL_MS; // Backward-compatible alias

export function getRefreshTokenCookieOptions(maxAgeMs?: number): CookieOptions {
  const isProduction = env.NODE_ENV === 'production';
  const effectiveMaxAge =
    typeof maxAgeMs === 'number' ? Math.max(0, Math.floor(maxAgeMs)) : getRefreshTokenTtlMs();
  return {
    httpOnly: true,
    secure: isProduction,
    // In production cross-site deployment (e.g. Vercel frontend to Render backend), SameSite=None is required.
    // In development / test, SameSite=Lax allows HTTP without SSL.
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: effectiveMaxAge,
  };
}

export const REFRESH_COOKIE_NAME = 'focusforge_refresh_token';

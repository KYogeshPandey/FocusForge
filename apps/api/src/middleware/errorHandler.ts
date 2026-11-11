import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { sendError } from '../utils/response.js';
import { env } from '../config/env.js';

interface MongoDuplicateKeyError {
  code: number;
  keyPattern?: Record<string, unknown>;
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If response already sent, delegate to Express default error handler
  if (res.headersSent) {
    return _next(err as Error);
  }

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.code, err.message, err.details);
    return;
  }

  // 2. Zod validation errors
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(res, 422, 'VALIDATION_ERROR', 'Input validation failed', details);
    return;
  }

  // 3. Mongoose CastError (e.g. invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    sendError(res, 400, 'INVALID_ID', `Invalid identifier format for parameter: ${err.path}`);
    return;
  }

  // 4. Mongoose ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    sendError(res, 400, 'VALIDATION_ERROR', 'Database validation failed', details);
    return;
  }

  // 5. MongoDB duplicate key error (E11000)
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as MongoDuplicateKeyError).code === 11000
  ) {
    const duplicateErr = err as MongoDuplicateKeyError;
    const field = Object.keys(duplicateErr.keyPattern || {})[0] || 'field';
    sendError(res, 409, 'CONFLICT', `A record with this ${field} already exists.`);
    return;
  }

  // 6. JWT errors
  if (err instanceof jwt.TokenExpiredError) {
    sendError(res, 401, 'TOKEN_EXPIRED', 'Access token has expired. Please refresh your session.');
    return;
  }
  if (err instanceof jwt.JsonWebTokenError) {
    sendError(res, 401, 'INVALID_TOKEN', 'Access token is invalid.');
    return;
  }

  // 7. Fallback unhandled internal server error
  if (env.NODE_ENV !== 'test') {
    console.error('Unhandled Server Error:', err);
  }

  sendError(
    res,
    500,
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred. Please try again later.'
  );
}

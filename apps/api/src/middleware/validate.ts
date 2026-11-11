import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z, ZodObject, type ZodTypeAny } from 'zod';

export const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid identifier format; must be a 24-character hexadecimal ObjectId');

export interface ValidationTargets {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

export function validate(schemas: ValidationTargets): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.body) {
        // Enforce strictness on object schemas to block mass-assignment attempts
        const schema =
          schemas.body instanceof ZodObject ? schemas.body.strict() : schemas.body;
        req.body = await schema.parseAsync(req.body);
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

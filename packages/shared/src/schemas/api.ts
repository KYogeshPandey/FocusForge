import { z } from 'zod';

export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  message: z.string(),
});
export type ApiErrorDetail = z.infer<typeof ApiErrorDetailSchema>;

export const ApiErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.array(ApiErrorDetailSchema).optional(),
});
export type ApiErrorPayload = z.infer<typeof ApiErrorPayloadSchema>;

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: ApiErrorPayloadSchema.optional(),
  });

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const DateRangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});
export type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;

export const AnalyticsQuerySchema = z.object({
  range: z.enum(['7', '30', '90']).default('7'),
});
export type AnalyticsQuery = z.infer<typeof AnalyticsQuerySchema>;

import { z } from 'zod';
import dotenv from 'dotenv';

// Load local .env if present
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1000).max(65535).default(5000),
  MONGODB_URI: z
    .string()
    .default(
      process.env.NODE_ENV === 'test'
        ? 'mongodb://127.0.0.1:27017/focusforge_test'
        : ''
    )
    .refine(
      (uri) => uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'),
      'MONGODB_URI must start with mongodb:// or mongodb+srv://'
    ),
  CLIENT_ORIGIN: z
    .string()
    .default('http://localhost:5173')
    .superRefine((val, ctx) => {
      const parts = val.split(',');
      for (const raw of parts) {
        const trimmed = raw.trim();
        if (!trimmed) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'CLIENT_ORIGIN must not contain empty origin entries',
          });
          return;
        }
        try {
          const url = new URL(trimmed);
          if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `CLIENT_ORIGIN entry "${trimmed}" must use http:// or https://`,
            });
            return;
          }
          if (url.username || url.password) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `CLIENT_ORIGIN entry "${trimmed}" must not contain credentials`,
            });
            return;
          }
          if (url.origin !== trimmed) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `CLIENT_ORIGIN entry "${trimmed}" must be a pure origin without path, query, or fragment (expected "${url.origin}")`,
            });
            return;
          }
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `CLIENT_ORIGIN entry "${trimmed}" is not a valid URL`,
          });
          return;
        }
      }
    })
    .transform((val) =>
      val
        .split(',')
        .map((s) => s.trim())
        .join(',')
    ),
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters long'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters long'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('365d'),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const formattedErrors = error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    console.error('CRITICAL: Environment variable validation failed:\n' + formattedErrors);
  } else {
    console.error('CRITICAL: Unexpected error validating environment variables:', error);
  }
  process.exit(1);
}

export const env = parsedEnv;

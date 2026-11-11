import express, { type Application } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { apiV1Router } from './routes/index.js';
import { healthRoutes } from './routes/healthRoutes.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';

export function createApp(): Application {
  const app = express();

  // 1. Trust reverse proxy (needed for secure cookies and rate limiting in production)
  app.set('trust proxy', 1);

  // 2. Security HTTP headers
  app.use(helmet());

  // 3. CORS configuration
  app.use(
    cors({
      origin: env.CLIENT_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // 4. Request logging with pino (disabled in test to keep test output clean)
  if (env.NODE_ENV !== 'test') {
    app.use(
      pinoHttp({
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
            };
          },
        },
      })
    );
  }

  // 5. Body parsers with size limit
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // 6. Cookie parser
  app.use(cookieParser());

  // 7. NoSQL injection sanitization
  app.use(mongoSanitize());

  // 8. Top-level health check endpoint
  app.use('/health', healthRoutes);

  // 9. API v1 routes with general rate limiter
  app.use('/api/v1', apiLimiter, apiV1Router);

  // 10. 404 handler
  app.use(notFoundHandler);

  // 11. Central error handling middleware
  app.use(errorHandler);

  return app;
}

export const app = createApp();

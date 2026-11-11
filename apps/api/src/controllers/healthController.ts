import type { Request, Response } from 'express';
import { isDbConnected } from '../config/db.js';
import { sendSuccess } from '../utils/response.js';

export class HealthController {
  check(_req: Request, res: Response): void {
    const dbConnected = isDbConnected();
    const statusCode = dbConnected ? 200 : 503;

    sendSuccess(
      res,
      {
        status: dbConnected ? 'healthy' : 'degraded',
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        database: {
          connected: dbConnected,
          status: dbConnected ? 'connected' : 'disconnected',
        },
      },
      statusCode
    );
  }
}

export const healthController = new HealthController();

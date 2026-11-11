import type { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { sendSuccess } from '../utils/response.js';

export class AnalyticsController {
  async getSummary(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const range = parseInt(req.query.range as string, 10) || 7;
    const summary = await analyticsService.getSummary(userId, range);
    sendSuccess(res, summary);
  }
}

export const analyticsController = new AnalyticsController();

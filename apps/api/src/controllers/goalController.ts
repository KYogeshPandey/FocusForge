import type { Request, Response } from 'express';
import { goalService } from '../services/goalService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export class GoalController {
  async get(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const goal = await goalService.get(userId);
    sendSuccess(res, goal);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const goal = await goalService.create(userId, req.body);
    sendSuccess(res, goal, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const updated = await goalService.update(userId, id!, req.body);
    sendSuccess(res, updated);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    await goalService.delete(userId, id!);
    sendNoContent(res);
  }
}

export const goalController = new GoalController();

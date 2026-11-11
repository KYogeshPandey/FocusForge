import type { Request, Response } from 'express';
import { habitService } from '../services/habitService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export class HabitController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const includeArchived = req.query.includeArchived === 'true';
    const habits = await habitService.list(userId, includeArchived);
    sendSuccess(res, habits);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const habit = await habitService.getById(userId, id!);
    sendSuccess(res, habit);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const habit = await habitService.create(userId, req.body);
    sendSuccess(res, habit, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const updated = await habitService.update(userId, id!, req.body);
    sendSuccess(res, updated);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    await habitService.delete(userId, id!);
    sendNoContent(res);
  }

  // --- Completions ---

  async listCompletions(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { from, to, habitId } = req.query;
    const completions = await habitService.listCompletions(userId, {
      from: from as string | undefined,
      to: to as string | undefined,
      habitId: habitId as string | undefined,
    });
    sendSuccess(res, completions);
  }

  async recordCompletion(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const { date, completed } = req.body;
    const result = await habitService.recordCompletion(
      userId,
      id!,
      date,
      completed !== undefined ? completed : true
    );
    sendSuccess(res, result, 200);
  }

  async deleteCompletion(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id, date } = req.params;
    await habitService.deleteCompletion(userId, id!, date!);
    sendNoContent(res);
  }
}

export const habitController = new HabitController();

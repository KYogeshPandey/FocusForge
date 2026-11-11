import type { Request, Response } from 'express';
import { taskService, type ListTasksOptions } from '../services/taskService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export class TaskController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await taskService.list(userId, req.query as unknown as ListTasksOptions);
    sendSuccess(res, result);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const task = await taskService.getById(userId, id!);
    sendSuccess(res, task);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const task = await taskService.create(userId, req.body);
    sendSuccess(res, task, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const updated = await taskService.update(userId, id!, req.body);
    sendSuccess(res, updated);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    await taskService.delete(userId, id!);
    sendNoContent(res);
  }
}

export const taskController = new TaskController();

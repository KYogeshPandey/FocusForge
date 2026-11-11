import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export class FocusSessionController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { from, to } = req.query;
    const sessions = await sessionService.listFocusSessions(userId, {
      from: from as string | undefined,
      to: to as string | undefined,
    });
    sendSuccess(res, sessions);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const session = await sessionService.createFocusSession(userId, req.body);
    sendSuccess(res, session, 201);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    await sessionService.deleteFocusSession(userId, id!);
    sendNoContent(res);
  }
}

export const focusSessionController = new FocusSessionController();

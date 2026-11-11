import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService.js';
import { sendSuccess, sendNoContent } from '../utils/response.js';

export class StudySessionController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { from, to, date } = req.query;
    const sessions = await sessionService.listStudySessions(userId, {
      from: from as string | undefined,
      to: to as string | undefined,
      date: date as string | undefined,
    });
    sendSuccess(res, sessions);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const session = await sessionService.getStudySessionById(userId, id!);
    sendSuccess(res, session);
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const session = await sessionService.createStudySession(userId, req.body);
    sendSuccess(res, session, 201);
  }

  async update(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    const updated = await sessionService.updateStudySession(userId, id!, req.body);
    sendSuccess(res, updated);
  }

  async delete(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const { id } = req.params;
    await sessionService.deleteStudySession(userId, id!);
    sendNoContent(res);
  }
}

export const studySessionController = new StudySessionController();

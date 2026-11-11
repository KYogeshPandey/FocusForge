import type { Request, Response } from 'express';
import { importService } from '../services/importService.js';
import { sendSuccess } from '../utils/response.js';

export class ImportController {
  async importData(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const summary = await importService.importData(userId, req.body);
    sendSuccess(res, summary, 201);
  }
}

export const importController = new ImportController();

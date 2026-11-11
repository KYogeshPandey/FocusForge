import type { FilterQuery } from 'mongoose';
import { StudySession, type IStudySession } from '../models/StudySession.js';
import { FocusSession, type IFocusSession } from '../models/FocusSession.js';
import { Task } from '../models/Task.js';
import { AppError } from '../utils/AppError.js';
import type {
  CreateStudySessionInput,
  UpdateStudySessionInput,
  CreateFocusSessionInput,
} from '@focusforge/shared';

export class SessionService {
  // --- Planned Study Sessions ---

  async listStudySessions(
    userId: string,
    options: { from?: string; to?: string; date?: string } = {}
  ) {
    const query: FilterQuery<IStudySession> = { userId };

    if (options.date) {
      query.date = options.date;
    } else if (options.from || options.to) {
      query.date = {};
      if (options.from) query.date.$gte = options.from;
      if (options.to) query.date.$lte = options.to;
    }

    const sessions = await StudySession.find(query).sort({ date: 1, startTime: 1 });
    return sessions.map((s) => s.toJSON());
  }

  async getStudySessionById(userId: string, id: string) {
    const session = await StudySession.findOne({ _id: id, userId });
    if (!session) {
      throw AppError.notFound('Study session not found');
    }
    return session.toJSON();
  }

  async createStudySession(userId: string, input: CreateStudySessionInput) {
    if (input.taskId) {
      const task = await Task.findOne({ _id: input.taskId, userId });
      if (!task) {
        throw AppError.badRequest('Referenced task does not belong to you or does not exist');
      }
    }

    const session = await StudySession.create({
      userId,
      title: input.title,
      subject: input.subject,
      date: input.date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      taskId: input.taskId || null,
      status: input.status || 'scheduled',
      notes: input.notes,
    });

    return session.toJSON();
  }

  async updateStudySession(
    userId: string,
    id: string,
    patch: UpdateStudySessionInput
  ) {
    const session = await StudySession.findOne({ _id: id, userId });
    if (!session) {
      throw AppError.notFound('Study session not found');
    }

    if (patch.taskId !== undefined) {
      if (patch.taskId) {
        const task = await Task.findOne({ _id: patch.taskId, userId });
        if (!task) {
          throw AppError.badRequest('Referenced task does not belong to you or does not exist');
        }
        session.taskId = task._id;
      } else {
        session.taskId = null;
      }
    }

    if (patch.title !== undefined) session.title = patch.title;
    if (patch.subject !== undefined) session.subject = patch.subject;
    if (patch.date !== undefined) session.date = patch.date;
    if (patch.startTime !== undefined) session.startTime = patch.startTime;
    if (patch.durationMinutes !== undefined) session.durationMinutes = patch.durationMinutes;
    if (patch.status !== undefined) session.status = patch.status;
    if (patch.notes !== undefined) session.notes = patch.notes;

    await session.save();
    return session.toJSON();
  }

  async deleteStudySession(userId: string, id: string) {
    const session = await StudySession.findOneAndDelete({ _id: id, userId });
    if (!session) {
      throw AppError.notFound('Study session not found');
    }
  }

  // --- Recorded Focus Sessions ---

  async listFocusSessions(
    userId: string,
    options: { from?: string; to?: string } = {}
  ) {
    const query: FilterQuery<IFocusSession> = { userId };

    if (options.from || options.to) {
      query.startedAt = {};
      if (options.from) query.startedAt.$gte = options.from;
      if (options.to) query.startedAt.$lte = options.to;
    }

    const sessions = await FocusSession.find(query).sort({ startedAt: -1 });
    return sessions.map((s) => s.toJSON());
  }

  async createFocusSession(userId: string, input: CreateFocusSessionInput) {
    if (input.clientSessionId) {
      const existing = await FocusSession.findOne({
        userId,
        clientSessionId: input.clientSessionId,
      });
      if (existing) {
        return existing.toJSON();
      }
    }

    if (input.taskId) {
      const task = await Task.findOne({ _id: input.taskId, userId });
      if (!task) {
        throw AppError.badRequest('Referenced task does not belong to you or does not exist');
      }
    }

    const session = await FocusSession.create({
      userId,
      clientSessionId: input.clientSessionId || null,
      title: input.title,
      subject: input.subject,
      durationMinutes: input.durationMinutes,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
      mode: input.mode || 'focus',
      taskId: input.taskId || null,
    });

    return session.toJSON();
  }

  async deleteFocusSession(userId: string, id: string) {
    const session = await FocusSession.findOneAndDelete({ _id: id, userId });
    if (!session) {
      throw AppError.notFound('Focus session not found');
    }
  }
}

export const sessionService = new SessionService();

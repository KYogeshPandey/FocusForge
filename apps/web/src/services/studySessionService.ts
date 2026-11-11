import { LocalStorageAdapter } from './storage/storageAdapter';
import {
  StudySessionSchema,
  CreateStudySessionInputSchema,
  type StudySession,
  type CreateStudySessionInput,
  type UpdateStudySessionInput,
} from '@focusforge/shared';

export interface IStudySessionService {
  list(date?: string): Promise<StudySession[]>;
  getById(id: string): Promise<StudySession | null>;
  create(input: CreateStudySessionInput): Promise<StudySession>;
  update(id: string, patch: UpdateStudySessionInput): Promise<StudySession>;
  remove(id: string): Promise<void>;
}

export class StudySessionService implements IStudySessionService {
  async list(date?: string): Promise<StudySession[]> {
    const raw = LocalStorageAdapter.getItem<StudySession[]>(
      LocalStorageAdapter.studySessionsKey,
      []
    );
    if (!date) return raw;
    return raw.filter((s) => s.date === date);
  }

  async getById(id: string): Promise<StudySession | null> {
    const all = await this.list();
    return all.find((s) => s.id === id) || null;
  }

  async create(input: CreateStudySessionInput): Promise<StudySession> {
    const validated = CreateStudySessionInputSchema.parse(input);
    const now = new Date().toISOString();
    const newSession: StudySession = {
      ...validated,
      id: `study_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: validated.userId || 'user-default',
      createdAt: now,
      updatedAt: now,
    };

    StudySessionSchema.parse(newSession);

    const sessions = LocalStorageAdapter.getItem<StudySession[]>(
      LocalStorageAdapter.studySessionsKey,
      []
    );
    sessions.push(newSession);
    LocalStorageAdapter.setItem(LocalStorageAdapter.studySessionsKey, sessions);

    return newSession;
  }

  async update(id: string, patch: UpdateStudySessionInput): Promise<StudySession> {
    const sessions = LocalStorageAdapter.getItem<StudySession[]>(
      LocalStorageAdapter.studySessionsKey,
      []
    );
    const index = sessions.findIndex((s) => s.id === id);
    if (index === -1) {
      throw new Error(`Study session with ID ${id} not found`);
    }

    const current = sessions[index]!;
    const now = new Date().toISOString();
    const updated: StudySession = {
      ...current,
      ...patch,
      updatedAt: now,
    };

    StudySessionSchema.parse(updated);
    sessions[index] = updated;
    LocalStorageAdapter.setItem(LocalStorageAdapter.studySessionsKey, sessions);

    return updated;
  }

  async remove(id: string): Promise<void> {
    const sessions = LocalStorageAdapter.getItem<StudySession[]>(
      LocalStorageAdapter.studySessionsKey,
      []
    );
    const filtered = sessions.filter((s) => s.id !== id);
    LocalStorageAdapter.setItem(LocalStorageAdapter.studySessionsKey, filtered);
  }
}

export const studySessionService = new StudySessionService();

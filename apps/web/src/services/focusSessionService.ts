import { LocalStorageAdapter } from './storage/storageAdapter';
import {
  FocusSessionSchema,
  CreateFocusSessionInputSchema,
  type FocusSession,
  type CreateFocusSessionInput,
} from '@focusforge/shared';

export interface IFocusSessionService {
  list(): Promise<FocusSession[]>;
  create(input: CreateFocusSessionInput): Promise<FocusSession>;
  clear(): Promise<void>;
}

export class FocusSessionService implements IFocusSessionService {
  async list(): Promise<FocusSession[]> {
    const raw = LocalStorageAdapter.getItem<FocusSession[]>(
      LocalStorageAdapter.focusSessionsKey,
      []
    );
    // Return sorted newest first
    return raw.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async create(input: CreateFocusSessionInput): Promise<FocusSession> {
    const validated = CreateFocusSessionInputSchema.parse(input);
    const newSession: FocusSession = {
      ...validated,
      id: `focus_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: validated.userId || 'user-default',
      createdAt: new Date().toISOString(),
    };

    FocusSessionSchema.parse(newSession);

    const sessions = LocalStorageAdapter.getItem<FocusSession[]>(
      LocalStorageAdapter.focusSessionsKey,
      []
    );
    sessions.unshift(newSession);
    LocalStorageAdapter.setItem(LocalStorageAdapter.focusSessionsKey, sessions);

    return newSession;
  }

  async clear(): Promise<void> {
    LocalStorageAdapter.setItem(LocalStorageAdapter.focusSessionsKey, []);
  }
}

export const focusSessionService = new FocusSessionService();

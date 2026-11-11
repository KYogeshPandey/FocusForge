import { apiClient } from './apiClient';
import { FocusSessionOutbox } from '../outbox/focusSessionOutbox';
import type { IFocusSessionService } from '../focusSessionService';
import type { FocusSession, CreateFocusSessionInput } from '@focusforge/shared';

export class ApiFocusSessionService implements IFocusSessionService {
  async list(): Promise<FocusSession[]> {
    return apiClient.get<FocusSession[]>('/focus-sessions');
  }

  async create(input: CreateFocusSessionInput): Promise<FocusSession> {
    return FocusSessionOutbox.recordSession(input, async (payload) => {
      return apiClient.post<FocusSession>('/focus-sessions', payload);
    });
  }

  async clear(): Promise<void> {
    // API endpoint doesn't have a single bulk wipe for safety; list and delete or no-op
    const sessions = await this.list();
    await Promise.all(sessions.map((s) => apiClient.delete(`/focus-sessions/${s.id}`)));
  }
}

export const apiFocusSessionService = new ApiFocusSessionService();

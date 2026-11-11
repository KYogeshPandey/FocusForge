import { apiClient } from './apiClient';
import { ApiError } from './apiError';
import type { IStudySessionService } from '../studySessionService';
import type {
  StudySession,
  CreateStudySessionInput,
  UpdateStudySessionInput,
} from '@focusforge/shared';

export class ApiStudySessionService implements IStudySessionService {
  async list(date?: string): Promise<StudySession[]> {
    const endpoint = date ? `/study-sessions?date=${date}` : '/study-sessions';
    return apiClient.get<StudySession[]>(endpoint);
  }

  async getById(id: string): Promise<StudySession | null> {
    try {
      return await apiClient.get<StudySession>(`/study-sessions/${id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  async create(input: CreateStudySessionInput): Promise<StudySession> {
    return apiClient.post<StudySession>('/study-sessions', input);
  }

  async update(id: string, patch: UpdateStudySessionInput): Promise<StudySession> {
    return apiClient.patch<StudySession>(`/study-sessions/${id}`, patch);
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/study-sessions/${id}`);
  }
}

export const apiStudySessionService = new ApiStudySessionService();

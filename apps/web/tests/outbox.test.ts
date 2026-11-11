import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FocusSessionOutbox } from '../src/services/outbox/focusSessionOutbox';
import { useAuthStore } from '../src/stores/useAuthStore';
import { apiClient } from '../src/services/api/apiClient';
import type { CreateFocusSessionInput, FocusSession } from '@focusforge/shared';

describe('Focus Session Persistent Outbox', () => {
  const OUTBOX_KEY = 'focusforge_v1_focus_session_outbox';

  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        id: 'usr_outbox_test',
        name: 'Outbox User',
        email: 'outbox@test.com',
        preferences: {} as any,
        createdAt: '',
        updatedAt: '',
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records immediately when online', async () => {
    const input: CreateFocusSessionInput = {
      title: 'Online Focus',
      subject: 'Math',
      durationMinutes: 25,
      startedAt: '2026-10-28T10:00:00.000Z',
      endedAt: '2026-10-28T10:25:00.000Z',
      mode: 'focus',
    };

    const mockApiCall = vi.fn().mockResolvedValue({
      id: 'focus_api_1',
      ...input,
      userId: 'usr_outbox_test',
      createdAt: new Date().toISOString(),
    });

    const result = await FocusSessionOutbox.recordSession(input, mockApiCall);

    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(result.id).toBe('focus_api_1');
    expect(FocusSessionOutbox.getPendingCount()).toBe(0);
  });

  it('queues session to localStorage outbox on network failure and returns optimistic session', async () => {
    const input: CreateFocusSessionInput = {
      title: 'Offline Focus',
      subject: 'Physics',
      durationMinutes: 30,
      startedAt: '2026-10-28T11:00:00.000Z',
      endedAt: '2026-10-28T11:30:00.000Z',
      mode: 'focus',
    };

    // Simulate network error
    const mockApiCall = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await FocusSessionOutbox.recordSession(input, mockApiCall);

    expect(result.id).toContain('local_opt_');
    expect(FocusSessionOutbox.getPendingCount()).toBe(1);

    const storedQueue = JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]');
    expect(storedQueue).toHaveLength(1);
    expect(storedQueue[0].input.title).toBe('Offline Focus');
  });

  it('flushes pending sessions when network is restored', async () => {
    // Pre-populate outbox
    const payload: CreateFocusSessionInput = {
      clientSessionId: 'cs_flush_1',
      title: 'Queued Session',
      subject: 'Biology',
      durationMinutes: 15,
      startedAt: '2026-10-28T12:00:00.000Z',
      endedAt: '2026-10-28T12:15:00.000Z',
      mode: 'focus',
    };

    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([
        {
          id: 'outbox_1',
          clientSessionId: 'cs_flush_1',
          input: payload,
          createdAt: new Date().toISOString(),
          retryCount: 0,
        },
      ])
    );

    expect(FocusSessionOutbox.getPendingCount()).toBe(1);

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue({
      id: 'synced_session_1',
      ...payload,
    } as unknown as FocusSession);

    const flushed = await FocusSessionOutbox.flush();

    expect(flushed).toBe(1);
    expect(postSpy).toHaveBeenCalledWith('/focus-sessions', payload);
    expect(FocusSessionOutbox.getPendingCount()).toBe(0);
  });
});

import { apiClient } from '../api/apiClient';
import { useAuthStore } from '../../stores/useAuthStore';
import type { CreateFocusSessionInput, FocusSession } from '@focusforge/shared';

const OUTBOX_KEY = 'focusforge_v1_focus_session_outbox';

export interface OutboxItem {
  id: string;
  clientSessionId: string;
  input: CreateFocusSessionInput;
  createdAt: string;
  retryCount: number;
}

export class FocusSessionOutbox {
  private static getQueue(): OutboxItem[] {
    try {
      const raw = localStorage.getItem(OUTBOX_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private static saveQueue(queue: OutboxItem[]): void {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('Failed to save focus session outbox:', err);
    }
  }

  public static getPendingCount(): number {
    return this.getQueue().length;
  }

  /**
   * Enqueues or immediately dispatches a focus session.
   * If network fails in authenticated mode, it persists the session in localStorage outbox.
   */
  public static async recordSession(
    input: CreateFocusSessionInput,
    apiServiceCall: (payload: CreateFocusSessionInput) => Promise<FocusSession>
  ): Promise<FocusSession> {
    const clientSessionId =
      input.clientSessionId || `cs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const payloadWithId: CreateFocusSessionInput = {
      ...input,
      clientSessionId,
    };

    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const authStatus = useAuthStore.getState().status;

    if (isOnline) {
      try {
        const session = await apiServiceCall(payloadWithId);
        return session;
      } catch (err) {
        // If it's a network error and user is authenticated, enqueue to outbox
        if (authStatus === 'authenticated') {
          this.enqueue(payloadWithId, clientSessionId);
        } else {
          throw err;
        }
      }
    } else {
      // Browser reports offline
      if (authStatus === 'authenticated') {
        this.enqueue(payloadWithId, clientSessionId);
      } else {
        return apiServiceCall(payloadWithId);
      }
    }

    // Return optimistic local session representation
    return {
      ...payloadWithId,
      id: `local_opt_${clientSessionId}`,
      userId: useAuthStore.getState().user?.id || 'user-offline',
      createdAt: new Date().toISOString(),
    };
  }

  private static enqueue(input: CreateFocusSessionInput, clientSessionId: string): void {
    const queue = this.getQueue();
    // Check if duplicate already enqueued
    if (!queue.some((item) => item.clientSessionId === clientSessionId)) {
      queue.push({
        id: `outbox_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        clientSessionId,
        input,
        createdAt: new Date().toISOString(),
        retryCount: 0,
      });
      this.saveQueue(queue);
    }
  }

  /**
   * Flushes all pending outbox sessions to the backend API idempotently.
   */
  public static async flush(): Promise<number> {
    const authStatus = useAuthStore.getState().status;
    if (authStatus !== 'authenticated') {
      return 0;
    }

    const queue = this.getQueue();
    if (queue.length === 0) return 0;

    const remaining: OutboxItem[] = [];
    let flushedCount = 0;

    for (const item of queue) {
      try {
        await apiClient.post<FocusSession>('/focus-sessions', item.input);
        flushedCount++;
      } catch (err: unknown) {
        // If server returned 400 with duplicate or similar, it's already recorded
        const isNetworkErr =
          err instanceof Error &&
          (err.message.includes('Network') || err.message.includes('fetch'));

        if (isNetworkErr) {
          item.retryCount += 1;
          remaining.push(item);
        }
        // If permanent 4xx (except network), drop item to prevent poison pill
      }
    }

    this.saveQueue(remaining);
    return flushedCount;
  }
}

// Auto-register window online listener
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    FocusSessionOutbox.flush().catch(() => {});
  });
}

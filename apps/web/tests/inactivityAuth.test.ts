import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuthStore } from '../src/stores/useAuthStore';
import { setAccessToken, getAccessToken } from '../src/services/api/apiClient';
import {
  recordUserActivity,
  getLastActiveTime,
  setLastActiveTime,
  isSessionExpiredDueToInactivity,
  INACTIVITY_EXPIRED_MESSAGE,
  LAST_ACTIVE_KEY,
} from '../src/services/activityTracker';
import type { UserProfile } from '@focusforge/shared';

describe('72-Hour Inactivity Timeout & Persistent Login', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    class MockBroadcastChannel {
      name: string;
      onmessage: ((event: unknown) => void) | null = null;
      constructor(name: string) {
        this.name = name;
      }
      postMessage(_data: unknown) {}
      close() {}
      addEventListener() {}
      removeEventListener() {}
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    localStorage.clear();
    setAccessToken(null);
    vi.restoreAllMocks();
    vi.useFakeTimers();

    useAuthStore.setState({
      user: null,
      accessToken: null,
      status: 'unauthenticated',
      hasCheckedSession: false,
      sessionExpiredMessage: null,
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.useRealTimers();
  });

  const mockUser: UserProfile = {
    id: 'user-123',
    name: 'Alex Rivera',
    email: 'alex@example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      theme: 'dark',
      focusDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4,
      soundEnabled: true,
      soundVolume: 70,
      weekStartDay: 'monday',
      timezone: 'UTC',
    },
  };

  it('1. Login and refresh browser: restores session seamlessly', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    // Mock login response
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/login')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { user: mockUser, accessToken: 'token-initial' },
          }),
        };
      }
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { accessToken: 'token-refreshed-on-reload' },
          }),
        };
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: mockUser }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    // 1. User logs in
    await useAuthStore.getState().login({ email: 'alex@example.com', password: 'password123' });

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(getAccessToken()).toBe('token-initial');
    expect(getLastActiveTime()).toBe(baseNow);

    // 2. Simulating browser refresh 10 minutes later: reset in-memory state
    vi.advanceTimersByTime(10 * 60 * 1000);
    setAccessToken(null);
    useAuthStore.setState({ user: null, accessToken: null, status: 'loading', hasCheckedSession: false });

    // App mount runs initializeAuth()
    await useAuthStore.getState().initializeAuth();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user?.name).toBe('Alex Rivera');
    expect(getAccessToken()).toBe('token-refreshed-on-reload');
    expect(useAuthStore.getState().sessionExpiredMessage).toBeNull();
  });

  it('2. Close and reopen browser within 72 hours: preserves authentication', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    setLastActiveTime(baseNow);

    // Browser reopens 8 hours later
    vi.advanceTimersByTime(8 * 60 * 60 * 1000);

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { accessToken: 'token-after-reopen' } }),
        };
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: mockUser }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    await useAuthStore.getState().initializeAuth();

    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(getAccessToken()).toBe('token-after-reopen');
    expect(useAuthStore.getState().sessionExpiredMessage).toBeNull();
  });

  it('3. Active usage for multiple days: session never expires when actively used', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    setLastActiveTime(baseNow);

    useAuthStore.setState({
      user: mockUser,
      accessToken: 'active-token',
      status: 'authenticated',
      hasCheckedSession: true,
    });

    // Simulate active usage once every 20 hours over 5 days (120 hours total)
    for (let day = 1; day <= 5; day++) {
      vi.advanceTimersByTime(20 * 60 * 60 * 1000);
      recordUserActivity(true);
      expect(isSessionExpiredDueToInactivity()).toBe(false);
    }

    // 100 hours passed, but user was never inactive for > 72 hours
    expect(isSessionExpiredDueToInactivity()).toBe(false);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('4. Inactivity for 24 hours: user remains logged in', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    setLastActiveTime(baseNow);

    // Advance 24 hours without any activity
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);

    expect(isSessionExpiredDueToInactivity()).toBe(false);
  });

  it('5. Inactivity for 71 hours: session remains valid right before deadline', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    setLastActiveTime(baseNow);

    // Advance 71 hours (1 hour remaining)
    vi.advanceTimersByTime(71 * 60 * 60 * 1000);

    expect(isSessionExpiredDueToInactivity()).toBe(false);
  });

  it('6. Inactivity beyond 72 hours: automatically logs out and displays required message', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    setLastActiveTime(baseNow);

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as unknown as Response);

    useAuthStore.setState({
      user: mockUser,
      accessToken: 'valid-token',
      status: 'authenticated',
      hasCheckedSession: true,
      sessionExpiredMessage: null,
    });

    // Advance 72 hours and 5 minutes (inactivity expired)
    vi.advanceTimersByTime(72 * 60 * 60 * 1000 + 5 * 60 * 1000);

    expect(isSessionExpiredDueToInactivity()).toBe(true);

    // Trigger logout due to inactivity
    await useAuthStore.getState().logoutDueToInactivity();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(state.sessionExpiredMessage).toBe(INACTIVITY_EXPIRED_MESSAGE);
    expect(state.sessionExpiredMessage).toBe('Your session expired due to 3 days of inactivity.');
  });

  it('7. Access token expiration and automatic proactive background refresh', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);
    setLastActiveTime(baseNow);

    let refreshCallCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/login')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { user: mockUser, accessToken: 'token-1' } }),
        };
      }
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { accessToken: `token-proactive-${refreshCallCount}` } }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    // Login starts proactive refresh timer (every 10 minutes)
    await useAuthStore.getState().login({ email: 'alex@example.com', password: 'password123' });
    expect(getAccessToken()).toBe('token-1');

    // Advance 10 minutes: proactive refresh fires before access token expires at 15m
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000);

    expect(refreshCallCount).toBe(1);
    expect(getAccessToken()).toBe('token-proactive-1');
    expect(useAuthStore.getState().status).toBe('authenticated');

    // Background refresh must NOT slide lastActiveTime forward
    expect(getLastActiveTime()).toBe(baseNow);
  });

  it('8. Explicit logout: immediately invalidates session without inactivity message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    } as unknown as Response);

    setLastActiveTime(Date.now());
    setAccessToken('some-token');
    useAuthStore.setState({
      user: mockUser,
      accessToken: 'some-token',
      status: 'authenticated',
      hasCheckedSession: true,
      sessionExpiredMessage: null,
    });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(localStorage.getItem(LAST_ACTIVE_KEY)).toBeNull();
    // Explicit logout does NOT show inactivity warning
    expect(state.sessionExpiredMessage).toBeNull();
  });

  it('9. Multiple tabs and concurrent refresh requests: deduplicates safely without race conditions', async () => {
    let refreshNetworkCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshNetworkCalls++;
        await Promise.resolve();
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: { accessToken: 'concurrent-refreshed-token' } }),
        };
      }
      if (url.includes('/auth/me')) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: mockUser }),
        };
      }
      return { ok: true, status: 200, json: async () => ({ success: true }) };
    });

    // Fire 3 refreshSession calls concurrently (as if multiple tabs or requests fired at once)
    const [r1, r2, r3] = await Promise.all([
      useAuthStore.getState().refreshSession(),
      useAuthStore.getState().refreshSession(),
      useAuthStore.getState().refreshSession(),
    ]);

    expect(r1).toBe(true);
    expect(r2).toBe(true);
    expect(r3).toBe(true);
    // In-flight refresh mutex must ensure only 1 network fetch occurred
    expect(refreshNetworkCalls).toBe(1);
    expect(getAccessToken()).toBe('concurrent-refreshed-token');
  });
});

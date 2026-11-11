import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  setOnAuthFailure,
  silentRefreshToken,
} from '../src/services/api/apiClient';
import { ApiError } from '../src/services/api/apiError';

describe('API Client (Native Fetch Wrapper)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('unwraps success envelope and returns data directly', async () => {
    const mockData = { id: 'task-123', title: 'Test Task' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: mockData }),
    } as unknown as Response);

    const result = await apiClient.get<typeof mockData>('/tasks/task-123');

    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('converts API error response into typed ApiError with status and code', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
      }),
    } as unknown as Response);

    await expect(apiClient.post('/tasks', {})).rejects.toThrow(ApiError);

    try {
      await apiClient.post('/tasks', {});
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.code).toBe('VALIDATION_ERROR');
      expect(apiErr.message).toBe('Title is required');
    }
  });

  it('attaches in-memory Bearer token to request headers', async () => {
    setAccessToken('test-jwt-token-xyz');

    global.fetch = vi.fn().mockImplementation((_url, options: RequestInit) => {
      const headers = options.headers as Headers;
      expect(headers.get('Authorization')).toBe('Bearer test-jwt-token-xyz');
      expect(options.credentials).toBe('include');
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { ok: true } }),
      } as unknown as Response);
    });

    await apiClient.get('/auth/me');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('executes silent refresh on 401 and retries original request with new token', async () => {
    setAccessToken('expired-access-token');

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string, options: RequestInit) => {
      callCount++;

      // First call: Protected endpoint returns 401
      if (url.includes('/tasks') && callCount === 1) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: false, error: { message: 'Token expired', code: 'UNAUTHORIZED' } }),
        } as unknown as Response);
      }

      // Second call: POST /auth/refresh returns fresh token
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({
            success: true,
            data: { accessToken: 'fresh-new-jwt-token' },
          }),
        } as unknown as Response);
      }

      // Third call: Retried original request with fresh token succeeds
      if (url.includes('/tasks') && callCount === 3) {
        const headers = options.headers as Headers;
        expect(headers.get('Authorization')).toBe('Bearer fresh-new-jwt-token');
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: true, data: [{ id: 'task-1' }] }),
        } as unknown as Response);
      }

      throw new Error(`Unexpected call to ${url}`);
    });

    const result = await apiClient.get<Array<{ id: string }>>('/tasks');

    expect(result).toEqual([{ id: 'task-1' }]);
    expect(getAccessToken()).toBe('fresh-new-jwt-token');
    expect(callCount).toBe(3);
  });

  it('prevents refresh stampede by coalescing concurrent refresh calls into single in-flight promise', async () => {
    setAccessToken('expired-token');

    let refreshCallCount = 0;
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        refreshCallCount++;
        // Simulate slight network delay
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              status: 200,
              headers: new Headers({ 'content-type': 'application/json' }),
              json: async () => ({
                success: true,
                data: { accessToken: 'shared-refreshed-token' },
              }),
            } as unknown as Response);
          }, 20);
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true, data: { ok: true } }),
      } as unknown as Response);
    });

    // Fire 3 concurrent silent refresh calls
    const [token1, token2, token3] = await Promise.all([
      silentRefreshToken(),
      silentRefreshToken(),
      silentRefreshToken(),
    ]);

    expect(token1).toBe('shared-refreshed-token');
    expect(token2).toBe('shared-refreshed-token');
    expect(token3).toBe('shared-refreshed-token');
    expect(refreshCallCount).toBe(1); // Exactly one network request made!
  });

  it('clears token and triggers auth failure callback when silent refresh fails', async () => {
    const onAuthFailureMock = vi.fn();
    setOnAuthFailure(onAuthFailureMock);
    setAccessToken('invalid-token');

    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/auth/refresh')) {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: async () => ({ success: false, error: { message: 'Refresh token invalid' } }),
        } as unknown as Response);
      }

      return Promise.resolve({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: false, error: { message: 'Unauthorized' } }),
      } as unknown as Response);
    });

    await expect(apiClient.get('/tasks')).rejects.toThrow('Session expired. Please log in again.');
    expect(getAccessToken()).toBeNull();
    expect(onAuthFailureMock).toHaveBeenCalled();
  });

  it('converts 429 status into clear rate-limiting ApiError message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: new Headers(),
    } as unknown as Response);

    await expect(apiClient.get('/tasks')).rejects.toThrow(
      'Too many requests. Please wait a moment and try again shortly.'
    );
  });
});

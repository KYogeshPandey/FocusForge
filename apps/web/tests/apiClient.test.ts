import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  apiClient,
  setAccessToken,
  getAccessToken,
  setOnAuthFailure,
  silentRefreshToken,
  BASE_URL,
  resolveApiBaseUrl,
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
    vi.unstubAllEnvs();
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

  it('does not trigger auth failure or clear session on temporary network errors during silent refresh', async () => {
    const onAuthFailureMock = vi.fn();
    setOnAuthFailure(onAuthFailureMock);
    setAccessToken('existing-access-token');

    // Simulate network error (e.g. TypeError: Failed to fetch)
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await silentRefreshToken();

    expect(result).toBeNull();
    // Auth failure callback MUST NOT be triggered on temporary network error
    expect(onAuthFailureMock).not.toHaveBeenCalled();
    // Access token must NOT be wiped by a network glitch
    expect(getAccessToken()).toBe('existing-access-token');
  });

  it('does not trigger auth failure or clear session on server 5xx errors during silent refresh', async () => {
    const onAuthFailureMock = vi.fn();
    setOnAuthFailure(onAuthFailureMock);
    setAccessToken('existing-access-token');

    // Simulate server 500 error
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: false, error: { message: 'Internal Server Error' } }),
    } as unknown as Response);

    const result = await silentRefreshToken();

    expect(result).toBeNull();
    // Server 5xx errors must NOT log the user out
    expect(onAuthFailureMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('existing-access-token');
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

  it('initializes BASE_URL with custom VITE_API_URL when configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', 'https://focusforge-api-68ro.onrender.com/api/v1');

    const customModule = await import('../src/services/api/apiClient');
    expect(customModule.BASE_URL).toBe('https://focusforge-api-68ro.onrender.com/api/v1');

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('supports relative VITE_API_URL for same-origin proxy and strips trailing slashes', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '/api/v1/');

    const relativeModule = await import('../src/services/api/apiClient');
    expect(relativeModule.BASE_URL).toBe('/api/v1');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: [] }),
    } as unknown as Response);

    await relativeModule.apiClient.get('/tasks');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/tasks',
      expect.objectContaining({ method: 'GET', credentials: 'include' })
    );

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('falls back to default localhost URL when VITE_API_URL is absent in non-prod', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();

    const defaultModule = await import('../src/services/api/apiClient');
    expect(defaultModule.BASE_URL).toBe('http://localhost:5000/api/v1');

    vi.resetModules();
  });

  it('defaults BASE_URL to /api/v1 in production builds when VITE_API_URL is absent', () => {
    expect(resolveApiBaseUrl({ viteApiUrl: undefined, isProd: true })).toBe('/api/v1');
    expect(resolveApiBaseUrl({ viteApiUrl: '', isProd: true })).toBe('/api/v1');
    expect(resolveApiBaseUrl({ viteApiUrl: undefined, isProd: false })).toBe(
      'http://localhost:5000/api/v1'
    );
    expect(
      resolveApiBaseUrl({ viteApiUrl: 'https://custom.example.com/api/v1/', isProd: true })
    ).toBe('https://custom.example.com/api/v1');
  });

  it('sends POST /auth/refresh with credentials include during silentRefreshToken', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_API_URL', '/api/v1');
    const proxyModule = await import('../src/services/api/apiClient');

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: { accessToken: 'proxy-refreshed-jwt' } }),
    } as unknown as Response);

    const refreshed = await proxyModule.silentRefreshToken();
    expect(refreshed).toBe('proxy-refreshed-jwt');
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      })
    );

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not trigger auth failure or clear access token when /auth/activity returns 401', async () => {
    const onAuthFailureMock = vi.fn();
    setOnAuthFailure(onAuthFailureMock);
    setAccessToken('valid-in-memory-jwt');

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication session required' },
      }),
    } as unknown as Response);

    await expect(apiClient.post('/auth/activity')).rejects.toThrow(
      'Authentication session required'
    );

    expect(onAuthFailureMock).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('valid-in-memory-jwt');
  });

  it('constructs endpoint paths correctly with BASE_URL', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ success: true, data: { status: 'healthy' } }),
    } as unknown as Response);

    await apiClient.get('/health');
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE_URL}/health`,
      expect.objectContaining({ method: 'GET' })
    );
  });
});

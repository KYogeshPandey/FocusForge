import { ApiError } from './apiError';

const DEFAULT_API_URL = 'http://localhost:5000/api/v1';

export const BASE_URL: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> })?.env?.VITE_API_URL) ||
  DEFAULT_API_URL;

// In-memory access token storage (never placed in localStorage / sessionStorage)
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

// Callback for handling authentication failures across the app
let onAuthFailureHandler: (() => void) | null = null;

export function setOnAuthFailure(handler: () => void): void {
  onAuthFailureHandler = handler;
}

// In-flight refresh promise mutex to prevent concurrent refresh stampedes
let activeRefreshPromise: Promise<string | null> | null = null;

export async function silentRefreshToken(): Promise<string | null> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        setAccessToken(null);
        if (onAuthFailureHandler) onAuthFailureHandler();
        return null;
      }

      const json = await response.json();
      if (json?.success && json?.data?.accessToken) {
        const newToken = json.data.accessToken as string;
        setAccessToken(newToken);
        return newToken;
      }

      setAccessToken(null);
      if (onAuthFailureHandler) onAuthFailureHandler();
      return null;
    } catch {
      setAccessToken(null);
      if (onAuthFailureHandler) onAuthFailureHandler();
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  skipAuth?: boolean;
}

/**
 * Standard typed HTTP client wrapping native fetch with:
 * - Credentials: 'include' for secure httpOnly refresh cookie
 * - In-memory JWT access token injection
 * - Transparent single-flight silent refresh mutex on 401
 * - AbortController timeout handling
 * - 429 Rate limiting message recovery
 * - Typed ApiError unwrapping
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 15000, skipAuth = false, headers: customHeaders, ...rest } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const requestHeaders = new Headers(customHeaders);
  if (!requestHeaders.has('Content-Type') && body !== undefined && !(body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  if (!skipAuth && inMemoryAccessToken && !requestHeaders.has('Authorization')) {
    requestHeaders.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions: RequestInit = {
    ...rest,
    headers: requestHeaders,
    credentials: 'include',
    signal: controller.signal,
    body:
      body !== undefined
        ? body instanceof FormData
          ? body
          : JSON.stringify(body)
        : undefined,
  };

  try {
    let response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    // Handle 401 Unauthorized for expired access token (except when on /auth/refresh or /auth/login)
    const isAuthEndpoint =
      endpoint.includes('/auth/login') ||
      endpoint.includes('/auth/refresh') ||
      endpoint.includes('/auth/register');

    if (response.status === 401 && !skipAuth && !isAuthEndpoint) {
      const refreshedToken = await silentRefreshToken();

      if (refreshedToken) {
        // Retry the original request with the fresh access token
        const retryHeaders = new Headers(requestHeaders);
        retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);

        const retryController = new AbortController();
        const retryTimeoutId = setTimeout(() => retryController.abort(), timeoutMs);

        try {
          response = await fetch(url, {
            ...fetchOptions,
            headers: retryHeaders,
            signal: retryController.signal,
          });
        } finally {
          clearTimeout(retryTimeoutId);
        }
      } else {
        throw new ApiError('Session expired. Please log in again.', 401, 'UNAUTHORIZED');
      }
    }

    // Handle 429 Too Many Requests
    if (response.status === 429) {
      throw new ApiError(
        'Too many requests. Please wait a moment and try again shortly.',
        429,
        'RATE_LIMITED'
      );
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!isJson) {
      if (!response.ok) {
        throw new ApiError(`HTTP Error ${response.status}`, response.status, 'HTTP_ERROR');
      }
      return undefined as unknown as T;
    }

    const json = await response.json();

    if (!response.ok || json.success === false) {
      const errorPayload = json.error || {};
      throw new ApiError(
        errorPayload.message || `Request failed with status ${response.status}`,
        response.status,
        errorPayload.code || 'API_ERROR',
        errorPayload.details
      );
    }

    return json.data as T;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError(
          'Request timed out. Please check your network and try again.',
          408,
          'TIMEOUT'
        );
      }
      if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
        throw new ApiError(
          'Network connection error. Please check your internet connection.',
          0,
          'NETWORK_ERROR'
        );
      }
      throw new ApiError(error.message, 500, 'CLIENT_ERROR');
    }

    throw new ApiError('An unexpected error occurred.', 500, 'UNKNOWN_ERROR');
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  patch: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
  put: <T>(endpoint: string, body?: unknown, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),
  delete: <T>(endpoint: string, options?: RequestOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};

import { create } from 'zustand';
import {
  type UserProfile,
  type LoginInput,
  type RegisterInput,
  type ChangePasswordInput,
  type DeleteAccountInput,
  type UpdateUserMeInput,
  type AuthSuccessData,
} from '@focusforge/shared';
import {
  apiClient,
  setAccessToken as setClientAccessToken,
  silentRefreshToken,
  setOnAuthFailure,
} from '../services/api/apiClient';
import {
  isSessionExpiredDueToInactivity,
  recordUserActivity,
  startActivityTracking,
  stopActivityTracking,
  clearActivityTracking,
  INACTIVITY_EXPIRED_MESSAGE,
} from '../services/activityTracker';

export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  status: AuthStatus;
  hasCheckedSession: boolean;
  sessionExpiredMessage: string | null;

  // Actions
  initializeAuth: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  logoutDueToInactivity: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateUser: (input: UpdateUserMeInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;
  setGuestMode: () => void;
  clearSessionExpiredMessage: () => void;
  handleAuthFailure: () => void;
  handleRemoteLogout: () => void;
  handleRemoteInactivityLogout: () => void;
}

// Proactive refresh timer reference (runs every 10 minutes)
let proactiveRefreshTimer: ReturnType<typeof setInterval> | null = null;

function startProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearInterval(proactiveRefreshTimer);
  }
  // Refresh every 10 minutes (access token TTL is 15 minutes)
  proactiveRefreshTimer = setInterval(async () => {
    const { status, logoutDueToInactivity } = useAuthStore.getState();
    if (status !== 'authenticated') return;

    // Check if 72-hour inactivity deadline was exceeded
    if (isSessionExpiredDueToInactivity()) {
      await logoutDueToInactivity();
      return;
    }

    // Refresh access token seamlessly in background
    try {
      const refreshed = await silentRefreshToken();
      if (refreshed) {
        setClientAccessToken(refreshed);
        useAuthStore.setState({ accessToken: refreshed });
      }
    } catch {
      // Ignore background refresh errors; retry on next request
    }
  }, 10 * 60 * 1000);
}

function stopProactiveRefresh(): void {
  if (proactiveRefreshTimer) {
    clearInterval(proactiveRefreshTimer);
    proactiveRefreshTimer = null;
  }
}

// Cross-tab broadcast channel for instant multi-tab sync
let authChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    authChannel = new BroadcastChannel('focusforge_auth_channel');
  } catch (err) {
    console.warn('BroadcastChannel not available:', err);
  }
}

export const useAuthStore = create<AuthState>((set, get) => {
  // Register client auth failure callback
  setOnAuthFailure(() => {
    get().handleAuthFailure();
  });

  // Listen to remote tab events
  if (authChannel) {
    authChannel.onmessage = (event) => {
      if (event?.data?.type === 'LOGOUT') {
        get().handleRemoteLogout();
      } else if (event?.data?.type === 'LOGOUT_INACTIVITY') {
        get().handleRemoteInactivityLogout();
      } else if (event?.data?.type === 'TOKEN_REFRESHED' && typeof event.data.accessToken === 'string') {
        setClientAccessToken(event.data.accessToken);
        set({ accessToken: event.data.accessToken });
      }
    };
  }

  // Fallback storage event listener for cross-tab logout
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'focusforge_auth_logout_event') {
        get().handleRemoteLogout();
      } else if (e.key === 'focusforge_auth_inactivity_logout_event') {
        get().handleRemoteInactivityLogout();
      }
    });
  }

  return {
    user: null,
    accessToken: null,
    status: 'loading',
    hasCheckedSession: false,
    sessionExpiredMessage: null,

    initializeAuth: async () => {
      // 1. Check if user exceeded 72 hours of inactivity while browser was closed
      if (isSessionExpiredDueToInactivity()) {
        clearActivityTracking();
        stopProactiveRefresh();
        setClientAccessToken(null);
        try {
          await apiClient.post('/auth/logout');
        } catch {}

        set({
          user: null,
          accessToken: null,
          status: 'unauthenticated',
          hasCheckedSession: true,
          sessionExpiredMessage: INACTIVITY_EXPIRED_MESSAGE,
        });
        return;
      }

      try {
        // Attempt silent refresh once at startup
        const token = await silentRefreshToken();
        if (token) {
          setClientAccessToken(token);
          // Fetch current user profile
          const profile = await apiClient.get<UserProfile>('/auth/me');

          // Record activity since launching the app counts as active usage
          recordUserActivity(true);

          set({
            user: profile,
            accessToken: token,
            status: 'authenticated',
            hasCheckedSession: true,
            sessionExpiredMessage: null,
          });

          // Start activity tracking and proactive refresh
          startActivityTracking(() => {
            get().logoutDueToInactivity();
          });
          startProactiveRefresh();
          return;
        }
      } catch {
        // Refresh failed: fallback to guest mode
      }

      setClientAccessToken(null);
      stopProactiveRefresh();
      stopActivityTracking();
      set({
        user: null,
        accessToken: null,
        status: 'guest',
        hasCheckedSession: true,
      });
    },

    login: async (input: LoginInput) => {
      const data = await apiClient.post<AuthSuccessData>('/auth/login', input, { skipAuth: true });
      setClientAccessToken(data.accessToken);

      // Record activity on successful login
      recordUserActivity(true);

      set({
        user: data.user,
        accessToken: data.accessToken,
        status: 'authenticated',
        hasCheckedSession: true,
        sessionExpiredMessage: null,
      });

      startActivityTracking(() => {
        get().logoutDueToInactivity();
      });
      startProactiveRefresh();
    },

    register: async (input: RegisterInput) => {
      const data = await apiClient.post<AuthSuccessData>('/auth/register', input, { skipAuth: true });
      setClientAccessToken(data.accessToken);

      // Record activity on successful registration
      recordUserActivity(true);

      set({
        user: data.user,
        accessToken: data.accessToken,
        status: 'authenticated',
        hasCheckedSession: true,
        sessionExpiredMessage: null,
      });

      startActivityTracking(() => {
        get().logoutDueToInactivity();
      });
      startProactiveRefresh();
    },

    logout: async () => {
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();

      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Ignore network errors on logout
      } finally {
        setClientAccessToken(null);
        set({
          user: null,
          accessToken: null,
          status: 'unauthenticated',
          sessionExpiredMessage: null,
        });

        // Notify other open tabs
        if (authChannel) {
          authChannel.postMessage({ type: 'LOGOUT' });
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('focusforge_auth_logout_event', Date.now().toString());
        }
      }
    },

    logoutDueToInactivity: async () => {
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();

      try {
        await apiClient.post('/auth/logout');
      } catch {
        // Ignore network errors on logout
      } finally {
        setClientAccessToken(null);
        set({
          user: null,
          accessToken: null,
          status: 'unauthenticated',
          sessionExpiredMessage: INACTIVITY_EXPIRED_MESSAGE,
        });

        // Notify other open tabs
        if (authChannel) {
          authChannel.postMessage({ type: 'LOGOUT_INACTIVITY' });
        }
        if (typeof window !== 'undefined') {
          localStorage.setItem('focusforge_auth_inactivity_logout_event', Date.now().toString());
        }
      }
    },

    refreshSession: async () => {
      if (isSessionExpiredDueToInactivity()) {
        await get().logoutDueToInactivity();
        return false;
      }

      const token = await silentRefreshToken();
      if (token) {
        setClientAccessToken(token);
        const profile = await apiClient.get<UserProfile>('/auth/me');
        set({
          user: profile,
          accessToken: token,
          status: 'authenticated',
        });
        return true;
      }
      get().handleAuthFailure();
      return false;
    },

    updateUser: async (input: UpdateUserMeInput) => {
      const updated = await apiClient.patch<UserProfile>('/auth/me', input);
      set({ user: updated });
    },

    changePassword: async (input: ChangePasswordInput) => {
      await apiClient.post('/auth/change-password', input);
    },

    deleteAccount: async (input: DeleteAccountInput) => {
      await apiClient.delete('/auth/me', { body: input });
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
        sessionExpiredMessage: null,
      });
      if (authChannel) {
        authChannel.postMessage({ type: 'LOGOUT' });
      }
    },

    setGuestMode: () => {
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'guest',
        sessionExpiredMessage: null,
      });
    },

    clearSessionExpiredMessage: () => {
      set({ sessionExpiredMessage: null });
    },

    handleAuthFailure: () => {
      stopProactiveRefresh();
      stopActivityTracking();
      setClientAccessToken(null);

      // Check if this failure was due to inactivity
      const isInactive = isSessionExpiredDueToInactivity();
      if (isInactive) {
        clearActivityTracking();
      }

      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
        sessionExpiredMessage: isInactive ? INACTIVITY_EXPIRED_MESSAGE : null,
      });
    },

    handleRemoteLogout: () => {
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
        sessionExpiredMessage: null,
      });
    },

    handleRemoteInactivityLogout: () => {
      stopProactiveRefresh();
      stopActivityTracking();
      clearActivityTracking();
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
        sessionExpiredMessage: INACTIVITY_EXPIRED_MESSAGE,
      });
    },
  };
});

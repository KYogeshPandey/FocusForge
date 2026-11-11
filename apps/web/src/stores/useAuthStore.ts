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

export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  status: AuthStatus;
  hasCheckedSession: boolean;

  // Actions
  initializeAuth: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<boolean>;
  updateUser: (input: UpdateUserMeInput) => Promise<void>;
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  deleteAccount: (input: DeleteAccountInput) => Promise<void>;
  setGuestMode: () => void;
  handleAuthFailure: () => void;
  handleRemoteLogout: () => void;
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
      }
    };
  }

  // Fallback storage event listener for cross-tab logout
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'focusforge_auth_logout_event') {
        get().handleRemoteLogout();
      }
    });
  }

  return {
    user: null,
    accessToken: null,
    status: 'loading',
    hasCheckedSession: false,

    initializeAuth: async () => {
      try {
        // Attempt silent refresh once at startup
        const token = await silentRefreshToken();
        if (token) {
          setClientAccessToken(token);
          // Fetch current user profile
          const profile = await apiClient.get<UserProfile>('/auth/me');
          set({
            user: profile,
            accessToken: token,
            status: 'authenticated',
            hasCheckedSession: true,
          });
          return;
        }
      } catch {
        // Refresh failed: fallback to guest mode
      }

      setClientAccessToken(null);
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
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: 'authenticated',
        hasCheckedSession: true,
      });
    },

    register: async (input: RegisterInput) => {
      const data = await apiClient.post<AuthSuccessData>('/auth/register', input, { skipAuth: true });
      setClientAccessToken(data.accessToken);
      set({
        user: data.user,
        accessToken: data.accessToken,
        status: 'authenticated',
        hasCheckedSession: true,
      });
    },

    logout: async () => {
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

    refreshSession: async () => {
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
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
      });
      if (authChannel) {
        authChannel.postMessage({ type: 'LOGOUT' });
      }
    },

    setGuestMode: () => {
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'guest',
      });
    },

    handleAuthFailure: () => {
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
      });
    },

    handleRemoteLogout: () => {
      setClientAccessToken(null);
      set({
        user: null,
        accessToken: null,
        status: 'unauthenticated',
      });
    },
  };
});

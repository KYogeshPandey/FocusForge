import { apiClient, getAccessToken } from './api/apiClient';

export const INACTIVITY_TIMEOUT_MS = 72 * 60 * 60 * 1000; // 72 hours (3 days)
export const INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
export const LOCAL_ACTIVITY_THROTTLE_MS = 30 * 1000; // Throttle local writes to 30s
export const SERVER_ACTIVITY_THROTTLE_MS = 5 * 60 * 1000; // Throttle server ping to 5m
export const LAST_ACTIVE_KEY = 'focusforge_last_active_at';
export const INACTIVITY_EXPIRED_MESSAGE = 'Your session expired due to 3 days of inactivity.';

let lastLocalTimestamp = 0;
let lastServerTimestamp = 0;
let isTracking = false;
let checkIntervalId: ReturnType<typeof setInterval> | null = null;
let onTimeoutCallback: (() => void) | null = null;

// Multi-tab broadcast channel for activity and session events
let activityChannel: BroadcastChannel | null = null;
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    activityChannel = new BroadcastChannel('focusforge_activity_channel');
  } catch {
    // BroadcastChannel not available or restricted
  }
}

export function getLastActiveTime(): number {
  if (typeof window === 'undefined') return Date.now();
  try {
    const raw = localStorage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return Date.now();
    const parsed = parseInt(raw, 10);
    return isNaN(parsed) ? Date.now() : parsed;
  } catch {
    return Date.now();
  }
}

export function setLastActiveTime(timestamp: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, timestamp.toString());
    lastLocalTimestamp = timestamp;
  } catch {
    // LocalStorage quota or access denied
  }
}

export function isSessionExpiredDueToInactivity(_timeoutMs = INACTIVITY_TIMEOUT_MS): boolean {
  // Persistent authentication policy: users remain logged in across inactivity
  return false;
}

export function recordUserActivity(forceServerSync = false): void {
  const now = Date.now();

  // 1. Throttle local storage updates
  if (forceServerSync || now - lastLocalTimestamp >= LOCAL_ACTIVITY_THROTTLE_MS) {
    setLastActiveTime(now);

    // Broadcast activity to other tabs
    if (activityChannel) {
      try {
        activityChannel.postMessage({ type: 'ACTIVITY_PING', timestamp: now });
      } catch {}
    }
  }

  // 2. Throttle server activity updates (only when authenticated)
  if (forceServerSync || now - lastServerTimestamp >= SERVER_ACTIVITY_THROTTLE_MS) {
    lastServerTimestamp = now;
    if (getAccessToken()) {
      apiClient.post('/auth/activity').catch(() => {
        // Offline or network hiccup; activity is still preserved locally
      });
    }
  }
}

export function checkInactivity(): boolean {
  if (isSessionExpiredDueToInactivity()) {
    if (onTimeoutCallback) {
      onTimeoutCallback();
    }
    return true;
  }
  return false;
}

export function startActivityTracking(onInactivity: () => void): () => void {
  if (typeof window === 'undefined') return () => {};

  onTimeoutCallback = onInactivity;

  if (isTracking) return stopActivityTracking;
  isTracking = true;

  const handleInteraction = () => {
    recordUserActivity(false);
  };

  const events: (keyof WindowEventMap)[] = ['click', 'keydown', 'pointerdown', 'touchstart', 'scroll'];

  events.forEach((event) => {
    window.addEventListener(event, handleInteraction, { passive: true });
  });

  // Re-check on tab focus / visibility change
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      if (!checkInactivity()) {
        recordUserActivity(false);
      }
    }
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);

  // Cross-tab activity listener
  if (activityChannel) {
    try {
      activityChannel.onmessage = (e) => {
        if (e?.data?.type === 'ACTIVITY_PING' && typeof e.data.timestamp === 'number') {
          lastLocalTimestamp = e.data.timestamp;
        }
      };
    } catch {}
  }

  // Periodic inactivity check
  checkIntervalId = setInterval(() => {
    checkInactivity();
  }, INACTIVITY_CHECK_INTERVAL_MS);

  return stopActivityTracking;
}

export function stopActivityTracking(): void {
  if (typeof window === 'undefined') return;

  isTracking = false;
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
}

export function clearActivityTracking(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LAST_ACTIVE_KEY);
    lastLocalTimestamp = 0;
    lastServerTimestamp = 0;
  } catch {}
  stopActivityTracking();
}

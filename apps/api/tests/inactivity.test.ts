import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';
import { REFRESH_COOKIE_NAME, INACTIVITY_TIMEOUT_MS, hashToken } from '../src/utils/tokens.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

describe('72-Hour Inactivity Timeout & Activity Tracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets 72-hour (3-day) expiration on registration and login', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Inactive User', 'inactivity-test@example.com', 'password123');
    expect(user.status).toBe(201);

    const tokenRecord = await RefreshToken.findOne({ tokenHash: hashToken(user.refreshToken) });
    expect(tokenRecord).not.toBeNull();
    // Expiration must be exactly 72 hours from now
    expect(tokenRecord!.expiresAt.getTime()).toBe(baseNow + INACTIVITY_TIMEOUT_MS);
    expect(tokenRecord!.lastActiveAt.getTime()).toBe(baseNow);

    // Verify cookie maxAge header is 72 hours (259200 seconds)
    const cookie = user.cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('Max-Age=259200'); // 72 * 3600
  });

  it('allows token refresh after 24 hours of inactivity', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('User 24h', 'user24h@example.com', 'password123');

    // Advance 24 hours
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it('allows token refresh after 71 hours of inactivity', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('User 71h', 'user71h@example.com', 'password123');

    // Advance 71 hours (1 hour remaining before 72h deadline)
    vi.advanceTimersByTime(71 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it('rejects token refresh after 72 hours of inactivity (session expired)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('User Expired', 'user-expired@example.com', 'password123');

    // Advance 72 hours and 1 minute
    vi.advanceTimersByTime(72 * 60 * 60 * 1000 + 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.message).toContain('3 days of inactivity');
  });

  it('resets inactivity timer on user activity (/auth/activity)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Active User', 'active-user@example.com', 'password123');

    // Advance 48 hours without refresh
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);

    // User performs meaningful activity, pinging /auth/activity
    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(actRes.status).toBe(200);

    // Check that expiresAt was extended by 72 hours from the activity timestamp
    const tokenRecord = await RefreshToken.findOne({ tokenHash: hashToken(user.refreshToken) });
    expect(tokenRecord!.expiresAt.getTime()).toBe(Date.now() + INACTIVITY_TIMEOUT_MS);

    // Advance another 48 hours (96 hours from initial login, but only 48 hours since activity)
    vi.advanceTimersByTime(48 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
  });

  it('does NOT reset inactivity deadline through token refresh alone', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Refresh Alone', 'refresh-alone@example.com', 'password123');
    const originalExpiresAt = baseNow + INACTIVITY_TIMEOUT_MS;

    // Advance 30 hours
    vi.advanceTimersByTime(30 * 60 * 60 * 1000);

    // Refresh token rotated
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(res1.status).toBe(200);

    const cookie1 = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const token2 = cookie1!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Rotated token must retain the original session inactivity expiration deadline
    const record2 = await RefreshToken.findOne({ tokenHash: hashToken(token2) });
    expect(record2!.expiresAt.getTime()).toBe(originalExpiresAt);

    // Advance another 43 hours (total 73 hours since login without meaningful activity)
    vi.advanceTimersByTime(43 * 60 * 60 * 1000);

    // Attempt refresh after total 73h without activity
    const res2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);

    expect(res2.status).toBe(401);
    expect(res2.body.error.message).toContain('3 days of inactivity');
  });

  it('preserves remaining session lifetime in cookie maxAge on refresh', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Cookie MaxAge User', 'cookie-maxage@example.com', 'password123');
    expect(user.status).toBe(201);

    // Advance 30 hours
    vi.advanceTimersByTime(30 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);

    // Remaining session time: 72h - 30h = 42h = 151,200 seconds
    const rotatedCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(rotatedCookie).toBeDefined();
    expect(rotatedCookie).toContain('Max-Age=151200');
  });

  it('rejects /auth/activity without active session (401 Unauthorized)', async () => {
    // 1. Without cookie and without Bearer header
    const noAuthRes = await request(app).post('/api/v1/auth/activity');
    expect(noAuthRes.status).toBe(401);
    expect(noAuthRes.body.error.message).toContain('Authentication session required');

    // 2. With invalid cookie
    const invalidCookieRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=completely_invalid_session_token`]);
    expect(invalidCookieRes.status).toBe(401);
  });

  it('accepts /auth/activity with valid Bearer access token', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Bearer Activity User', 'bearer-act@example.com', 'password123');
    expect(user.accessToken).toBeDefined();

    // Call /auth/activity using Bearer token without sending refresh cookie
    const bearerRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(bearerRes.status).toBe(200);
    expect(bearerRes.body.success).toBe(true);
    expect(bearerRes.body.data.message).toBe('Activity recorded');
  });

  it('does not extend expired session via activity', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Never Extend User', 'never-extend@example.com', 'password123');
    const originalExpiresAt = baseNow + INACTIVITY_TIMEOUT_MS;

    // Advance 72 hours and 1 minute (session expired)
    vi.advanceTimersByTime(72 * 60 * 60 * 1000 + 60 * 1000);

    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(actRes.status).toBe(401);
    expect(actRes.body.error.message).toContain('3 days of inactivity');

    // Ensure database record was NOT extended
    const tokenRecord = await RefreshToken.findOne({ tokenHash: hashToken(user.refreshToken) });
    expect(tokenRecord!.expiresAt.getTime()).toBe(originalExpiresAt);
  });

  it('handles concurrent /auth/activity and /auth/refresh without race conditions or cookie clobbering', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Concurrent User', 'concurrent@example.com', 'password123');

    // Advance 10 hours
    vi.advanceTimersByTime(10 * 60 * 60 * 1000);

    // Concurrent execution of refresh and activity with the same initial token
    const [refreshRes, activityRes] = await Promise.all([
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]),
      request(app)
        .post('/api/v1/auth/activity')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]),
    ]);

    expect(refreshRes.status).toBe(200);
    expect(activityRes.status).toBe(200);

    // Extract the new rotated refresh token from the refresh response
    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(newCookie).toBeDefined();
    const newToken = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Subsequent refresh using the newly rotated token MUST succeed and NOT trigger reuse detection
    const nextRefreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${newToken}`]);

    expect(nextRefreshRes.status).toBe(200);
    expect(nextRefreshRes.body.success).toBe(true);
  });

  it('handles activity request arriving after token rotation within grace period', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Grace User', 'grace@example.com', 'password123');

    // First rotate the token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(200);

    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const token2 = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 5 seconds (well within the 30s grace period)
    vi.advanceTimersByTime(5000);

    // In-flight activity request presents the old user.refreshToken
    const activityRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(activityRes.status).toBe(200);
    expect(activityRes.body.success).toBe(true);

    // Crucial: Activity must NOT set a cookie for the stale, rotated token
    const activityCookies = activityRes.headers['set-cookie'] || [];
    const clobberedCookie = activityCookies.find((c: string) => c.includes(user.refreshToken));
    expect(clobberedCookie).toBeUndefined();

    // Verify in DB that the replacement token (token2) was extended by activity
    const record2 = await RefreshToken.findOne({ tokenHash: hashToken(token2) });
    expect(record2!.expiresAt.getTime()).toBe(Date.now() + INACTIVITY_TIMEOUT_MS);

    // Refresh with token2 continues to succeed
    const nextRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);
    expect(nextRefresh.status).toBe(200);
  });

  it('invalidates refresh session on explicit logout', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Logout Inactive User', 'logout-inactive@example.com', 'password123');

    // Explicit logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(logoutRes.status).toBe(200);

    // Refresh should now fail with 401
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);

    // Activity should now fail with 401
    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(actRes.status).toBe(401);
  });
});

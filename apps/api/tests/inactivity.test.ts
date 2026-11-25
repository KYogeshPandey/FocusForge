import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';
import {
  REFRESH_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS,
  getRefreshTokenCookieOptions,
  hashToken,
  parseDurationToMs,
} from '../src/utils/tokens.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { Session } from '../src/models/Session.js';
import { env } from '../src/config/env.js';

describe('Persistent Authentication & Session Lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. Login creates a persistent 365-day refresh session with persistent cookie (Proof 1)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Persistent User', 'persistent@example.com', 'password123');
    expect(user.status).toBe(201);

    const tokenRecord = await RefreshToken.findOne({ tokenHash: hashToken(user.refreshToken) });
    expect(tokenRecord).not.toBeNull();
    // Expiration must be 365 days from now
    expect(tokenRecord!.expiresAt.getTime()).toBe(baseNow + REFRESH_TOKEN_TTL_MS);
    expect(tokenRecord!.lastActiveAt.getTime()).toBe(baseNow);

    // Verify cookie has 365-day maxAge (31,536,000 seconds)
    const cookie = user.cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(cookie).toBeDefined();
    expect(cookie).toContain('Max-Age=31536000');
    expect(cookie).toMatch(/(?:^|;\s*)Path=\/(?:;|$)/);
    expect(cookie).toContain('HttpOnly');
  });

  it('2. User remains authenticated after 72 hours of inactivity (Proof 2)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Inactive 72h', 'user72h@example.com', 'password123');

    // Advance 72 hours without any user activity
    vi.advanceTimersByTime(72 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();
  });

  it('3. User remains authenticated after several days (e.g. 10 days of inactivity) (Proof 3)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Inactive 10 Days', 'user10d@example.com', 'password123');

    // Advance 10 days (240 hours) of inactivity
    vi.advanceTimersByTime(10 * 24 * 60 * 60 * 1000);

    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    // Verify the rotated token rolls the 365-day persistent window forward
    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(newCookie).toBeDefined();
    expect(newCookie).toContain('Max-Age=31536000');
  });

  it('4. Access JWT expiration transparently triggers refresh and session continuation (Proof 4)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Access Expiry User', 'expiry-user@example.com', 'password123');

    // Advance 16 minutes (access token TTL is 15 minutes)
    vi.advanceTimersByTime(16 * 60 * 1000);

    // Call /me with expired access token -> fails with 401 TOKEN_EXPIRED
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe('TOKEN_EXPIRED');

    // Transparent refresh using HttpOnly cookie succeeds
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(200);

    const newAccessToken = refreshRes.body.data.accessToken;
    expect(newAccessToken).toBeDefined();

    // Retrying with fresh access token succeeds
    const meRetryRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newAccessToken}`);
    expect(meRetryRes.status).toBe(200);
    expect(meRetryRes.body.data.email).toBe('expiry-user@example.com');
  });

  it('5. Concurrent refresh requests do not randomly log users out (Proof 9)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Concurrent User', 'concurrent-auth@example.com', 'password123');

    // Advance 1 hour
    vi.advanceTimersByTime(60 * 60 * 1000);

    // Fire 2 concurrent refresh requests with the same original token
    const [refreshRes1, refreshRes2] = await Promise.all([
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]),
      request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]),
    ]);

    // Both requests must succeed (one rotates, second is handled within grace window)
    expect(refreshRes1.status).toBe(200);
    expect(refreshRes2.status).toBe(200);
    expect(refreshRes1.body.data.accessToken).toBeDefined();
    expect(refreshRes2.body.data.accessToken).toBeDefined();

    // Exactly one concurrent refresh response emits the replacement refresh cookie
    const cookie1 = refreshRes1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const cookie2 = refreshRes2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect((cookie1 ? 1 : 0) + (cookie2 ? 1 : 0)).toBe(1);

    const emittedCookie = cookie1 || cookie2;
    expect(emittedCookie).toBeDefined();
    const rotatedToken = emittedCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Subsequent refresh with the new token MUST succeed and NOT trigger reuse detection
    const nextRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${rotatedToken}`]);
    expect(nextRefresh.status).toBe(200);
    expect(nextRefresh.body.success).toBe(true);
  });

  it('6. Multiple devices have independent sessions (Proof 10)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    // Register user on Device A
    const deviceA = await createTestUser('Multi Device User', 'multidevice@example.com', 'password123');

    // Login same user on Device B
    const loginResB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'multidevice@example.com', password: 'password123' });
    expect(loginResB.status).toBe(200);

    const cookieB = loginResB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Verify Device A and Device B have distinct refresh tokens
    expect(deviceA.refreshToken).not.toBe(tokenB);

    // Advance 5 hours
    vi.advanceTimersByTime(5 * 60 * 60 * 1000);

    // Device A refreshes its session
    const refreshA = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${deviceA.refreshToken}`]);
    expect(refreshA.status).toBe(200);

    // Device B independently refreshes its session without interference
    const refreshB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    expect(refreshB.status).toBe(200);
  });

  it('7. Explicit logout revokes the session (Proof 6)', async () => {
    const user = await createTestUser('Logout User', 'logout-test@example.com', 'password123');

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(logoutRes.status).toBe(200);

    // Cookie is cleared
    const clearCookie = logoutRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(clearCookie).toContain(`${REFRESH_COOKIE_NAME}=;`);

    // Subsequent refresh fails with 401
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('8. Password change revokes existing sessions (Proof 7)', async () => {
    const user = await createTestUser('Pwd User', 'pwd-change@example.com', 'password123');

    // Change password
    const changeRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        currentPassword: 'password123',
        newPassword: 'newSecretPassword123',
      });
    expect(changeRes.status).toBe(200);

    // Presenting old refresh token to /refresh must be rejected
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('9. Account deletion revokes all sessions (Proof 8)', async () => {
    const user = await createTestUser('Del User', 'del-acct@example.com', 'password123');

    // Delete account
    const delRes = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: 'password123' });
    expect(delRes.status).toBe(204);

    // All refresh tokens for this user must be purged
    const tokensInDb = await RefreshToken.find({ userId: user.user.id });
    expect(tokensInDb).toHaveLength(0);

    // Refresh request fails
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('10. Production cookie options enforce SameSite=None, Secure, and HttpOnly (Proof 12)', () => {
    const originalEnv = env.NODE_ENV;
    try {
      (env as Record<string, unknown>).NODE_ENV = 'production';
      const prodOptions = getRefreshTokenCookieOptions();

      expect(prodOptions.httpOnly).toBe(true);
      expect(prodOptions.secure).toBe(true);
      expect(prodOptions.sameSite).toBe('none');
      expect(prodOptions.path).toBe('/');
      expect(prodOptions.maxAge).toBe(REFRESH_TOKEN_TTL_MS);
    } finally {
      (env as Record<string, unknown>).NODE_ENV = originalEnv;
    }
  });

  it('11. Activity request arriving after token rotation within grace period does not clobber cookie', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Grace User', 'grace-user@example.com', 'password123');

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

    // Activity must NOT write any refresh cookie at all
    const activityCookies = activityRes.headers['set-cookie'] || [];
    const hasRefreshCookie = activityCookies.some((c: string) => c.startsWith(`${REFRESH_COOKIE_NAME}=`));
    expect(hasRefreshCookie).toBe(false);

    // Verify in DB that the replacement token (token2) was extended by activity
    const record2 = await RefreshToken.findOne({ tokenHash: hashToken(token2) });
    expect(record2!.expiresAt.getTime()).toBe(Date.now() + REFRESH_TOKEN_TTL_MS);

    // Refresh with token2 continues to succeed
    const nextRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);
    expect(nextRefresh.status).toBe(200);
  });

  it('12. 365-day persistence and rolling renewal: active refresh at 100 days extends session by another 365 days', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Yearly User', 'yearly-user@example.com', 'password123');

    // Advance 100 days of inactivity
    const hundredDaysMs = 100 * 24 * 60 * 60 * 1000;
    vi.advanceTimersByTime(hundredDaysMs);

    // Refresh succeeds after 100 days
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.success).toBe(true);

    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(newCookie).toBeDefined();
    expect(newCookie).toContain('Max-Age=31536000');

    const rotatedToken = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];
    const record = await RefreshToken.findOne({ tokenHash: hashToken(rotatedToken) });
    expect(record).not.toBeNull();
    // Expiration must be rolled forward 365 days from the refresh timestamp (Day 100 + 365 days)
    expect(record!.expiresAt.getTime()).toBe(baseNow + hundredDaysMs + REFRESH_TOKEN_TTL_MS);
  });

  it('13. Activity without refresh cookie is rejected, even with valid Bearer access token', async () => {
    const user = await createTestUser('Bearer Activity User', 'bearer-activity@example.com', 'password123');

    // Attempting /activity with only a valid Bearer token and NO cookie
    const res = await request(app)
      .post('/api/v1/auth/activity')
      .set('Authorization', `Bearer ${user.accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('14. Activity with revoked refresh token is rejected', async () => {
    const user = await createTestUser('Revoked Activity User', 'revoked-activity@example.com', 'password123');

    // Revoke the token directly in database
    await RefreshToken.updateOne(
      { tokenHash: hashToken(user.refreshToken) },
      { revokedAt: new Date(Date.now() - 60000) }
    );

    const res = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('15. Activity cannot extend another device\'s session', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const deviceA = await createTestUser('Device Isolation', 'isolation@example.com', 'password123');
    const initialExpiryA = baseNow + 365 * 24 * 60 * 60 * 1000;

    // Login same user on Device B
    const loginResB = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'isolation@example.com', password: 'password123' });
    expect(loginResB.status).toBe(200);

    const cookieB = loginResB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];
    const initialExpiryB = baseNow + 365 * 24 * 60 * 60 * 1000;

    // Advance 2 hours
    const twoHoursMs = 2 * 60 * 60 * 1000;
    vi.advanceTimersByTime(twoHoursMs);

    // Activity arrives with ONLY Device A's cookie
    const activityA = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${deviceA.refreshToken}`]);
    expect(activityA.status).toBe(200);

    // Device A's session in DB was extended
    const recordA = await RefreshToken.findOne({ tokenHash: hashToken(deviceA.refreshToken) });
    expect(recordA!.expiresAt.getTime()).toBe(baseNow + twoHoursMs + 365 * 24 * 60 * 60 * 1000);

    // Device B's session in DB was NOT extended
    const recordB = await RefreshToken.findOne({ tokenHash: hashToken(tokenB) });
    expect(recordB!.expiresAt.getTime()).toBe(initialExpiryB);
  });

  it('16. Logout during grace prevents further session activity', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Grace Logout User', 'grace-logout@example.com', 'password123');

    // Rotate token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(200);

    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const token2 = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 5 seconds (within 30s grace)
    vi.advanceTimersByTime(5000);

    // User logs out presenting token2
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);
    expect(logoutRes.status).toBe(200);

    // Advance 5 more seconds (still within 30s of original rotation)
    vi.advanceTimersByTime(5000);

    // In-flight activity presenting the old token MUST be rejected
    const activityOldRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(activityOldRes.status).toBe(401);

    // Activity presenting token2 MUST also be rejected
    const activityNewRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);
    expect(activityNewRes.status).toBe(401);
  });

  it('17. Reuse outside grace revokes the appropriate token family', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Family Revoke User', 'family-revoke@example.com', 'password123');

    // Rotate token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(200);

    const newCookie = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const token2 = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Mark token2 as used so subsequent presentation of user.refreshToken is genuine reuse
    await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);

    // Advance 31 seconds (past the 30-second grace window)
    vi.advanceTimersByTime(31000);

    // Stale token re-presented to /refresh outside grace window
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.message).toContain('reuse detected');

    // Verify token family is revoked in DB
    const allTokens = await RefreshToken.find({ userId: user.user.id });
    for (const t of allTokens) {
      expect(t.revokedAt).not.toBeNull();
    }

    // Refresh with token2 must now also be rejected
    const token2Res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${token2}`]);
    expect(token2Res.status).toBe(401);
  });

  it('18. Configured REFRESH_TOKEN_TTL controls both DB expiry and cookie Max-Age', async () => {
    const originalTtl = process.env.REFRESH_TOKEN_TTL;
    try {
      process.env.REFRESH_TOKEN_TTL = '14d'; // 14 days = 1,209,600 seconds = 1,209,600,000 ms
      const baseNow = 1700000000000;
      vi.setSystemTime(baseNow);

      const user = await createTestUser('Custom TTL User', 'custom-ttl@example.com', 'password123');
      expect(user.status).toBe(201);

      const tokenRecord = await RefreshToken.findOne({ tokenHash: hashToken(user.refreshToken) });
      expect(tokenRecord).not.toBeNull();
      // DB expiresAt must equal baseNow + 14 days
      expect(tokenRecord!.expiresAt.getTime()).toBe(baseNow + 14 * 24 * 60 * 60 * 1000);

      // Cookie Max-Age must be 14 days (1,209,600 seconds)
      const cookie = user.cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
      expect(cookie).toBeDefined();
      expect(cookie).toContain('Max-Age=1209600');
    } finally {
      if (originalTtl === undefined) {
        delete process.env.REFRESH_TOKEN_TTL;
      } else {
        process.env.REFRESH_TOKEN_TTL = originalTtl;
      }
    }
  });

  it('19. parseDurationToMs parses various units, validates boundary values, and safely falls back on zero, negative, or excessively large inputs', () => {
    const defaultMs = 365 * 24 * 60 * 60 * 1000;
    // Valid units
    expect(parseDurationToMs('365d')).toBe(365 * 24 * 60 * 60 * 1000);
    expect(parseDurationToMs('7d')).toBe(7 * 24 * 60 * 60 * 1000);
    expect(parseDurationToMs('24h')).toBe(24 * 60 * 60 * 1000);
    expect(parseDurationToMs('60m')).toBe(60 * 60 * 1000);
    expect(parseDurationToMs('30s')).toBe(30 * 1000);
    expect(parseDurationToMs('500ms')).toBe(500);
    expect(parseDurationToMs('1ms')).toBe(1);
    expect(parseDurationToMs('10y')).toBe(10 * 365 * 24 * 60 * 60 * 1000);
    expect(parseDurationToMs('10000')).toBe(10000);

    // Zero inputs must safely fall back to defaultMs
    expect(parseDurationToMs('0')).toBe(defaultMs);
    expect(parseDurationToMs('0d')).toBe(defaultMs);
    expect(parseDurationToMs('0s')).toBe(defaultMs);
    expect(parseDurationToMs('0h')).toBe(defaultMs);

    // Negative inputs must safely fall back to defaultMs
    expect(parseDurationToMs('-5d')).toBe(defaultMs);
    expect(parseDurationToMs('-100')).toBe(defaultMs);

    // Malformed and invalid inputs
    expect(parseDurationToMs('invalid', 12345)).toBe(12345);
    expect(parseDurationToMs('abc')).toBe(defaultMs);
    expect(parseDurationToMs('12xyz')).toBe(defaultMs);
    expect(parseDurationToMs('', 5000)).toBe(5000);
    // Scientific notation like '1e3' must be rejected as malformed
    expect(parseDurationToMs('1e3')).toBe(defaultMs);
    expect(parseDurationToMs('1e6')).toBe(defaultMs);
    expect(parseDurationToMs('1.5d')).toBe(defaultMs);

    // Excessively large inputs (> 10 years or Infinity) must safely fall back to defaultMs
    expect(parseDurationToMs('11y')).toBe(defaultMs);
    expect(parseDurationToMs('100y')).toBe(defaultMs);
    expect(parseDurationToMs('99999999999999999999999999999999999999999999999999y')).toBe(defaultMs);
  });

  it('20. Missing refresh token is rejected on both /refresh and /activity', async () => {
    // Calling /refresh without cookie
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh');
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.success).toBe(false);

    // Calling /activity without cookie
    const activityRes = await request(app)
      .post('/api/v1/auth/activity');
    expect(activityRes.status).toBe(401);
    expect(activityRes.body.success).toBe(false);
  });

  it('21. Expired refresh token is rejected on both /refresh and /activity', async () => {
    const user = await createTestUser('Expired User', 'expired-token-user@example.com', 'password123');

    // Expire the token in DB
    await RefreshToken.updateOne(
      { tokenHash: hashToken(user.refreshToken) },
      { expiresAt: new Date(Date.now() - 5000) }
    );

    // Calling /refresh with expired token
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.message).toContain('expired');

    // Calling /activity with expired token
    const activityRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(activityRes.status).toBe(401);
    expect(activityRes.body.error.message).toContain('expired');
  });

  it('22. A -> B -> C within 30 seconds: delayed A request succeeds without family revocation if C is active', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Chain User', 'chain-user@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Advance 5 seconds: A -> B
    vi.advanceTimersByTime(5000);
    const refreshRes1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(refreshRes1.status).toBe(200);
    const cookieB = refreshRes1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 5 seconds: B -> C
    vi.advanceTimersByTime(5000);
    const refreshRes2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    expect(refreshRes2.status).toBe(200);
    const cookieC = refreshRes2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 5 seconds: total 15 seconds since A was rotated (well within A's 30s grace)
    vi.advanceTimersByTime(5000);

    // Delayed request presents A
    const delayedResA = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    // Must succeed without family revocation!
    expect(delayedResA.status).toBe(200);
    expect(delayedResA.body.success).toBe(true);
    expect(delayedResA.body.data.accessToken).toBeDefined();

    // Verify token C is still unrevoked in DB
    const recordC = await RefreshToken.findOne({ tokenHash: hashToken(tokenC) });
    expect(recordC).not.toBeNull();
    expect(recordC!.revokedAt).toBeNull();

    // Subsequent refresh with C succeeds
    const refreshC = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(refreshC.status).toBe(200);
  });

  it('23. Delayed A activity request succeeds only when C is active and extends C', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Activity Chain User', 'activity-chain@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Advance 4s: A -> B
    vi.advanceTimersByTime(4000);
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 4s: B -> C
    vi.advanceTimersByTime(4000);
    const res2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    const cookieC = res2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 4s (total 12s since A's rotation, inside 30s grace)
    vi.advanceTimersByTime(4000);

    // Delayed activity presenting A arrives
    const activityRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(activityRes.status).toBe(200);

    // Does NOT emit any refresh Set-Cookie header
    const setCookies = activityRes.headers['set-cookie'] || [];
    expect(setCookies.some((c: string) => c.startsWith(`${REFRESH_COOKIE_NAME}=`))).toBe(false);

    // Terminal token C in DB was extended
    const recordC = await RefreshToken.findOne({ tokenHash: hashToken(tokenC) });
    expect(recordC!.lastActiveAt.getTime()).toBe(baseNow + 12000);
  });

  it('24. A -> B -> C followed by logout of C: delayed A refresh is rejected', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Logout Chain User', 'logout-chain@example.com', 'password123');
    const tokenA = user.refreshToken;

    // A -> B -> C
    vi.advanceTimersByTime(3000);
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    vi.advanceTimersByTime(3000);
    const res2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    const cookieC = res2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Logout presenting C
    vi.advanceTimersByTime(2000);
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(logoutRes.status).toBe(200);

    // Advance 2s (still within 10s of A's rotation)
    vi.advanceTimersByTime(2000);

    // Delayed refresh presenting A MUST be rejected
    const delayedA = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(delayedA.status).toBe(401);
    expect(delayedA.body.error.message).toContain('revoked');
  });

  it('25. A -> B -> C followed by logout of C: delayed A activity is rejected', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Logout Act Chain User', 'logout-act-chain@example.com', 'password123');
    const tokenA = user.refreshToken;

    // A -> B -> C
    vi.advanceTimersByTime(3000);
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    vi.advanceTimersByTime(3000);
    const res2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    const cookieC = res2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Logout presenting C
    vi.advanceTimersByTime(2000);
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);

    vi.advanceTimersByTime(2000);

    // Delayed activity presenting A MUST be rejected
    const delayedActA = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(delayedActA.status).toBe(401);
    expect(delayedActA.body.error.message).toContain('revoked');
  });

  it('26. Missing intermediate token is rejected safely', async () => {
    const user = await createTestUser('Missing Record User', 'missing-rec@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Rotate A -> B
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(res1.status).toBe(200);

    // Point A to a non-existent token hash
    await RefreshToken.updateOne(
      { tokenHash: hashToken(tokenA) },
      { replacedBy: hashToken('completely_non_existent_token_12345') }
    );

    // Refresh with A fails safely
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(refreshRes.status).toBe(401);

    // Activity with A fails safely
    const activityRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(activityRes.status).toBe(401);
  });

  it('27. Cross-user replacement pointer is rejected', async () => {
    const user1 = await createTestUser('User One', 'user-one@example.com', 'password123');
    const user2 = await createTestUser('User Two', 'user-two@example.com', 'password123');

    // Rotate User 1 token
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user1.refreshToken}`]);
    expect(res1.status).toBe(200);

    // Corrupt User 1's replacedBy pointer to point to User 2's token
    await RefreshToken.updateOne(
      { tokenHash: hashToken(user1.refreshToken) },
      { replacedBy: hashToken(user2.refreshToken) }
    );

    // Refresh with User 1 token MUST be rejected
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user1.refreshToken}`]);
    expect(refreshRes.status).toBe(401);

    // Activity with User 1 token MUST be rejected
    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user1.refreshToken}`]);
    expect(actRes.status).toBe(401);

    // User 2's session must be completely untouched and valid
    const user2Refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user2.refreshToken}`]);
    expect(user2Refresh.status).toBe(200);
  });

  it('28. Cyclic replacement pointers are rejected', async () => {
    const user = await createTestUser('Cyclic User', 'cyclic-user@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Rotate A -> B
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Create a cycle: Token B points back to Token A
    await RefreshToken.updateOne(
      { tokenHash: hashToken(tokenB) },
      { replacedBy: hashToken(tokenA), revokedAt: new Date() }
    );

    // Refresh with Token A detects cycle and rejects safely without hanging
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(refreshRes.status).toBe(401);

    // Activity with Token A detects cycle and rejects safely
    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(actRes.status).toBe(401);
  });

  it('29. Requests outside A\'s original grace period trigger the existing reuse-detection policy', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Reuse Grace User', 'reuse-grace@example.com', 'password123');
    const tokenA = user.refreshToken;

    // A -> B at T=0
    const res1 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = res1.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // B -> C at T=5
    vi.advanceTimersByTime(5000);
    const res2 = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    const cookieC = res2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Advance 31 seconds after A was rotated (T=31s, past A's 30-second grace deadline)
    vi.advanceTimersByTime(26000);

    // Present stale Token A
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.message).toContain('reuse detected');

    // Entire user family revoked
    const allTokens = await RefreshToken.find({ userId: user.user.id });
    for (const t of allTokens) {
      expect(t.revokedAt).not.toBeNull();
    }

    // Refresh with C now fails
    const resC = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(resC.status).toBe(401);
  });

  it('30. Independent device sessions remain unaffected when another device logs out or rotates multi-generation chains', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    // Device 1
    const device1 = await createTestUser('Multi Device User 2', 'multidev2@example.com', 'password123');
    const tokenA = device1.refreshToken;

    // Device 2
    const loginRes2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'multidev2@example.com', password: 'password123' });
    const cookieDev2 = loginRes2.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenDev2 = cookieDev2!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Device 1 rotates A -> B -> C
    vi.advanceTimersByTime(2000);
    const resB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = resB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    vi.advanceTimersByTime(2000);
    const resC = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    const cookieC = resC.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Device 1 logs out (sending C)
    vi.advanceTimersByTime(2000);
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(logoutRes.status).toBe(200);

    // Device 2 must remain completely active and valid!
    const dev2Refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenDev2}`]);
    expect(dev2Refresh.status).toBe(200);
    expect(dev2Refresh.body.data.accessToken).toBeDefined();

    // Device 2 activity also succeeds
    const dev2Act = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenDev2}`]);
    expect(dev2Act.status).toBe(200);
  });

  it('31. Refresh and logout racing on the same session: refresh fails to claim successor once logout commits', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Race Logout User', 'racelogout@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Rotate A -> B
    const resB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(resB.status).toBe(200);
    const cookieB = resB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Explicit logout commits (sending token B)
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    expect(logoutRes.status).toBe(200);

    // Verify session record is revoked
    const tokenBRecord = await RefreshToken.findOne({ tokenHash: hashToken(tokenB) });
    expect(tokenBRecord?.sessionId).toBeDefined();
    const session = await Session.findById(tokenBRecord!.sessionId);
    expect(session?.revokedAt).not.toBeNull();

    // A racing or delayed refresh presenting token B must fail with 401 Session has been revoked
    const racingRefreshB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    expect(racingRefreshB.status).toBe(401);
    expect(racingRefreshB.body.error.message).toContain('Session has been revoked');

    // A racing refresh presenting token A (within grace) must also fail because session is revoked
    const racingRefreshA = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(racingRefreshA.status).toBe(401);
    expect(racingRefreshA.body.error.message).toContain('Session has been revoked');
  });

  it('32. Logout invalidates the entire session record and all predecessor and successor tokens in O(1) without bounded chain scan', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Atomic Revocation User', 'atomicrev@example.com', 'password123');
    let currentToken = user.refreshToken;
    const tokens = [currentToken];

    // Form a 5-token chain: A -> B -> C -> D -> E
    for (let i = 0; i < 4; i++) {
      vi.advanceTimersByTime(1000);
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${currentToken}`]);
      expect(res.status).toBe(200);
      const cookie = res.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
      currentToken = cookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];
      tokens.push(currentToken);
    }

    expect(tokens.length).toBe(5);

    // Logout using the terminal token E
    const terminalToken = tokens[4];
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${terminalToken}`]);
    expect(logoutRes.status).toBe(200);

    // Verify Session is atomically revoked
    const terminalRecord = await RefreshToken.findOne({ tokenHash: hashToken(terminalToken) });
    const session = await Session.findById(terminalRecord!.sessionId);
    expect(session?.revokedAt).not.toBeNull();

    // Verify ALL tokens in the session are revoked in the database
    const allSessionTokens = await RefreshToken.find({ sessionId: terminalRecord!.sessionId });
    expect(allSessionTokens.length).toBe(5);
    for (const t of allSessionTokens) {
      expect(t.revokedAt).not.toBeNull();
    }

    // Every token in the chain presented to /refresh or /activity must be rejected
    for (const t of tokens) {
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${t}`]);
      expect(res.status).toBe(401);
    }
  });

  it('33. Lost Set-Cookie response recovery: client presents A when successor B has firstUsedAt === null; recovers with fresh cookie C without fresh login', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Lost Cookie User', 'lostcookie@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Refresh A -> B commits on server, but browser never receives B's Set-Cookie (simulated)
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(refreshRes.status).toBe(200);
    const cookieB = refreshRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Verify B was created with firstUsedAt === null
    const recordB = await RefreshToken.findOne({ tokenHash: hashToken(tokenB) });
    expect(recordB).not.toBeNull();
    expect(recordB!.firstUsedAt).toBeNull();

    // Advance 35 seconds (past the 30-second concurrency grace window)
    vi.advanceTimersByTime(35000);

    // Client, having never received B, retries refresh with token A
    const recoveryRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    // Must NOT trigger reuse detection! Must recover with fresh token C
    expect(recoveryRes.status).toBe(200);
    expect(recoveryRes.body.data.accessToken).toBeDefined();

    const cookieC = recoveryRes.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(cookieC).toBeDefined();
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];
    expect(tokenC).not.toBe(tokenA);
    expect(tokenC).not.toBe(tokenB);

    // Verify B was revoked during recovery
    const updatedRecordB = await RefreshToken.findOne({ tokenHash: hashToken(tokenB) });
    expect(updatedRecordB!.revokedAt).not.toBeNull();

    // The client can now use token C successfully
    const useCRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(useCRes.status).toBe(200);

    // Record C now has firstUsedAt set
    const recordC = await RefreshToken.findOne({ tokenHash: hashToken(tokenC) });
    expect(recordC!.firstUsedAt).not.toBeNull();
  });

  it('34. Lost Set-Cookie recovery: once replacement token C is used, re-presenting A or B triggers reuse detection', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Lost Cookie Reuse User', 'lostcookiereuse@example.com', 'password123');
    const tokenA = user.refreshToken;

    // A -> B
    const resB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = resB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Lost response recovery: 45s later, present A
    vi.advanceTimersByTime(45000);
    const resC = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(resC.status).toBe(200);
    const cookieC = resC.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenC = cookieC!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // Client uses token C for activity (marking it used)
    const actRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenC}`]);
    expect(actRes.status).toBe(200);

    // Now an attacker presents token A again -> Must trigger reuse detection!
    vi.advanceTimersByTime(1000);
    const reuseA = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    expect(reuseA.status).toBe(401);
    expect(reuseA.body.error.message).toContain('reuse detected');

    // Or presenting lost token B -> Must also be rejected
    const reuseB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);
    expect(reuseB.status).toBe(401);
  });

  it('35. Lost Set-Cookie recovery after logout is strictly rejected', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Lost Cookie Logout User', 'lostlogout@example.com', 'password123');
    const tokenA = user.refreshToken;

    // A -> B
    const resB = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);
    const cookieB = resB.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    const tokenB = cookieB!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];

    // User logs out (explicit logout)
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenB}`]);

    // 40 seconds later, client presenting token A attempts recovery
    vi.advanceTimersByTime(40000);
    const recoveryRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    expect(recoveryRes.status).toBe(401);
    expect(recoveryRes.body.error.message).toContain('Session has been revoked');
  });

  it('36. Long rotation chains: supports chains exceeding 25 successors up to MAX_CHAIN_DEPTH (100)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Long Chain User', 'longchain@example.com', 'password123');
    const tokenA = user.refreshToken;
    let currentToken = tokenA;

    // Build a chain of 35 rotations within a 7-second window (so token A is still within 30-sec grace)
    for (let i = 0; i < 35; i++) {
      vi.advanceTimersByTime(200);
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [`${REFRESH_COOKIE_NAME}=${currentToken}`]);
      expect(res.status).toBe(200);
      const cookie = res.headers['set-cookie']?.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
      currentToken = cookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`))![1];
    }

    // Total elapsed time = 35 * 200ms = 7000ms (7s < 30s grace)
    // Present original Token A
    const resGrace = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    expect(resGrace.status).toBe(200);
    expect(resGrace.body.data.accessToken).toBeDefined();
  });

  it('37. Future timestamp in revokedAt is rejected with 401 Invalid session timestamp', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Future Timestamp User', 'futurets@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Artificially corrupt the database record with a future revokedAt timestamp (+60s)
    await RefreshToken.updateOne(
      { tokenHash: hashToken(tokenA) },
      { $set: { revokedAt: new Date(baseNow + 60000), replacedBy: 'somehash' } }
    );

    // Present token to /refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    expect(refreshRes.status).toBe(401);
    expect(refreshRes.body.error.message).toContain('Invalid session timestamp');
  });

  it('38. Activity endpoint extends DB session without emitting Set-Cookie (prevents overwriting concurrent rotation)', async () => {
    const baseNow = 1700000000000;
    vi.setSystemTime(baseNow);

    const user = await createTestUser('Activity NoCookie User', 'activity-nocookie@example.com', 'password123');
    const tokenA = user.refreshToken;

    // Advance 1 hour and call /activity with active token A
    vi.advanceTimersByTime(60 * 60 * 1000);

    const activityRes = await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${tokenA}`]);

    expect(activityRes.status).toBe(200);
    expect(activityRes.body.success).toBe(true);

    // Must NOT emit Set-Cookie for REFRESH_COOKIE_NAME even when token is active (unrotated)
    const setCookies = activityRes.headers['set-cookie'] || [];
    expect(setCookies.some((c: string) => c.startsWith(`${REFRESH_COOKIE_NAME}=`))).toBe(false);

    // DB token and session expiries were still rolled forward by 1 hour
    const updatedRecord = await RefreshToken.findOne({ tokenHash: hashToken(tokenA) });
    expect(updatedRecord).not.toBeNull();
    expect(updatedRecord!.lastActiveAt.getTime()).toBe(baseNow + 60 * 60 * 1000);
    expect(updatedRecord!.expiresAt.getTime()).toBe(baseNow + 60 * 60 * 1000 + REFRESH_TOKEN_TTL_MS);

    const updatedSession = await Session.findById(updatedRecord!.sessionId);
    expect(updatedSession).not.toBeNull();
    expect(updatedSession!.expiresAt.getTime()).toBe(baseNow + 60 * 60 * 1000 + REFRESH_TOKEN_TTL_MS);
  });
});

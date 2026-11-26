import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';
import { REFRESH_COOKIE_NAME, hashToken } from '../src/utils/tokens.js';
import { User } from '../src/models/User.js';
import { Task } from '../src/models/Task.js';
import { RefreshToken } from '../src/models/RefreshToken.js';

describe('Authentication & Session Lifecycle', () => {
  it('registers a new user and returns access token + sets httpOnly refresh cookie', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Developer',
      email: 'alice@example.com',
      password: 'password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.name).toBe('Alice Developer');
    expect(res.body.data.user.email).toBe('alice@example.com');
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toContain('HttpOnly');
  });

  it('rejects registration with duplicate email (409 Conflict)', async () => {
    await createTestUser('Alice', 'alice@duplicate.com', 'password123');

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Alice Second',
      email: 'alice@duplicate.com',
      password: 'differentPassword',
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects registration with invalid input (422 Validation Error)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: '',
      email: 'not-an-email',
      password: 'short',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });

  it('logs in successfully with valid credentials and sets rotating refresh cookie', async () => {
    await createTestUser('Bob', 'bob@example.com', 'securePass123');

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'bob@example.com',
      password: 'securePass123',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('bob@example.com');
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'] || [];
    const refreshCookie = cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(refreshCookie).toBeDefined();
  });

  it('returns generic 401 on login failure (invalid email or wrong password)', async () => {
    await createTestUser('Bob', 'bob2@example.com', 'correctPassword');

    // Wrong password
    const res1 = await request(app).post('/api/v1/auth/login').send({
      email: 'bob2@example.com',
      password: 'wrongPassword',
    });
    expect(res1.status).toBe(401);
    expect(res1.body.error.message).toBe('Invalid email or password');

    // Non-existent email
    const res2 = await request(app).post('/api/v1/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'somePassword',
    });
    expect(res2.status).toBe(401);
    expect(res2.body.error.message).toBe('Invalid email or password');
  });

  it('protects routes from unauthenticated access (401)', async () => {
    const res1 = await request(app).get('/api/v1/auth/me');
    expect(res1.status).toBe(401);

    const res2 = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token-string');
    expect(res2.status).toBe(401);
  });

  it('rotates refresh token on /auth/refresh and detects reuse', async () => {
    const userA = await createTestUser('Carol', 'carol@refresh.com', 'password123');
    const originalToken = userA.refreshToken;
    expect(originalToken).toBeTruthy();

    // 1. First valid refresh
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${originalToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.data.accessToken).toBeDefined();

    // Extract rotated token from set-cookie
    const cookies = refreshRes.headers['set-cookie'] || [];
    const newCookie = cookies.find((c: string) => c.includes(REFRESH_COOKIE_NAME));
    expect(newCookie).toBeDefined();
    const newMatch = newCookie!.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
    const rotatedToken = newMatch![1];
    expect(rotatedToken).not.toBe(originalToken);

    // Mark rotated token as used so subsequent presentation of originalToken is genuine reuse
    await request(app)
      .post('/api/v1/auth/activity')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${rotatedToken}`]);

    // 2. Reuse detection: presenting the already-revoked original token outside the grace period
    // Simulate time elapsed past the 30-second concurrent rotation grace period
    await RefreshToken.updateOne(
      { tokenHash: hashToken(originalToken) },
      { revokedAt: new Date(Date.now() - 35 * 1000) }
    );

    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${originalToken}`]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.message).toContain('reuse detected');

    // 3. Verify that all tokens for this user family were revoked
    const familyTokens = await RefreshToken.find({ userId: userA.user.id });
    for (const t of familyTokens) {
      expect(t.revokedAt).not.toBeNull();
    }
  });

  it('logs out and revokes the active refresh token', async () => {
    const user = await createTestUser('Dave', 'dave@logout.com', 'password123');

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);

    expect(res.status).toBe(200);

    // Cookie is cleared
    const cookie = res.headers['set-cookie']?.[0];
    expect(cookie).toContain(`${REFRESH_COOKIE_NAME}=;`);

    // Cannot refresh anymore
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`${REFRESH_COOKIE_NAME}=${user.refreshToken}`]);
    expect(refreshRes.status).toBe(401);
  });

  it('changes password requiring verification of current password', async () => {
    const user = await createTestUser('Eve', 'eve@password.com', 'oldPassword123');

    // Wrong current password
    const failRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        currentPassword: 'incorrectPassword',
        newPassword: 'brandNewPassword123',
      });
    expect(failRes.status).toBe(400);

    // Correct current password
    const okRes = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        currentPassword: 'oldPassword123',
        newPassword: 'brandNewPassword123',
      });
    expect(okRes.status).toBe(200);

    // Can log in with new password
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'eve@password.com',
      password: 'brandNewPassword123',
    });
    expect(loginRes.status).toBe(200);
  });

  it('deletes account and cascades all user documents', async () => {
    const user = await createTestUser('Frank', 'frank@delete.com', 'password123');

    // Add a task for this user
    await Task.create({
      userId: user.user.id,
      title: 'Frank task',
      subject: 'Math',
      priority: 'high',
      status: 'todo',
    });

    // Delete account with valid password confirmation
    const deleteRes = await request(app)
      .delete('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: 'password123' });

    expect(deleteRes.status).toBe(204);

    // Verify user and owned task are removed from DB
    const userInDb = await User.findById(user.user.id);
    expect(userInDb).toBeNull();

    const tasksInDb = await Task.find({ userId: user.user.id });
    expect(tasksInDb).toHaveLength(0);
  });

  it('normalizes legacy longBreakInterval: 4 to 5 and prevents changing fixed interval via PATCH /me', async () => {
    const created = await createTestUser('Interval User', 'interval@test.com', 'password123');

    // Simulate legacy user document in MongoDB with old longBreakInterval: 4
    await User.updateOne(
      { _id: created.user.id },
      { $set: { 'preferences.longBreakInterval': 4 } }
    );

    // GET /me safely normalizes to 5 without breaking user settings or auth
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${created.accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.preferences.longBreakInterval).toBe(5);

    // PATCH /me attempting to change longBreakInterval (including legacy values 4 or 0) keeps interval fixed at 5
    const patchRes = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${created.accessToken}`)
      .send({
        preferences: {
          focusDuration: 45,
          shortBreakDuration: 10,
          longBreakInterval: 2,
        },
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.preferences.focusDuration).toBe(45);
    expect(patchRes.body.data.preferences.shortBreakDuration).toBe(10);
    expect(patchRes.body.data.preferences.longBreakInterval).toBe(5);

    const legacyPatchRes = await request(app)
      .patch('/api/v1/auth/me')
      .set('Authorization', `Bearer ${created.accessToken}`)
      .send({
        preferences: {
          longBreakInterval: 0,
        },
      });
    expect(legacyPatchRes.status).toBe(200);
    expect(legacyPatchRes.body.data.preferences.longBreakInterval).toBe(5);

    const updatedInDb = await User.findById(created.user.id);
    expect(updatedInDb!.preferences.longBreakInterval).toBe(5);

    // Login also returns normalized interval 5
    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'interval@test.com',
      password: 'password123',
    });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.preferences.longBreakInterval).toBe(5);
  });
});

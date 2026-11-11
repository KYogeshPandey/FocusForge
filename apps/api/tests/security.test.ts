import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { createTestUser } from './helpers.js';

describe('Security & Input Hardening', () => {
  it('never exposes passwordHash or tokenHash in API responses', async () => {
    const user = await createTestUser('SecUser', 'sec@security.com', 'password123');

    // Register / Me responses
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${user.accessToken}`);

    const resBodyStr = JSON.stringify(meRes.body);
    expect(resBodyStr).not.toContain('passwordHash');
    expect(resBodyStr).not.toContain('tokenHash');
    expect(meRes.body.data.passwordHash).toBeUndefined();
  });

  it('rejects unknown fields in request bodies (.strict() Zod validation to prevent mass assignment)', async () => {
    const user = await createTestUser('StrictUser', 'strict@security.com', 'password123');

    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({
        title: 'Legit Task',
        subject: 'Math',
        maliciousAdminField: true, // Unknown field
        role: 'superadmin', // Mass assignment attempt
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('ignores or rejects client-supplied userId in body and derives ownership solely from token', async () => {
    const userA = await createTestUser('User A', 'usera.sec@test.com', 'password123');
    const attacker = await createTestUser('Attacker', 'attacker@test.com', 'password123');

    // Attacker attempts to forge userId = userA.user.id in task creation
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Authorization', `Bearer ${attacker.accessToken}`)
      .send({
        title: 'Spoofed Task',
        subject: 'Hacking',
        userId: userA.user.id, // Forged userId
      });

    expect(res.status).toBe(201);
    // Verified: The created task must be owned by Attacker, not User A!
    expect(res.body.data.userId).toBe(attacker.user.id);
    expect(res.body.data.userId).not.toBe(userA.user.id);
  });

  it('triggers rate limiter and returns 429 on excessive auth requests', async () => {
    // Auth limiter is set to 20 requests; send 22 requests with test flag
    const attempts = [];
    for (let i = 0; i < 22; i++) {
      attempts.push(
        request(app)
          .post('/api/v1/auth/login')
          .set('x-test-rate-limit', 'true')
          .send({
            email: 'ratelimit@example.com',
            password: 'somePassword',
          })
      );
    }

    const responses = await Promise.all(attempts);
    const has429 = responses.some((r) => r.status === 429);
    expect(has429).toBe(true);

    const rateLimitedResponse = responses.find((r) => r.status === 429);
    expect(rateLimitedResponse?.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

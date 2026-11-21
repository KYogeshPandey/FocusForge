import { describe, it, expect, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { env } from '../src/config/env.js';

describe('CORS Configuration & Origin Validation', () => {
  const originalOrigin = env.CLIENT_ORIGIN;

  afterEach(() => {
    env.CLIENT_ORIGIN = originalOrigin;
  });

  it('allows single configured origin and sends credentials header', async () => {
    env.CLIENT_ORIGIN = 'https://focusforge--ai.vercel.app';
    const testApp = createApp();

    const res = await request(testApp)
      .get('/health')
      .set('Origin', 'https://focusforge--ai.vercel.app');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('https://focusforge--ai.vercel.app');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('supports multiple comma-separated allowed origins', async () => {
    env.CLIENT_ORIGIN = 'https://focusforge--ai.vercel.app, https://focusforge-six-ebon.vercel.app';
    const testApp = createApp();

    // First canonical origin
    const res1 = await request(testApp)
      .get('/health')
      .set('Origin', 'https://focusforge--ai.vercel.app');

    expect(res1.status).toBe(200);
    expect(res1.headers['access-control-allow-origin']).toBe('https://focusforge--ai.vercel.app');
    expect(res1.headers['access-control-allow-credentials']).toBe('true');

    // Second alias origin
    const res2 = await request(testApp)
      .get('/health')
      .set('Origin', 'https://focusforge-six-ebon.vercel.app');

    expect(res2.status).toBe(200);
    expect(res2.headers['access-control-allow-origin']).toBe('https://focusforge-six-ebon.vercel.app');
    expect(res2.headers['access-control-allow-credentials']).toBe('true');
  });

  it('rejects unconfigured origins by omitting Access-Control-Allow-Origin', async () => {
    env.CLIENT_ORIGIN = 'https://focusforge--ai.vercel.app, https://focusforge-six-ebon.vercel.app';
    const testApp = createApp();

    const res = await request(testApp)
      .get('/health')
      .set('Origin', 'https://unauthorized-malicious-site.com');

    expect(res.status).toBe(200);
    // Unallowed origins must NEVER receive Access-Control-Allow-Origin
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles preflight OPTIONS requests for allowed origin with credentials', async () => {
    env.CLIENT_ORIGIN = 'https://focusforge--ai.vercel.app';
    const testApp = createApp();

    const res = await request(testApp)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'https://focusforge--ai.vercel.app')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('https://focusforge--ai.vercel.app');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('handles requests with no Origin header (e.g. server-to-server or curl)', async () => {
    const testApp = createApp();
    const res = await request(testApp).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

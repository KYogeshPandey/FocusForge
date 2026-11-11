import request from 'supertest';
import { app } from '../src/app.js';
import { REFRESH_COOKIE_NAME } from '../src/utils/tokens.js';

export async function createTestUser(
  name = 'Test User',
  email = 'test@focusforge.dev',
  password = 'password123'
) {
  const res = await request(app).post('/api/v1/auth/register').send({
    name,
    email,
    password,
  });

  const cookies = res.headers['set-cookie'] || [];
  let refreshToken = '';
  for (const cookie of cookies) {
    if (cookie.includes(REFRESH_COOKIE_NAME)) {
      const match = cookie.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
      if (match && match[1]) {
        refreshToken = match[1];
      }
    }
  }

  return {
    status: res.status,
    body: res.body,
    user: res.body?.data?.user,
    accessToken: res.body?.data?.accessToken,
    refreshToken,
    cookies,
  };
}

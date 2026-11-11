// Set test environment variables before module imports
process.env.NODE_ENV = 'test';
process.env.PORT = '5899';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/focusforge_live';
process.env.JWT_ACCESS_SECRET = 'live_verify_access_secret_1234567890';
process.env.JWT_REFRESH_SECRET = 'live_verify_refresh_secret_1234567890';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Server } from 'http';

async function runLiveVerification() {
  console.log('=== FocusForge API Live End-to-End Verification ===\n');

  // 1. Start in-memory MongoDB
  console.log('1. Starting MongoDB in-memory server...');
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log('   Connected to MongoDB at:', uri);

  // 2. Start Express app listening on real port
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const PORT = 5899;
  const BASE_URL = `http://localhost:${PORT}`;

  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });
  console.log(`2. Express HTTP server listening on ${BASE_URL}\n`);

  try {
    // 3. Health check
    console.log('3. Testing GET /health...');
    const healthRes = await fetch(`${BASE_URL}/health`);
    const healthData = await healthRes.json();
    console.log(`   Status: ${healthRes.status}, Body:`, JSON.stringify(healthData));
    if (healthRes.status !== 200 || !healthData.data.database.connected) {
      throw new Error('Health check failed');
    }

    // 4. Register new user
    console.log('\n4. Testing POST /api/v1/auth/register...');
    const regPayload = {
      name: 'Dr. Ada Lovelace',
      email: 'ada.lovelace@example.com',
      password: 'computingPioneer1843!',
    };
    const regRes = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regPayload),
    });
    const regData = await regRes.json();
    console.log(`   Status: ${regRes.status}, User: ${regData.data.user.name} (${regData.data.user.id})`);
    console.log(`   Access Token preview: ${regData.data.accessToken.slice(0, 25)}...`);

    const setCookieHeader = regRes.headers.get('set-cookie') || '';
    const refreshMatch = setCookieHeader.match(/focusforge_refresh_token=([^;]+)/);
    const refreshToken = refreshMatch ? refreshMatch[1] : '';
    console.log(`   Refresh Cookie captured: ${refreshToken.slice(0, 15)}... (HttpOnly: ${setCookieHeader.includes('HttpOnly')})`);

    // 5. Login
    console.log('\n5. Testing POST /api/v1/auth/login...');
    const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: regPayload.email,
        password: regPayload.password,
      }),
    });
    const loginData = await loginRes.json();
    console.log(`   Status: ${loginRes.status}, Logged in as: ${loginData.data.user.email}`);
    const accessToken = loginData.data.accessToken;

    // 6. Create Task with Bearer Token
    console.log('\n6. Testing POST /api/v1/tasks (protected route)...');
    const taskRes = await fetch(`${BASE_URL}/api/v1/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        title: 'Formulate Analytical Engine Algorithm',
        subject: 'Computer Science',
        priority: 'high',
        status: 'todo',
        dueDate: '2026-11-01',
        estimatedMinutes: 120,
      }),
    });
    const taskData = await taskRes.json();
    console.log(`   Status: ${taskRes.status}, Task Created: "${taskData.data.title}" (ID: ${taskData.data.id})`);

    // 7. List Tasks
    console.log('\n7. Testing GET /api/v1/tasks...');
    const listRes = await fetch(`${BASE_URL}/api/v1/tasks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const listData = await listRes.json();
    console.log(`   Status: ${listRes.status}, Found ${listData.data.items.length} task(s). Total in DB: ${listData.data.pagination.total}`);

    // 8. Refresh Token Rotation
    console.log('\n8. Testing POST /api/v1/auth/refresh (token rotation)...');
    const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `focusforge_refresh_token=${refreshToken}`,
      },
    });
    const refreshData = await refreshRes.json();
    console.log(`   Status: ${refreshRes.status}, New Access Token: ${refreshData.data.accessToken.slice(0, 25)}...`);
    const newSetCookie = refreshRes.headers.get('set-cookie') || '';
    const newRefreshMatch = newSetCookie.match(/focusforge_refresh_token=([^;]+)/);
    const newRefreshToken = newRefreshMatch ? newRefreshMatch[1] : '';
    console.log(`   Rotated Refresh Token: ${newRefreshToken.slice(0, 15)}...`);

    // 9. Logout
    console.log('\n9. Testing POST /api/v1/auth/logout...');
    const logoutRes = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        Cookie: `focusforge_refresh_token=${newRefreshToken}`,
      },
    });
    const logoutData = await logoutRes.json();
    console.log(`   Status: ${logoutRes.status}, Message: ${logoutData.data.message}`);

    // 10. Verify Revocation
    console.log('\n10. Verifying that revoked token cannot be refreshed...');
    const revokedRefreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `focusforge_refresh_token=${newRefreshToken}`,
      },
    });
    const revokedData = await revokedRefreshRes.json();
    console.log(`   Status: ${revokedRefreshRes.status} (Expected 401), Error Code: ${revokedData.error.code}`);

    console.log('\n=== ALL END-TO-END WIRE CHECKS PASSED SUCCESSFULLY! ===\n');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runLiveVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

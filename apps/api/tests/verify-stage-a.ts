// Set test environment variables before module imports
process.env.NODE_ENV = 'test';
process.env.PORT = '5891';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/focusforge_stage_a';
process.env.JWT_ACCESS_SECRET = 'stage_a_verify_access_secret_1234567890';
process.env.JWT_REFRESH_SECRET = 'stage_a_verify_refresh_secret_1234567890';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import type { Server } from 'http';

interface AuthResponse {
  success: boolean;
  data: {
    user: { id: string; email: string; name: string };
    accessToken: string;
  };
}

async function runStageAVerification() {
  console.log('--- STARTING STAGE A FULL-STACK INTEGRATION VERIFICATION ---');

  // 1. Boot up in-memory MongoDB
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
  console.log('✓ Connected to test MongoDB');

  // 2. Start Express API server
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  const PORT = 5891;
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(PORT, () => resolve(s));
  });
  const BASE_URL = `http://127.0.0.1:${PORT}/api/v1`;
  console.log(`✓ API server listening on ${BASE_URL}`);

  try {
    // Step 1: Register User A
    console.log('\n1. Register User A');
    const regRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Stage A User',
        email: 'stagea@focusforge.test',
        password: 'Password123!',
      }),
    });
    if (!regRes.ok) throw new Error(`Register failed: ${regRes.status}`);
    const regData = (await regRes.json()) as AuthResponse;
    const cookieHeader = regRes.headers.get('set-cookie') || '';
    const userAId = regData.data.user.id;
    let tokenA = regData.data.accessToken;
    console.log(`✓ User A registered (ID: ${userAId}, Token received)`);

    // Step 2: Create, Edit, Toggle, and Delete a Task
    console.log('\n2. Task Lifecycle (Create, Edit, Toggle, Delete)');
    const taskRes = await fetch(`${BASE_URL}/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Complete Distributed Systems Paper',
        subject: 'Computer Science',
        priority: 'high',
        dueDate: '2026-10-30',
        estimatedMinutes: 45,
      }),
    });
    if (!taskRes.ok) throw new Error(`Task create failed: ${taskRes.status}`);
    const taskData = await taskRes.json();
    const taskId = taskData.data.id;
    console.log(`✓ Task created (ID: ${taskId})`);

    // Edit Task
    const editRes = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Complete Raft Consensus Paper Review',
        status: 'in-progress',
      }),
    });
    if (!editRes.ok) throw new Error(`Task edit failed: ${editRes.status}`);
    const editData = await editRes.json();
    if (editData.data.status !== 'in-progress') throw new Error('Task edit did not update status');
    console.log('✓ Task edited successfully');

    // Toggle Task to Done
    const toggleRes = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ status: 'done' }),
    });
    if (!toggleRes.ok) throw new Error(`Task toggle failed: ${toggleRes.status}`);
    const toggleData = await toggleRes.json();
    if (toggleData.data.status !== 'done' || !toggleData.data.completedAt) {
      throw new Error('Task completedAt not stamped upon done transition');
    }
    console.log('✓ Task marked done and completedAt stamped');

    // Step 3: Run & Record Focus Session with Idempotent Outbox Retry
    console.log('\n3. Focus Session Recording with Idempotency');
    const clientSessionId = `test_cs_${Date.now()}`;
    const sessionRes1 = await fetch(`${BASE_URL}/focus-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientSessionId,
        title: 'CS Focus Interval',
        subject: 'Computer Science',
        durationMinutes: 25,
        startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        mode: 'focus',
        taskId,
      }),
    });
    if (!sessionRes1.ok) throw new Error(`Focus session 1 failed: ${sessionRes1.status}`);
    const session1Data = await sessionRes1.json();
    const sessionId = session1Data.data.id;
    console.log(`✓ Focus session recorded (ID: ${sessionId})`);

    // Duplicate retry with same clientSessionId must return same session without creating duplicate
    const sessionRes2 = await fetch(`${BASE_URL}/focus-sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        clientSessionId,
        title: 'CS Focus Interval',
        subject: 'Computer Science',
        durationMinutes: 25,
        startedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        endedAt: new Date().toISOString(),
        mode: 'focus',
      }),
    });
    if (!sessionRes2.ok) throw new Error(`Focus session duplicate retry failed: ${sessionRes2.status}`);
    const session2Data = await sessionRes2.json();
    if (session2Data.data.id !== sessionId) {
      throw new Error('Idempotency failure: duplicate session created for same clientSessionId');
    }
    console.log('✓ Focus session idempotency verified (duplicate retries tolerated)');

    // Step 4: Habit and Habit Completion Lifecycle
    console.log('\n4. Habit & Completion Lifecycle');
    const habitRes = await fetch(`${BASE_URL}/habits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        title: 'Read 20 pages',
        category: 'Study',
        frequency: 'daily',
        targetPerDay: 1,
      }),
    });
    if (!habitRes.ok) throw new Error(`Habit create failed: ${habitRes.status}`);
    const habitData = await habitRes.json();
    const habitId = habitData.data.id;
    console.log(`✓ Habit created (ID: ${habitId})`);

    const compRes = await fetch(`${BASE_URL}/habits/${habitId}/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        date: '2026-10-28',
        completed: true,
      }),
    });
    if (!compRes.ok) throw new Error(`Habit completion failed: ${compRes.status}`);
    console.log('✓ Habit completion toggled');

    // Step 5: Session Restore & Silent Refresh
    console.log('\n5. Session Restore & Silent Refresh');
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
      },
    });
    if (!refreshRes.ok) throw new Error(`Refresh failed: ${refreshRes.status}`);
    const refreshData = await refreshRes.json();
    tokenA = refreshData.data.accessToken;
    const newCookie = refreshRes.headers.get('set-cookie') || cookieHeader;
    console.log('✓ Silent token refresh rotated successfully');

    // Verify /auth/me returns User A profile
    const meRes = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    if (!meRes.ok) throw new Error(`/auth/me failed: ${meRes.status}`);
    const meData = await meRes.json();
    if (meData.data.email !== 'stagea@focusforge.test') {
      throw new Error('Profile mismatch on /auth/me');
    }
    console.log('✓ /auth/me restored session profile accurately');

    // Step 6: Tenant Isolation (User B sees none of User A data)
    console.log('\n6. Tenant Isolation Verification (User B vs User A)');
    const regBRes = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'User B Isolated',
        email: 'userb@focusforge.test',
        password: 'Password123!',
      }),
    });
    const regBData = await regBRes.json();
    const tokenB = regBData.data.accessToken;

    // User B listing tasks must be empty
    const bTasksRes = await fetch(`${BASE_URL}/tasks`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const bTasksData = await bTasksRes.json();
    if (bTasksData.data.items.length !== 0) {
      throw new Error('Tenant leak: User B saw User A tasks');
    }

    // User B attempting to access User A task returns 404
    const bAccessRes = await fetch(`${BASE_URL}/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    if (bAccessRes.status !== 404) {
      throw new Error(`Expected 404 on cross-user access, got ${bAccessRes.status}`);
    }
    console.log('✓ Tenant isolation strictly enforced: User B sees empty workspace and 404 on User A resources');

    // Step 7: Bulk Data Migration (/import)
    console.log('\n7. Local Data Migration Import');
    const importRes = await fetch(`${BASE_URL}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenB}`,
      },
      body: JSON.stringify({
        tasks: [
          {
            title: 'Migrated Local Task',
            subject: 'Physics',
            priority: 'medium',
            status: 'todo',
          },
        ],
        habits: [
          {
            title: 'Migrated Habit',
            category: 'Health',
          },
        ],
      }),
    });
    if (!importRes.ok) throw new Error(`Import failed: ${importRes.status}`);
    const importSummary = await importRes.json();
    if (importSummary.data.tasksImported !== 1 || importSummary.data.habitsImported !== 1) {
      throw new Error('Import counts mismatch');
    }
    console.log('✓ Bulk local data imported into User B account successfully');

    // Step 8: Account Deletion (Cascade Cleanup)
    console.log('\n8. Account Deletion and Cascade Cleanup');
    const deleteRes = await fetch(`${BASE_URL}/auth/me`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        password: 'Password123!',
      }),
    });
    if (!deleteRes.ok) throw new Error(`Delete account failed: ${deleteRes.status}`);
    console.log('✓ User A account deleted');

    // Attempting login after deletion must fail with 401
    const postDelLogin = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'stagea@focusforge.test',
        password: 'Password123!',
      }),
    });
    if (postDelLogin.status !== 401) {
      throw new Error('Deleted user was able to log in');
    }
    console.log('✓ Post-deletion login correctly blocked (401 Unauthorized)');

    console.log('\n======================================================');
    console.log('✅ ALL STAGE A INTEGRATION FLOWS VERIFIED SUCCESSFULLY');
    console.log('======================================================');
  } finally {
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
  }
}

runStageAVerification().catch((err) => {
  console.error('STAGE A VERIFICATION FAILED:', err);
  process.exit(1);
});

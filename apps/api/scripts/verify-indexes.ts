import { connectDB, disconnectDB } from '../src/config/db.js';
import {
  User,
  RefreshToken,
  Task,
  Habit,
  HabitCompletion,
  StudySession,
  FocusSession,
  Goal,
} from '../src/models/index.js';

async function main() {
  console.log('[FocusForge Index Verifier] Connecting to database...');
  await connectDB();

  const models = [
    { name: 'User', model: User },
    { name: 'RefreshToken', model: RefreshToken },
    { name: 'Task', model: Task },
    { name: 'Habit', model: Habit },
    { name: 'HabitCompletion', model: HabitCompletion },
    { name: 'StudySession', model: StudySession },
    { name: 'FocusSession', model: FocusSession },
    { name: 'Goal', model: Goal },
  ];

  console.log(`[FocusForge Index Verifier] Verifying & syncing indexes across ${models.length} collections...`);

  for (const { name, model } of models) {
    try {
      await model.syncIndexes();
      const indexes = await model.collection.indexes();
      console.log(`  ✓ ${name} (${indexes.length} indexes verified):`);
      for (const idx of indexes) {
        console.log(`      - ${idx.name}: ${JSON.stringify(idx.key)}`);
      }
    } catch (err) {
      console.error(`  ✗ Failed to verify indexes for ${name}:`, err);
      process.exitCode = 1;
    }
  }

  await disconnectDB();
  console.log('[FocusForge Index Verifier] Index verification complete.');
}

main().catch((err) => {
  console.error('[FocusForge Index Verifier] Fatal error:', err);
  process.exit(1);
});

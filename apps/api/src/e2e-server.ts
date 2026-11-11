import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Configure test environment variables before loading any server modules
process.env.NODE_ENV = 'test';
process.env.PORT = '5000';
process.env.JWT_ACCESS_SECRET = 'test_access_secret_1234567890_secure_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_1234567890_secure_long';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.ACCESS_TOKEN_TTL = '15m';
process.env.REFRESH_TOKEN_TTL = '7d';

async function startE2EServer() {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  process.env.MONGODB_URI = uri;

  await mongoose.connect(uri);
  console.log(`[E2E] In-memory MongoDB connected at ${uri}`);

  const { app } = await import('./app.js');
  const server = app.listen(5000, () => {
    console.log('[E2E] API server running on http://localhost:5000');
  });

  const cleanup = async () => {
    console.log('[E2E] Shutting down E2E server...');
    server.close();
    await mongoose.disconnect();
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startE2EServer().catch((err) => {
  console.error('[E2E] Failed to start E2E server:', err);
  process.exit(1);
});

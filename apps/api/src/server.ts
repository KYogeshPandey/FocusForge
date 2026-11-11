import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB, disconnectDB } from './config/db.js';
import type { Server } from 'http';

let server: Server;

async function bootstrap() {
  try {
    console.log(`[FocusForge API] Connecting to MongoDB at ${env.MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}...`);
    await connectDB();
    console.log('[FocusForge API] Successfully connected to database.');

    server = app.listen(env.PORT, () => {
      console.log(`[FocusForge API] Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`[FocusForge API] Health endpoint available at http://localhost:${env.PORT}/health`);
      console.log(`[FocusForge API] API base URL: http://localhost:${env.PORT}/api/v1`);
    });
  } catch (error) {
    console.error('[FocusForge API] Fatal error during startup:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function handleShutdown(signal: string) {
  console.log(`\n[FocusForge API] Received ${signal}. Starting graceful shutdown...`);

  if (server) {
    server.close(async () => {
      console.log('[FocusForge API] HTTP server closed.');
      try {
        await disconnectDB();
        console.log('[FocusForge API] MongoDB connection closed.');
        process.exit(0);
      } catch (err) {
        console.error('[FocusForge API] Error during DB disconnect:', err);
        process.exit(1);
      }
    });

    // Force shutdown if cleanup takes too long
    setTimeout(() => {
      console.error('[FocusForge API] Forced shutdown after timeout.');
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

bootstrap();

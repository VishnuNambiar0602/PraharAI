import dotenv from 'dotenv';
<<<<<<< Updated upstream
import app, { seedAdminUser } from './api/server';
import { schemeSyncAgent } from './agents/scheme-sync-agent';
=======
import fs from 'fs';
import path from 'path';
>>>>>>> Stashed changes

function loadEnv(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
      console.log(`🔧 Loaded environment from ${candidate}`);
      return;
    }
  }

  dotenv.config();
  console.warn('⚠️ No shared .env file found. Using process environment only.');
}

loadEnv();

const PORT = process.env.PORT || 3000;

async function bootstrap(): Promise<void> {
  const [{ default: app, seedAdminUser }, { schemeSyncAgent }, { nudgeService }] = await Promise.all([
    import('./api/server'),
    import('./agents/scheme-sync-agent'),
    import('./services/nudge.service'),
  ]);

<<<<<<< Updated upstream
  // Start scheme sync agent (initialises Neo4j + Redis + syncs from API if stale)
  console.log('\n🤖 Starting Scheme Sync Agent...');
  try {
    await schemeSyncAgent.start();
    await seedAdminUser(); // ensure admin exists after DB init
    console.log('✅ Scheme Sync Agent started successfully\n');
  } catch (error) {
    console.error('❌ Failed to start Scheme Sync Agent:', error);
    console.log('⚠️  Server will continue without scheme sync\n');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await schemeSyncAgent.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  await schemeSyncAgent.stop();
  process.exit(0);
=======
  app.listen(PORT, async () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`👤 Users API: http://localhost:${PORT}/api/users`);

    // Start scheme sync agent (initialises Neo4j + Redis + syncs from API if stale)
    console.log('\n🤖 Starting Scheme Sync Agent...');
    try {
      await schemeSyncAgent.start();
      await seedAdminUser(); // ensure admin exists after DB init
      await nudgeService.start();
      console.log('✅ Scheme Sync Agent started successfully\n');
    } catch (error) {
      console.error('❌ Failed to start Scheme Sync Agent:', error);
      console.log('⚠️  Server will continue without scheme sync\n');
    }
  });

  const shutdown = async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await nudgeService.stop();
    await schemeSyncAgent.stop();
    process.exit(0);
  };

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((error) => {
  console.error('❌ Backend bootstrap failed:', error);
  process.exit(1);
>>>>>>> Stashed changes
});

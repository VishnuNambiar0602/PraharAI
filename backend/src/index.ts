import dotenv from 'dotenv';
import app, { seedAdminUser } from './api/server';
import { schemeSyncAgent } from './agents/scheme-sync-agent';

dotenv.config();

const PORT = process.env.PORT || 3000;

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
});

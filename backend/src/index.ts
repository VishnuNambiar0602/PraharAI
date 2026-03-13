import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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

async function ensureGramPanchayatData(): Promise<void> {
  const autoSeedEnabled =
    String(process.env.AUTO_SEED_GP_ON_STARTUP || 'true').toLowerCase() !== 'false';
  if (!autoSeedEnabled) {
    console.log('ℹ️ GP auto-seed disabled (AUTO_SEED_GP_ON_STARTUP=false)');
    return;
  }

  const [{ neo4jService }] = await Promise.all([import('./db/neo4j.service')]);

  try {
    const gpCount = await neo4jService.getGramPanchayatCount();
    if (gpCount > 0) {
      console.log(`✅ GP data already present (${gpCount.toLocaleString()} nodes). Skipping seed.`);
      return;
    }

    const hasApiKey = Boolean(process.env.DATA_GOV_IN_API_KEY);
    const hasResourceId = Boolean(process.env.LGD_GP_RESOURCE_ID);
    if (!hasApiKey || !hasResourceId) {
      console.warn(
        '⚠️ GP data missing, but DATA_GOV_IN_API_KEY or LGD_GP_RESOURCE_ID is not set. Skipping auto-seed.'
      );
      return;
    }

    console.log('🌱 GP data missing. Running auto-seed...');
    const backendRoot = path.resolve(__dirname, '..');
    const { stdout, stderr } = await execAsync('npx tsx scripts/seed-gram-panchayats.ts', {
      cwd: backendRoot,
      env: process.env,
      maxBuffer: 20 * 1024 * 1024,
    });
    if (stdout?.trim()) console.log(stdout.trim());
    if (stderr?.trim()) console.warn(stderr.trim());

    const after = await neo4jService.getGramPanchayatCount();
    console.log(`✅ GP auto-seed complete (${after.toLocaleString()} nodes).`);
  } catch (error) {
    console.error('❌ GP auto-seed check failed:', error);
  }
}

async function bootstrap(): Promise<void> {
  const [{ default: app, seedAdminUser }, { schemeSyncAgent }, { nudgeService }] =
    await Promise.all([
      import('./api/server'),
      import('./agents/scheme-sync-agent'),
      import('./services/nudge.service'),
    ]);

  app.listen(PORT, async () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
    console.log(`👤 Users API: http://localhost:${PORT}/api/users`);

    // Start scheme sync agent (initialises Neo4j + Redis + syncs from API if stale)
    console.log('\n🤖 Starting Scheme Sync Agent...');
    try {
      await schemeSyncAgent.start();
      await ensureGramPanchayatData();
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
});

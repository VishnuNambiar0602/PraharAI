/**
 * Main API Server
 * Sets up Express server with all routes and middleware
 * Users persisted in Neo4j; schemes served from Neo4j via SchemeSyncAgent
 * Chat is proxied to FastAPI ML service (port 8000)
 */

/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { join } from 'path';
import { neo4jService } from '../db/neo4j.service';
import { redisService } from '../db/redis.service';
import { getTranslationService } from '../services/translation.service';
import { schemeSyncAgent } from '../agents/scheme-sync-agent';
import { mlService } from '../services/ml.service';
import { chatOrchestrationService } from '../services/chat-orchestration.service';
import { JWTService } from '../auth/jwt.service';
import { PasswordService } from '../auth/password.service';

// ─── LGD state/district data ─────────────────────────────────────────────────
interface LGDDistrict {
  name: string;
}
interface LGDState {
  name: string;
  code: string;
  districts: LGDDistrict[];
}
let lgdData: LGDState[] = [];
try {
  const raw = readFileSync(join(__dirname, '../../data/india-states-districts.json'), 'utf-8');
  lgdData = JSON.parse(raw) as LGDState[];
} catch {
  console.warn('LGD data file not found; /api/lgd/* endpoints will return empty results');
}

const app = express();
const ADMIN_KEY = process.env.ADMIN_KEY || '';
const jwtService = new JWTService();
const passwordService = new PasswordService();

const defaultOrigins = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
const configuredOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = configuredOrigins.length > 0 ? configuredOrigins : defaultOrigins;

// Initialize translation service with Redis caching
const ts = getTranslationService(redisService);

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json());
app.use(ts.translationMiddleware());

// ─── Seed admin user (called after neo4jService.init()) ──────────────────────
export async function seedAdminUser() {
  const admin = await neo4jService.getUserByEmail('admin@example.com');
  if (!admin) {
    await neo4jService.createUser({
      userId: 'admin123',
      email: 'admin@example.com',
      password: 'password',
      name: 'Admin User',
      isAdmin: true,
    });
    console.log('✅ Admin user seeded');
  }

  // Admin should never be blocked by onboarding.
  const ensuredAdmin = await neo4jService.getUserByEmail('admin@example.com');
  if (ensuredAdmin && !ensuredAdmin.onboarding_complete) {
    await neo4jService.updateUserProfile(ensuredAdmin.user_id, {
      onboarding_complete: true,
      is_admin: true,
    });
  }
}

// ─── Helper: profile completeness ─────────────────────────────────────────────
function calculateProfileCompleteness(user: any): number {
  const fields = [
    'name',
    'email',
    'age',
    'income',
    'state',
    'employment',
    'education',
    'gender',
    'social_category',
    'interests',
    'marital_status',
    'rural_urban',
    'occupation',
  ];
  const filledFields = fields.filter((field) => user[field] != null && user[field] !== '');
  return Math.round((filledFields.length / fields.length) * 100);
}

// Mock authentication routes
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('=== REGISTRATION REQUEST ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const { email, password, name, age, income, state, gender } = req.body || {};
    console.log('Registration attempt:', { email, name });

    // Validate required fields before making any DB calls.
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email and password' });
    }

    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Check if user already exists
    const existingUser = await neo4jService.getUserByEmail(email);
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(409).json({ error: 'User already exists' });
    }

    const userId = `user_${Date.now()}`;
    await neo4jService.createUser({
      userId,
      email,
      password,
      name: name || 'User',
      age: age ? Number(age) : undefined,
      income: income || undefined,
      state: state || undefined,
      gender: gender || undefined,
    });

    console.log('User registered successfully:', userId);

    const accessToken = `mock_access_token_${userId}`;
    const refreshToken = `mock_refresh_token_${userId}`;

    const response = {
      user: { userId, email, name: name || 'User', isAdmin: false },
      accessToken,
      refreshToken,
    };

    console.log('Sending response:', response);
    return res.status(201).json(response);
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    const user = await neo4jService.getUserByEmail(email);
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Login successful:', user.user_id);

    const accessToken = `mock_access_token_${user.user_id}`;
    const refreshToken = `mock_refresh_token_${user.user_id}`;

    return res.json({
      user: {
        userId: user.user_id,
        email: user.email,
        name: user.name,
        isAdmin:
          Boolean(user.is_admin) ||
          user.user_id === 'admin123' ||
          user.email === 'admin@example.com',
      },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.post('/api/auth/logout', (_req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Mock profile endpoints for testing (without database)
app.get('/api/users/:userId/profile', async (req, res) => {
  const user = await neo4jService.getUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    userId: user.user_id,
    name: user.name,
    email: user.email,
    dateOfBirth: user.date_of_birth ?? null,
    age: user.age ?? null,
    income: user.income ?? null,
    state: user.state ?? null,
    employment: user.employment ?? null,
    education: user.education ?? null,
    gender: user.gender ?? null,
    socialCategory: user.social_category ?? null,
    interests: user.interests ?? null,
    disability: !!user.is_disabled,
    minority: !!user.is_minority,
    maritalStatus: user.marital_status ?? null,
    familySize: user.family_size ?? null,
    residenceType: user.rural_urban ?? null,
    occupation: user.occupation ?? null,
    povertyStatus: user.poverty_status ?? null,
    rationCard: user.ration_card ?? null,
    landOwnership: user.land_ownership ?? null,
    district: user.district ?? null,
    disabilityType: user.disability_type ?? null,
    minorityCommunity: user.minority_community ?? null,
    isAdmin:
      Boolean(user.is_admin) || user.user_id === 'admin123' || user.email === 'admin@example.com',
    onboardingComplete: !!user.onboarding_complete,
    completeness: calculateProfileCompleteness(user),
  });
});

app.put('/api/users/:userId/profile', async (req, res) => {
  const user = await neo4jService.getUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Map camelCase keys to snake_case columns
  const mappedFields: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    name: 'name',
    dateOfBirth: 'date_of_birth',
    age: 'age',
    income: 'income',
    state: 'state',
    employment: 'employment',
    education: 'education',
    gender: 'gender',
    interests: 'interests',
    onboardingComplete: 'onboarding_complete',
    socialCategory: 'social_category',
    disability: 'is_disabled',
    minority: 'is_minority',
    maritalStatus: 'marital_status',
    familySize: 'family_size',
    residenceType: 'rural_urban',
    occupation: 'occupation',
    povertyStatus: 'poverty_status',
    rationCard: 'ration_card',
    landOwnership: 'land_ownership',
    district: 'district',
    disabilityType: 'disability_type',
    minorityCommunity: 'minority_community',
  };
  for (const [k, col] of Object.entries(fieldMap)) {
    if (req.body[k] !== undefined) mappedFields[col] = req.body[k];
  }
  await neo4jService.updateUserProfile(req.params.userId, mappedFields);

  const updated = (await neo4jService.getUserById(req.params.userId))!;
  return res.json({
    userId: updated.user_id,
    name: updated.name,
    email: updated.email,
    dateOfBirth: updated.date_of_birth ?? null,
    age: updated.age ?? null,
    income: updated.income ?? null,
    state: updated.state ?? null,
    employment: updated.employment ?? null,
    education: updated.education ?? null,
    gender: updated.gender ?? null,
    socialCategory: updated.social_category ?? null,
    interests: updated.interests ?? null,
    disability: !!updated.is_disabled,
    minority: !!updated.is_minority,
    maritalStatus: updated.marital_status ?? null,
    familySize: updated.family_size ?? null,
    residenceType: updated.rural_urban ?? null,
    occupation: updated.occupation ?? null,
    povertyStatus: updated.poverty_status ?? null,
    rationCard: updated.ration_card ?? null,
    landOwnership: updated.land_ownership ?? null,
    district: updated.district ?? null,
    disabilityType: updated.disability_type ?? null,
    minorityCommunity: updated.minority_community ?? null,
    isAdmin:
      Boolean(updated.is_admin) ||
      updated.user_id === 'admin123' ||
      updated.email === 'admin@example.com',
    onboardingComplete: !!updated.onboarding_complete,
    completeness: calculateProfileCompleteness(updated),
  });
});

app.delete('/api/users/:userId/profile', async (req, res) => {
  const deleted = await neo4jService.deleteUserById(req.params.userId);
  if (!deleted) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    success: true,
    message: 'Profile deleted successfully',
  });
});

// Real schemes endpoints using India.gov.in API
import { schemesController } from '../schemes/schemes.controller';

app.get('/api/schemes/stats', (req, res) => schemesController.getStats(req, res));
app.get('/api/schemes', (req, res) => schemesController.getSchemes(req, res));
app.get('/api/schemes/categories', (req, res) => schemesController.getCategories(req, res));
app.get('/api/schemes/:schemeId', (req, res) => schemesController.getSchemeById(req, res));
app.get('/api/users/:userId/recommendations', (req, res) =>
  schemesController.getRecommendations(req, res)
);
app.post('/api/users/:userId/recommendations/feedback', (req, res) =>
  schemesController.postRecommendationFeedback(req, res)
);

// Mock nudges endpoint
app.get('/api/users/:userId/nudges', (_req, res) => {
  res.json([
    {
      nudgeId: '1',
      title: 'New Scheme Available',
      message: 'A new agriculture scheme matching your profile is now available',
      priority: 'high',
      schemeId: '1',
      viewed: false,
      dismissed: false,
    },
  ]);
});

// Chat endpoint — proxies to FastAPI ML service
app.post('/api/chat', async (req, res) => {
  const result = await chatOrchestrationService.process({
    message: req.body?.message,
    conversationHistory: req.body?.conversationHistory,
    preferredLanguage: req.body?.preferredLanguage,
    authorization: req.headers.authorization,
  });
  return res.status(result.statusCode).json(result.body);
});

// Health check with cache stats
app.get('/health', async (_req, res) => {
  const cacheStats = redisService.getStats();
  const mlAvailable = await mlService.isAvailable();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    mlService: {
      ...mlService.getStatus(),
      available: mlAvailable,
    },
  });
});

// Debug endpoint to see all users
app.get('/api/debug/users', async (_req, res) => {
  const users = await neo4jService.getAllUsers();
  res.json({
    users: users.map((u: any) => ({ userId: u.user_id, email: u.email, name: u.name })),
    count: users.length,
  });
});

// ─── ReAct Agent Chat Endpoint (New, experimental) ────────────────────────────
app.post('/api/react-chat', async (req, res) => {
  const result = await chatOrchestrationService.process({
    message: req.body?.message,
    conversationHistory: req.body?.conversationHistory,
    preferredLanguage: req.body?.preferredLanguage,
    authorization: req.headers.authorization,
    forceMode: 'react',
  });
  return res.status(result.statusCode).json(result.body);
});

// ─── Admin Sync Endpoints (protected with X-Admin-Key or admin login) ────────

async function requireAdminAccess(req: express.Request, res: express.Response): Promise<boolean> {
  const keyHeader = req.headers['x-admin-key'];
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;

  // Preferred for server-to-server callers.
  if (key && key === ADMIN_KEY) {
    return true;
  }

  // Also allow authenticated in-app admin user or a valid panchayat JWT.
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (token) {
    // First try to verify as a proper JWT (admin or panchayat).
    try {
      const payload = jwtService.verifyAccessToken(token);
      if (payload.role === 'admin' || payload.role === 'panchayat') {
        return true;
      }
    } catch {
      // Not a valid JWT — fall through to legacy mock-token check.
    }

    // Legacy mock token support for in-app admin users.
    const userId = token
      .replace('mock_access_token_', '')
      .replace('mock_refresh_token_', '')
      .trim();
    if (userId) {
      const user = await neo4jService.getUserById(userId);
      if (
        user &&
        (Boolean(user.is_admin) ||
          user.user_id === 'admin123' ||
          user.email === 'admin@example.com')
      ) {
        return true;
      }
    }
  }

  res.status(403).json({ error: 'Forbidden: admin login or valid X-Admin-Key required' });
  return false;
}

app.get('/api/admin/sync/status', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    const status = await schemeSyncAgent.getSyncStatus();
    return res.json(status);
  } catch (error: any) {
    console.error('Sync status error:', error);
    return res.status(500).json({ error: 'Failed to get sync status', details: error.message });
  }
});

app.get('/api/admin/metrics', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    const [syncStatus, adminMetrics, mlAvailable] = await Promise.all([
      schemeSyncAgent.getSyncStatus(),
      neo4jService.getAdminMetrics(),
      mlService.isAvailable(),
    ]);

    return res.json({
      users: adminMetrics.users,
      schemes: {
        pulled: syncStatus.totalSchemes,
        inGraph: adminMetrics.schemes.total,
        enriched: adminMetrics.schemes.enriched,
        withEligibility: adminMetrics.schemes.withEligibility,
        withBenefits: adminMetrics.schemes.withBenefits,
        enrichmentRate: adminMetrics.schemes.enrichmentRate,
      },
      trends: adminMetrics.trends,
      sync: syncStatus,
      cache: redisService.getStats(),
      mlService: {
        ...mlService.getStatus(),
        available: mlAvailable,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Admin metrics error:', error);
    return res.status(500).json({ error: 'Failed to fetch admin metrics', details: error.message });
  }
});

app.post('/api/admin/sync', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    // Fire off the sync in the background, respond immediately
    schemeSyncAgent.forceSyncNow().catch((err) => {
      console.error('Background sync error:', err);
    });

    return res.json({ message: 'Sync triggered', startedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('Force sync error:', error);
    return res.status(500).json({ error: 'Failed to trigger sync', details: error.message });
  }
});

app.get('/api/admin/admins', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    const admins = await neo4jService.listAdminUsers();
    return res.json(
      admins.map((admin: any) => ({
        userId: admin.user_id,
        email: admin.email,
        name: admin.name,
        isAdmin: true,
        createdAt: admin.created_at ?? null,
      }))
    );
  } catch (error: any) {
    console.error('List admins error:', error);
    return res.status(500).json({ error: 'Failed to list admins', details: error.message });
  }
});

app.post('/api/admin/admins', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing required fields: email and password' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const admin = await neo4jService.createAdminUser({
      email: String(email).trim(),
      password: String(password),
      name: typeof name === 'string' ? name.trim() : undefined,
    });

    return res.status(201).json({
      userId: admin.user_id,
      email: admin.email,
      name: admin.name,
      isAdmin: true,
      createdAt: admin.created_at ?? null,
    });
  } catch (error: any) {
    const status = String(error?.message || '').includes('already exists') ? 409 : 500;
    console.error('Create admin error:', error);
    return res.status(status).json({ error: error.message || 'Failed to create admin' });
  }
});

app.delete('/api/admin/admins/:userId', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;

  try {
    const { userId } = req.params;
    const deleted = await neo4jService.deleteAdminUser(userId);
    if (!deleted) {
      return res.status(404).json({ error: 'Admin user not found' });
    }
    return res.json({ success: true, message: 'Admin user deleted successfully' });
  } catch (error: any) {
    console.error('Delete admin error:', error);
    return res.status(400).json({ error: error.message || 'Failed to delete admin user' });
  }
});

// ─── Admin Dashboard Stats ────────────────────────────────────────────────────
app.get('/api/admin/stats', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const [metrics, syncStatus] = await Promise.all([
      neo4jService.getAdminMetrics(),
      schemeSyncAgent.getSyncStatus(),
    ]);

    const trends = metrics.trends.users;
    const last = trends[trends.length - 1]?.count || 0;
    const prev = trends[trends.length - 2]?.count || 0;
    const userGrowth = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;

    return res.json({
      totalUsers: metrics.users.total,
      totalSchemes: metrics.schemes.total,
      activeSchemes: syncStatus.totalSchemes,
      totalApplications: 0,
      userGrowth,
      schemeGrowth: 0,
      applicationGrowth: 0,
    });
  } catch (error: any) {
    console.error('Admin stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

// ─── Admin Users ──────────────────────────────────────────────────────────────
app.get('/api/admin/users', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const users = await neo4jService.getAllUsers();
    return res.json(
      users.map((u: any) => ({
        userId: u.user_id,
        email: u.email,
        name: u.name || null,
        age: u.age ?? null,
        income: u.income ?? null,
        state: u.state || null,
        employment: u.employment || null,
        education: u.education || null,
        gender: u.gender || null,
        createdAt: u.created_at || new Date().toISOString(),
        onboardingComplete: Boolean(u.onboarding_complete),
      }))
    );
  } catch (error: any) {
    console.error('Admin users error:', error);
    return res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const { userId } = req.params;
    const deleted = await neo4jService.deleteUserById(userId);
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Admin delete user error:', error);
    return res.status(400).json({ error: error.message || 'Failed to delete user' });
  }
});

// ─── Admin Analytics ──────────────────────────────────────────────────────────
app.get('/api/admin/analytics', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const [metrics, users] = await Promise.all([
      neo4jService.getAdminMetrics(),
      neo4jService.getAllUsers(),
    ]);

    const stateCounts = new Map<string, number>();
    const empCounts = new Map<string, number>();
    users.forEach((u: any) => {
      if (u.state) stateCounts.set(u.state, (stateCounts.get(u.state) || 0) + 1);
      const emp = u.employment || u.occupation;
      if (emp) empCounts.set(emp, (empCounts.get(emp) || 0) + 1);
    });

    const byState = Array.from(stateCounts.entries())
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const byEmployment = Array.from(empCounts.entries())
      .map(([employment, count]) => ({ employment, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return res.json({
      summary: {
        totalUsers: metrics.users.total,
        totalSchemes: metrics.schemes.total,
        onboardedUsers: metrics.users.onboarded,
        enrichedSchemes: metrics.schemes.enriched,
        enrichmentRate: metrics.schemes.enrichmentRate,
      },
      trends: metrics.trends,
      distribution: { byState, byEmployment },
    });
  } catch (error: any) {
    console.error('Admin analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

// ─── Admin Activity Logs ──────────────────────────────────────────────────────
app.get('/api/admin/activity', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const [users, syncStatus] = await Promise.all([
      neo4jService.getAllUsers(),
      schemeSyncAgent.getSyncStatus(),
    ]);

    const logs: any[] = [];

    users.forEach((u: any) => {
      if (u.created_at) {
        logs.push({
          id: `user-reg-${u.user_id}`,
          timestamp: u.created_at,
          action: 'User registered',
          userId: u.user_id,
          userName: u.name || u.email,
          details: `New user registered${u.state ? ` from ${u.state}` : ''}`,
          type: 'user',
        });
      }
      if (u.onboarding_complete && (u.updated_at || u.created_at)) {
        logs.push({
          id: `user-onboard-${u.user_id}`,
          timestamp: u.updated_at || u.created_at,
          action: 'Onboarding completed',
          userId: u.user_id,
          userName: u.name || u.email,
          details: 'User completed their onboarding profile',
          type: 'user',
        });
      }
    });

    if (syncStatus.lastSync) {
      logs.push({
        id: `sync-last`,
        timestamp: syncStatus.lastSync,
        action: 'Scheme sync completed',
        details: `Synced ${syncStatus.totalSchemes} schemes from India.gov.in`,
        type: 'system',
      });
    }

    logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return res.json(logs.slice(0, limit));
  } catch (error: any) {
    console.error('Admin activity error:', error);
    return res.status(500).json({ error: 'Failed to fetch activity', details: error.message });
  }
});

// ─── Admin System Health ──────────────────────────────────────────────────────
app.get('/api/admin/health', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const mlAvailable = await mlService.isAvailable();
    let neo4jHealthy = false;
    try {
      await neo4jService.getAdminMetrics();
      neo4jHealthy = true;
    } catch {
      neo4jHealthy = false;
    }

    const cacheStats = redisService.getStats();
    const redisHealthy = cacheStats.hits >= 0; // redis is available if we can get stats

    const allCoreHealthy = neo4jHealthy && redisHealthy;
    const status = !allCoreHealthy ? 'down' : mlAvailable ? 'healthy' : 'degraded';

    return res.json({
      status,
      neo4j: neo4jHealthy,
      redis: redisHealthy,
      api: true,
      mlService: mlAvailable,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// ─── Admin ML Circuit Breaker Reset ──────────────────────────────────────────
app.post('/api/admin/ml/reset', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const available = await mlService.isAvailable();
    return res.json({
      message: 'ML service status refreshed',
      available,
      status: mlService.getStatus(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to reset ML status', details: error.message });
  }
});

// ─── LGD State / District Lookups (public, no auth) ─────────────────────────

app.get('/api/lgd/states', (_req, res) => {
  return res.json(lgdData.map((s) => ({ name: s.name, code: s.code })));
});

app.get('/api/lgd/districts', (req, res) => {
  const stateName = String(req.query.state ?? '').trim();
  if (!stateName) return res.status(400).json({ error: 'state query param required' });
  const found = lgdData.find((s) => s.name.toLowerCase() === stateName.toLowerCase());
  if (!found) return res.status(404).json({ error: 'State not found' });
  return res.json(found.districts.map((d) => d.name));
});

app.get('/api/lgd/panchayats', async (req, res) => {
  const state = String(req.query.state ?? '').trim();
  const district = String(req.query.district ?? '').trim();
  const subdistrict = String(req.query.subdistrict ?? '').trim();
  if (!state || !district) {
    return res.status(400).json({ error: 'state and district query params required' });
  }
  try {
    // Official LGD village nodes + any panchayat names from registered PanchayatUser accounts
    const [official, registered] = await Promise.all([
      neo4jService.listGramPanchayats(state, district, subdistrict || undefined),
      neo4jService.listPanchayatNamesByLocation(state, district),
    ]);
    const merged = [...new Set([...official, ...registered])].sort();
    return res.json(merged);
  } catch (error: any) {
    return res
      .status(500)
      .json({ error: 'Failed to fetch panchayat names', details: error.message });
  }
});

app.get('/api/lgd/subdistricts', async (req, res) => {
  const state = String(req.query.state ?? '').trim();
  const district = String(req.query.district ?? '').trim();
  if (!state || !district) {
    return res.status(400).json({ error: 'state and district query params required' });
  }
  try {
    const names = await neo4jService.listSubdistricts(state, district);
    return res.json(names);
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch sub-districts', details: error.message });
  }
});

// ─── Panchayat Auth Middleware ────────────────────────────────────────────────

async function requirePanchayatAuth(
  req: express.Request,
  res: express.Response
): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ error: 'Panchayat authentication required' });
      return null;
    }
    const payload = jwtService.verifyAccessToken(token);
    if (payload.role !== 'panchayat') {
      res.status(403).json({ error: 'Invalid token: panchayat role required' });
      return null;
    }
    return payload.userId;
  } catch {
    res.status(401).json({ error: 'Invalid or expired panchayat token' });
    return null;
  }
}

// ─── Panchayat Login & Profile ──────────────────────────────────────────────

app.get('/api/panchayat/me', async (req, res) => {
  const userId = await requirePanchayatAuth(req, res);
  if (!userId) return;
  try {
    const user = await neo4jService.getPanchayatUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (error: any) {
    console.error('Panchayat me error:', error);
    return res.status(500).json({ error: 'Failed to get user info', details: error.message });
  }
});

app.get('/api/panchayat/analytics', async (req, res) => {
  const userId = await requirePanchayatAuth(req, res);
  if (!userId) return;
  try {
    const panchayatUser = await neo4jService.getPanchayatUserById(userId);
    if (!panchayatUser) return res.status(404).json({ error: 'Panchayat user not found' });

    const [citizens, totalSchemes, enrichedSchemes] = await Promise.all([
      neo4jService.getUsersByPanchayatScoped(
        userId,
        panchayatUser.state,
        panchayatUser.district,
        panchayatUser.panchayatName
      ),
      neo4jService.getSchemeCount(),
      neo4jService.getEnrichedSchemeCount(),
    ]);

    const employmentCounts = new Map<string, number>();
    const genderCounts = new Map<string, number>();
    const registrationsByDate = new Map<string, number>();

    const today = new Date();
    const last7Days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      last7Days.push(d.toISOString().slice(0, 10));
    }

    citizens.forEach((citizen: any) => {
      const employment = String(citizen.employment || citizen.occupation || 'Unknown').trim();
      const gender = String(citizen.gender || 'Not specified').trim();
      const createdAt = String(citizen.created_at || citizen.createdAt || '');
      const createdDate = createdAt.slice(0, 10);

      employmentCounts.set(employment, (employmentCounts.get(employment) || 0) + 1);
      genderCounts.set(gender, (genderCounts.get(gender) || 0) + 1);
      if (createdDate) {
        registrationsByDate.set(createdDate, (registrationsByDate.get(createdDate) || 0) + 1);
      }
    });

    const totalCitizens = citizens.length;
    const onboardedCitizens = citizens.filter((citizen: any) => citizen.onboarding_complete).length;

    return res.json({
      summary: {
        totalCitizens,
        onboardedCitizens,
        pendingCitizens: totalCitizens - onboardedCitizens,
        totalSchemes,
        enrichedSchemes,
        enrichmentRate:
          totalSchemes > 0 ? Math.round((enrichedSchemes / totalSchemes) * 1000) / 10 : 0,
        state: panchayatUser.state,
        district: panchayatUser.district,
        panchayatName: panchayatUser.panchayatName,
      },
      trends: {
        registrations: last7Days.map((date) => ({
          date,
          count: registrationsByDate.get(date) || 0,
        })),
      },
      distribution: {
        byEmployment: Array.from(employmentCounts.entries())
          .map(([employment, count]) => ({ employment, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
        byGender: Array.from(genderCounts.entries())
          .map(([gender, count]) => ({ gender, count }))
          .sort((a, b) => b.count - a.count),
      },
    });
  } catch (error: any) {
    console.error('Panchayat analytics error:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

app.post('/api/panchayat/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const panchayatUser = await neo4jService.getPanchayatUserByEmail(
      String(email).trim().toLowerCase()
    );
    if (!panchayatUser) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await passwordService.verifyPassword(
      String(password),
      panchayatUser.passwordHash
    );
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Panchayat officers work full-day sessions — issue an 8-hour token.
    const token = jwtService.generateAccessToken(
      panchayatUser.userId,
      panchayatUser.email,
      'panchayat',
      {
        panchayatName: panchayatUser.panchayatName,
        district: panchayatUser.district,
        state: panchayatUser.state,
      },
      '8h'
    );

    return res.json({
      token,
      user: {
        userId: panchayatUser.userId,
        email: panchayatUser.email,
        name: panchayatUser.name,
        panchayatName: panchayatUser.panchayatName,
        district: panchayatUser.district,
        state: panchayatUser.state,
      },
    });
  } catch (error: any) {
    console.error('Panchayat login error:', error);
    return res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

// ─── Panchayat: Scoped Citizens ──────────────────────────────────────────────

app.get('/api/panchayat/stats', async (req, res) => {
  const userId = await requirePanchayatAuth(req, res);
  if (!userId) return;
  try {
    const panchayatUser = await neo4jService.getPanchayatUserById(userId);
    if (!panchayatUser) return res.status(404).json({ error: 'Panchayat user not found' });

    const citizens = await neo4jService.getUsersByPanchayatScoped(
      userId,
      panchayatUser.state,
      panchayatUser.district,
      panchayatUser.panchayatName
    );
    const total = citizens.length;
    const onboarded = citizens.filter((u: any) => u.onboarding_complete).length;

    const empMap = new Map<string, number>();
    const genderMap = new Map<string, number>();
    citizens.forEach((u: any) => {
      const emp = u.employment || 'Unknown';
      empMap.set(emp, (empMap.get(emp) || 0) + 1);
      const g = u.gender || 'Not specified';
      genderMap.set(g, (genderMap.get(g) || 0) + 1);
    });

    const recent = [...citizens]
      .sort((a: any, b: any) =>
        (b.created_at ?? b.createdAt ?? '').localeCompare(a.created_at ?? a.createdAt ?? '')
      )
      .slice(0, 10)
      .map((u: any) => ({
        userId: u.user_id ?? u.userId,
        name: u.name,
        email: u.email,
        state: u.state,
        district: u.district,
        employment: u.employment,
        gender: u.gender,
        onboardingComplete: Boolean(u.onboarding_complete ?? u.onboardingComplete),
        createdAt: u.created_at ?? u.createdAt,
      }));

    return res.json({
      total,
      onboarded,
      pending: total - onboarded,
      state: panchayatUser.state,
      district: panchayatUser.district,
      employmentBreakdown: Array.from(empMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      genderBreakdown: Array.from(genderMap.entries())
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count),
      recentRegistrations: recent,
    });
  } catch (error: any) {
    console.error('Panchayat stats error:', error);
    return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
  }
});

app.get('/api/panchayat/citizens', async (req, res) => {
  const userId = await requirePanchayatAuth(req, res);
  if (!userId) return;
  try {
    const panchayatUser = await neo4jService.getPanchayatUserById(userId);
    if (!panchayatUser) return res.status(404).json({ error: 'Panchayat user not found' });

    const q = String(req.query.q ?? '')
      .toLowerCase()
      .trim();
    const onboarding = String(req.query.onboarding ?? 'all').toLowerCase();
    const page = Math.max(1, Number(req.query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20) || 20));
    let citizens = await neo4jService.getUsersByPanchayatScoped(
      userId,
      panchayatUser.state,
      panchayatUser.district,
      panchayatUser.panchayatName
    );

    if (q) {
      citizens = citizens.filter((u: any) => {
        const name = (u.name ?? '').toLowerCase();
        const email = (u.email ?? '').toLowerCase();
        const district = (u.district ?? '').toLowerCase();
        const village = (u.village ?? '').toLowerCase();
        const panchayatName = (u.panchayat_name ?? u.panchayatName ?? '').toLowerCase();
        return (
          name.includes(q) ||
          email.includes(q) ||
          district.includes(q) ||
          village.includes(q) ||
          panchayatName.includes(q)
        );
      });
    }

    if (onboarding === 'complete') {
      citizens = citizens.filter((u: any) =>
        Boolean(u.onboarding_complete ?? u.onboardingComplete)
      );
    } else if (onboarding === 'pending') {
      citizens = citizens.filter(
        (u: any) => !Boolean(u.onboarding_complete ?? u.onboardingComplete)
      );
    }

    const total = citizens.length;
    const start = (page - 1) * limit;
    const items = citizens.slice(start, start + limit);

    return res.json({
      items,
      total,
      page,
      limit,
      hasMore: start + items.length < total,
    });
  } catch (error: any) {
    console.error('Panchayat citizens error:', error);
    return res.status(500).json({ error: 'Failed to fetch citizens', details: error.message });
  }
});

app.post('/api/panchayat/citizens', async (req, res) => {
  const userId = await requirePanchayatAuth(req, res);
  if (!userId) return;
  try {
    const panchayatUser = await neo4jService.getPanchayatUserById(userId);
    if (!panchayatUser) return res.status(404).json({ error: 'Panchayat user not found' });

    const { name, email, age, gender, employment, income, education } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const existing = await neo4jService.getUserByEmail(String(email).trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ error: 'A citizen with this email already exists' });
    }

    const citizenId = `citizen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    // Generate a temporary password — citizen can reset it via normal auth flow
    const tempPassword =
      Math.random().toString(36).slice(2, 10) +
      Math.random().toString(36).slice(2, 10).toUpperCase();

    await neo4jService.createUser({
      userId: citizenId,
      email: String(email).trim().toLowerCase(),
      password: tempPassword,
      name: String(name).trim(),
      age: age ? Number(age) : undefined,
      gender: gender || undefined,
      income: income || undefined,
      state: panchayatUser.state,
    });

    // Set extra profile fields and panchayat association.
    // Citizens registered by an operator still need to complete their own onboarding journey.
    await neo4jService.updateUserProfile(citizenId, {
      employment: employment || '',
      education: education || '',
      district: panchayatUser.district,
      panchayat_name: panchayatUser.panchayatName,
      registered_by_panchayat: userId,
      onboarding_complete: false,
    });

    return res.status(201).json({
      citizenId,
      message: 'Citizen registered successfully',
    });
  } catch (error: any) {
    console.error('Panchayat citizen registration error:', error);
    return res.status(500).json({ error: 'Failed to register citizen', details: error.message });
  }
});

// ─── Panchayat User Management (Admin only) ───────────────────────────────────

app.get('/api/admin/panchayats', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const users = await neo4jService.listPanchayatUsers();
    return res.json(users);
  } catch (error: any) {
    console.error('List panchayat users error:', error);
    return res
      .status(500)
      .json({ error: 'Failed to list panchayat users', details: error.message });
  }
});

app.post('/api/admin/panchayats', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const { email, password, name, panchayatName, district, state } = req.body || {};
    if (!email || !password || !name || !panchayatName || !district || !state) {
      return res.status(400).json({
        error: 'Missing required fields: email, password, name, panchayatName, district, state',
      });
    }
    if (typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const hash = await passwordService.hashPassword(String(password));
    const user = await neo4jService.createPanchayatUser({
      email: String(email).trim().toLowerCase(),
      passwordHash: hash,
      name: String(name).trim(),
      panchayatName: String(panchayatName).trim(),
      district: String(district).trim(),
      state: String(state).trim(),
    });

    return res.status(201).json(user);
  } catch (error: any) {
    const status = String(error?.message || '').includes('already exists') ? 409 : 500;
    console.error('Create panchayat user error:', error);
    return res.status(status).json({ error: error.message || 'Failed to create panchayat user' });
  }
});

app.delete('/api/admin/panchayats/:userId', async (req, res) => {
  if (!(await requireAdminAccess(req, res))) return;
  try {
    const { userId } = req.params;
    const deleted = await neo4jService.deletePanchayatUser(
      String(userId).replace(/[^a-zA-Z0-9_-]/g, '')
    );
    if (!deleted) {
      return res.status(404).json({ error: 'Panchayat user not found' });
    }
    return res.json({ success: true, message: 'Panchayat user deleted successfully' });
  } catch (error: any) {
    console.error('Delete panchayat user error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete panchayat user' });
  }
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;

/**
 * Main API Server
 * Sets up Express server with all routes and middleware
 * Users persisted in Neo4j; schemes served from Neo4j via SchemeSyncAgent
 * Chat is proxied to FastAPI ML service (port 8000)
 */

import express from 'express';
import cors from 'cors';
import { ProfileExtractor } from '../utils/profile-extractor';
import { neo4jService } from '../db/neo4j.service';
import { redisService } from '../db/redis.service';
import { getTranslationService } from '../services/translation.service';
import { schemeSyncAgent } from '../agents/scheme-sync-agent';
import { mlService } from '../services/ml.service';

const ADMIN_KEY = process.env.ADMIN_KEY || 'prahar-admin-secret';

const app = express();

// Initialize translation service with Redis caching
const ts = getTranslationService(redisService);

// Middleware
app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
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
    });
    console.log('✅ Admin user seeded');
  }

  // Admin should never be blocked by onboarding.
  const ensuredAdmin = await neo4jService.getUserByEmail('admin@example.com');
  if (ensuredAdmin && !ensuredAdmin.onboarding_complete) {
    await neo4jService.updateUserProfile(ensuredAdmin.user_id, {
      onboarding_complete: true,
    });
  }
}

// ─── Helper: profile completeness ─────────────────────────────────────────────
function calculateProfileCompleteness(user: any): number {
  const fields = [
    'name', 'email', 'age', 'income', 'state', 'employment', 'education', 'gender',
    'social_category', 'interests', 'marital_status', 'rural_urban', 'occupation',
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
      user: { userId, email, name: name || 'User' },
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
      user: { userId: user.user_id, email: user.email, name: user.name },
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
  try {
    const { message, conversationHistory = [] } = req.body;
    console.log('Chat message received:', message);

    // Get user info from token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId =
      token?.replace('mock_access_token_', '').replace('mock_refresh_token_', '') || 'admin123';
    const user = await neo4jService.getUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Extract profile data from message and update DB
    const extraction = ProfileExtractor.extract(message);
    const updates = extraction.updates;
    const updateMessages = extraction.messages;

    const dbUpdates: Record<string, any> = {};
    const appliedUpdates: string[] = [];

    if (updates.age !== undefined) {
      dbUpdates['age'] = updates.age;
      appliedUpdates.push(updateMessages.find((m) => m.includes('age')) || '');
    }
    if (updates.income !== undefined) {
      dbUpdates['income'] = updates.income;
      appliedUpdates.push(updateMessages.find((m) => m.includes('income')) || '');
    }
    if (updates.state !== undefined) {
      dbUpdates['state'] = updates.state;
      appliedUpdates.push(updateMessages.find((m) => m.includes('state')) || '');
    }
    if (updates.employment !== undefined) {
      dbUpdates['employment'] = updates.employment;
      appliedUpdates.push(updateMessages.find((m) => m.includes('employment')) || '');
    }
    if (updates.education !== undefined) {
      dbUpdates['education'] = updates.education;
      appliedUpdates.push(updateMessages.find((m) => m.includes('education')) || '');
    }
    if (updates.disability !== undefined) {
      dbUpdates['is_disabled'] = updates.disability;
    }
    if (updates.minority !== undefined) {
      dbUpdates['is_minority'] = updates.minority;
    }

    const profileUpdated = Object.keys(dbUpdates).length > 0;
    if (profileUpdated) {
      try {
        await neo4jService.updateUserProfile(userId, dbUpdates);
      } catch (e) {
        console.error('Profile update error', e);
      }
    }

    // Build enriched user profile from latest DB values.
    const freshUser = (await neo4jService.getUserById(userId)) || user;
    const userProfile = {
      userId: freshUser.user_id,
      email: freshUser.email,
      name: freshUser.name,
      age: freshUser.age,
      income: freshUser.income,
      state: freshUser.state,
      employment: freshUser.employment,
      education: freshUser.education,
      gender: freshUser.gender,
      interests: freshUser.interests,
      social_category: freshUser.social_category,
      is_disabled: freshUser.is_disabled,
      is_minority: freshUser.is_minority,
      marital_status: freshUser.marital_status,
      family_size: freshUser.family_size,
      rural_urban: freshUser.rural_urban,
      occupation: freshUser.occupation,
      poverty_status: freshUser.poverty_status,
      ration_card: freshUser.ration_card,
      land_ownership: freshUser.land_ownership,
      district: freshUser.district,
      disability_type: freshUser.disability_type,
      minority_community: freshUser.minority_community,
      ...dbUpdates,
    };

    // Use centralized ML wrapper for timeout + schema normalization.
    const chatResult = await mlService.chat(message, userProfile, conversationHistory);

    // Prepend profile update messages if any
    let responseText =
      chatResult?.response ||
      "I'm temporarily unable to access advanced recommendations, but I can still help with your profile and scheme search.";
    if (profileUpdated && appliedUpdates.length > 0) {
      const updatePrefix = appliedUpdates.filter(Boolean).join(' ');
      responseText = updatePrefix + '\n\n' + responseText;
    }

    return res.json({
      response: responseText,
      suggestions: chatResult?.suggestions || ['Show my profile', 'Find schemes for me'],
      degraded: !chatResult,
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
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
  try {
    const { message, conversationHistory = [] } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing required field: message' });
    }
    console.log(`\n🤖 ReAct Chat: "${message}"`);

    // Get user from token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId =
      token?.replace('mock_access_token_', '').replace('mock_refresh_token_', '') || 'admin123';
    const user = await neo4jService.getUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Extract profile updates from message
    const extraction = ProfileExtractor.extract(message);
    if (Object.keys(extraction.updates).length > 0) {
      try {
        await neo4jService.updateUserProfile(userId, extraction.updates);
        console.log('✅ Profile auto-updated from message');
      } catch (e) {
        console.debug('Profile update skipped');
      }
    }

    // Initialize tools if not already done
    const { initializeTools, reactAgent } = await import('../agents');
    initializeTools();

    // Process with ReAct agent
    const response = await reactAgent.process(message, userId, conversationHistory);

    return res.json({
      response: response.response,
      thinking: response.thinking.map((t) => ({
        type: t.type,
        content: t.content,
      })),
      toolsUsed: response.actionsUsed.map((a) => a.toolName),
      confidence: response.confidence,
    });
  } catch (error: any) {
    console.error('ReAct chat error:', error);
    return res.status(500).json({ error: 'Chat processing failed', details: error.message });
  }
});

// ─── Admin Sync Endpoints (protected with X-Admin-Key or admin login) ────────

async function requireAdminAccess(req: express.Request, res: express.Response): Promise<boolean> {
  const keyHeader = req.headers['x-admin-key'];
  const key = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;

  // Preferred for server-to-server callers.
  if (key && key === ADMIN_KEY) {
    return true;
  }

  // Also allow authenticated in-app admin user.
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const userId = token
    .replace('mock_access_token_', '')
    .replace('mock_refresh_token_', '')
    .trim();

  if (userId) {
    const user = await neo4jService.getUserById(userId);
    if (user && (user.user_id === 'admin123' || user.email === 'admin@example.com')) {
      return true;
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

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;

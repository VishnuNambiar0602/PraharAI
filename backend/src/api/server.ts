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

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

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
}

// ─── Helper: profile completeness ─────────────────────────────────────────────
function calculateProfileCompleteness(user: any): number {
  const fields = ['name', 'email', 'age', 'income', 'state', 'employment', 'education', 'gender'];
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
    age: user.age ?? null,
    income: user.income ?? null,
    state: user.state ?? null,
    employment: user.employment ?? null,
    education: user.education ?? null,
    gender: user.gender ?? null,
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
    age: 'age',
    income: 'income',
    state: 'state',
    employment: 'employment',
    education: 'education',
    gender: 'gender',
    interests: 'interests',
    onboardingComplete: 'onboarding_complete',
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
    age: updated.age ?? null,
    income: updated.income ?? null,
    state: updated.state ?? null,
    employment: updated.employment ?? null,
    education: updated.education ?? null,
    gender: updated.gender ?? null,
    onboardingComplete: !!updated.onboarding_complete,
    completeness: calculateProfileCompleteness(updated),
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

    // Build enriched user profile
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
      ...dbUpdates,
    };

    // Proxy to FastAPI chat endpoint
    const mlResponse = await fetch(`${ML_SERVICE_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        user_profile: userProfile,
        conversation_history: conversationHistory,
      }),
    });

    if (!mlResponse.ok) {
      throw new Error(`ML service returned ${mlResponse.status}`);
    }

    const chatResult = (await mlResponse.json()) as any;

    // Prepend profile update messages if any
    let responseText = chatResult.response || '';
    if (profileUpdated && appliedUpdates.length > 0) {
      const updatePrefix = appliedUpdates.filter(Boolean).join(' ');
      responseText = updatePrefix + '\n\n' + responseText;
    }

    return res.json({
      response: responseText,
      suggestions: chatResult.suggestions || [],
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Health check with cache stats
app.get('/health', (_req, res) => {
  const cacheStats = redisService.getStats();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cache: cacheStats,
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

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;

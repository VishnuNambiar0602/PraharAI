/**
 * Main API Server
 * Sets up Express server with all routes and middleware
 * Users persisted in SQLite; schemes served from SQLite via SchemeSyncAgent
 */

import express from 'express';
import cors from 'cors';
import { ProfileExtractor } from '../utils/profile-extractor';
import { sqliteService } from '../db/sqlite.service';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ─── Seed admin user (called after sqliteService.init()) ──────────────────────
export function seedAdminUser() {
  const admin = sqliteService.getUserByEmail('admin@example.com');
  if (!admin) {
    sqliteService.createUser({
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
  const filledFields = fields.filter(field => user[field] != null && user[field] !== '');
  return Math.round((filledFields.length / fields.length) * 100);
}

// Mock authentication routes
app.post('/api/auth/register', (req, res) => {
  try {
    console.log('=== REGISTRATION REQUEST ===');
    console.log('Body:', JSON.stringify(req.body, null, 2));

    const { email, password, name, age, income, state, gender } = req.body;
    console.log('Registration attempt:', { email, name });

    // Check if user already exists
    const existingUser = sqliteService.getUserByEmail(email);
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(409).json({ error: 'User already exists' });
    }

    const userId = `user_${Date.now()}`;
    sqliteService.createUser({
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

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('Login attempt:', { email });

    const user = sqliteService.getUserByEmail(email);
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

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Mock profile endpoints for testing (without database)
app.get('/api/users/:userId/profile', (req, res) => {
  const user = sqliteService.getUserById(req.params.userId);
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

app.put('/api/users/:userId/profile', (req, res) => {
  const user = sqliteService.getUserById(req.params.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Map camelCase keys to snake_case columns
  const mappedFields: Record<string, any> = {};
  const fieldMap: Record<string, string> = {
    name: 'name', age: 'age', income: 'income', state: 'state',
    employment: 'employment', education: 'education', gender: 'gender',
    interests: 'interests', onboardingComplete: 'onboarding_complete',
  };
  for (const [k, col] of Object.entries(fieldMap)) {
    if (req.body[k] !== undefined) mappedFields[col] = req.body[k];
  }
  sqliteService.updateUserProfile(req.params.userId, mappedFields);

  const updated = sqliteService.getUserById(req.params.userId)!;
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

app.get('/api/schemes/stats', (_req, res) => {
  try {
    const meta = sqliteService.getSyncMeta();
    res.json({
      totalSchemes: meta.total_schemes,
      lastSync: meta.last_sync,
    });
  } catch {
    res.json({ totalSchemes: 0, lastSync: null });
  }
});

app.get('/api/schemes', (req, res) => schemesController.getSchemes(req, res));
app.get('/api/schemes/categories', (req, res) => schemesController.getCategories(req, res));
app.get('/api/schemes/:schemeId', (req, res) => schemesController.getSchemeById(req, res));
app.get('/api/users/:userId/recommendations', (req, res) => schemesController.getRecommendations(req, res));

// Mock nudges endpoint
app.get('/api/users/:userId/nudges', (req, res) => {
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

// Chat endpoint using intelligent agent system
import { chatController } from '../chat';

app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;
    console.log('Chat message received:', message);
    console.log('Conversation history items:', conversationHistory.length);

    // Get user info from token (mock)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = token?.split('_').pop() || 'admin123';
    const user = sqliteService.getUserById(userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Use intelligent profile extractor
    console.log(`\n📊 Extracting profile data from message: "${message}"`);
    const extraction = ProfileExtractor.extract(message);
    const updates = extraction.updates;
    const updateMessages = extraction.messages;

    // Also extract from conversation history for context
    console.log(`📁 Extracting context from ${conversationHistory.length} previous messages...`);
    const historyContext = ProfileExtractor.extractFromHistory(conversationHistory);
    console.log('Context extracted from history:', historyContext);

    // Collect DB updates
    const dbUpdates: Record<string, any> = {};
    const appliedUpdates: string[] = [];

    if (updates.age !== undefined) { dbUpdates['age'] = updates.age; appliedUpdates.push(updateMessages[updateMessages.findIndex(m => m.includes('age'))] || ''); }
    if (updates.income !== undefined) { dbUpdates['income'] = updates.income; appliedUpdates.push(updateMessages[updateMessages.findIndex(m => m.includes('income'))] || ''); }
    if (updates.state !== undefined) { dbUpdates['state'] = updates.state; appliedUpdates.push(updateMessages[updateMessages.findIndex(m => m.includes('state'))] || ''); }
    if (updates.employment !== undefined) { dbUpdates['employment'] = updates.employment; appliedUpdates.push(updateMessages[updateMessages.findIndex(m => m.includes('employment'))] || ''); }
    if (updates.education !== undefined) { dbUpdates['education'] = updates.education; appliedUpdates.push(updateMessages[updateMessages.findIndex(m => m.includes('education'))] || ''); }
    if (updates.disability !== undefined) { dbUpdates['is_disabled'] = updates.disability; }
    if (updates.minority !== undefined) { dbUpdates['is_minority'] = updates.minority; }

    const profileUpdated = Object.keys(dbUpdates).length > 0;
    if (profileUpdated) {
      try { sqliteService.updateUserProfile(userId, dbUpdates); } catch (e) { console.error('Profile update error', e); }
    }

    console.log(`✅ Profile updated: ${profileUpdated}, Updates applied:`, appliedUpdates.filter(Boolean));

    // Build enriched user object for chat context
    const freshUser = sqliteService.getUserById(userId) || user;
    const userForChat = {
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

    // Attach user profile and conversation history to request for chat service
    (req as any).userId = userId;
    (req as any).userProfile = userForChat;
    (req as any).conversationHistory = conversationHistory;
    (req as any).extractedContext = historyContext;

    // If profile was updated, prepend the update messages to the response
    if (profileUpdated && appliedUpdates.length > 0) {
      const originalSend = res.json.bind(res);
      res.json = function(data: any) {
        if (data.response) {
          const updatePrefix = appliedUpdates.filter(Boolean).join(' ');
          data.response = updatePrefix + '\n\n' + data.response;
        }
        return originalSend(data);
      };
    }

    // Use chat controller
    await chatController.sendMessage(req, res);
  } catch (error: any) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to see all users
app.get('/api/debug/users', (req, res) => {
  const users = sqliteService.getAllUsers();
  res.json({
    users: users.map((u: any) => ({ userId: u.user_id, email: u.email, name: u.name })),
    count: users.length
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;

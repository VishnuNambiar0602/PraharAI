/**
 * Main API Server
 * Sets up Express server with all routes and middleware
 * MOCK VERSION - No database required for testing
 */

import express from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// In-memory user storage for testing (without database)
const users: any[] = [
  {
    userId: 'admin123',
    email: 'admin@example.com',
    password: 'password', // In production, this would be hashed
    name: 'Admin User',
    role: 'admin',
  },
];

// Mock authentication routes
app.post('/api/auth/register', (req, res) => {
  try {
    console.log('=== REGISTRATION REQUEST ===');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));
    
    const { email, password, name, age, income, state } = req.body;

    console.log('Registration attempt:', { email, name });

    // Check if user already exists
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      console.log('User already exists:', email);
      return res.status(409).json({ error: 'User already exists' });
    }

    // Create new user
    const newUser = {
      userId: `user_${Date.now()}`,
      email,
      password, // In production, hash this
      name: name || 'User',
      age: age || null,
      income: income || null,
      state: state || null,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    console.log('User registered successfully:', newUser.userId);

    // Generate mock tokens
    const accessToken = `mock_access_token_${newUser.userId}`;
    const refreshToken = `mock_refresh_token_${newUser.userId}`;

    const response = {
      user: {
        userId: newUser.userId,
        email: newUser.email,
        name: newUser.name,
      },
      accessToken,
      refreshToken,
    };
    
    console.log('Sending response:', response);
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('Login attempt:', { email });

    // Find user
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Login successful:', user.userId);

    // Generate mock tokens
    const accessToken = `mock_access_token_${user.userId}`;
    const refreshToken = `mock_refresh_token_${user.userId}`;

    res.json({
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed', details: error.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// Mock profile endpoints for testing (without database)
app.get('/api/users/:userId/profile', (req, res) => {
  const user = users.find(u => u.userId === req.params.userId || u.userId === 'admin123');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    userId: user.userId,
    name: user.name,
    email: user.email,
    age: user.age || null,
    income: user.income || null,
    state: user.state || null,
    employment: user.employment || null,
    education: user.education || null,
    completeness: calculateProfileCompleteness(user),
  });
});

app.put('/api/users/:userId/profile', (req, res) => {
  const userIndex = users.findIndex(u => u.userId === req.params.userId || u.userId === 'admin123');
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update user with new data
  users[userIndex] = { ...users[userIndex], ...req.body };

  res.json({
    userId: users[userIndex].userId,
    name: users[userIndex].name,
    email: users[userIndex].email,
    age: users[userIndex].age,
    income: users[userIndex].income,
    state: users[userIndex].state,
    employment: users[userIndex].employment,
    education: users[userIndex].education,
    completeness: calculateProfileCompleteness(users[userIndex]),
  });
});

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user: any): number {
  const fields = ['name', 'email', 'age', 'income', 'state', 'employment', 'education'];
  const filledFields = fields.filter(field => user[field] != null && user[field] !== '');
  return Math.round((filledFields.length / fields.length) * 100);
}

// Real schemes endpoints using India.gov.in API
import { schemesController } from '../schemes/schemes.controller';

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
    const { message } = req.body;
    console.log('Chat message received:', message);

    // Get user info from token (mock)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const userId = token?.split('_').pop() || 'admin123';
    const user = users.find(u => u.userId === userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Handle profile updates in the message
    const lowerMessage = message.toLowerCase();
    let profileUpdated = false;
    let updateMessage = '';

    // Update age
    if (lowerMessage.match(/(?:my age is|age is|update.*age|set.*age).*?(\d+)/)) {
      const ageMatch = lowerMessage.match(/(\d+)/);
      if (ageMatch) {
        user.age = parseInt(ageMatch[1]);
        profileUpdated = true;
        updateMessage = `✅ Updated your age to ${user.age} years. `;
      }
    }
    // Update income
    else if (lowerMessage.match(/(?:my income is|income is|update.*income|set.*income|earn)/)) {
      const incomeMatch = lowerMessage.match(/(\d+)/);
      if (incomeMatch) {
        user.income = parseInt(incomeMatch[1]);
        profileUpdated = true;
        updateMessage = `✅ Updated your income to ₹${user.income}. `;
      } else if (lowerMessage.includes('below') || lowerMessage.includes('bpl')) {
        user.income = 50000;
        profileUpdated = true;
        updateMessage = `✅ Noted that your income is below poverty line. `;
      }
    }
    // Update state
    else if (lowerMessage.match(/(?:my state is|state is|update.*state|set.*state|from|live in)/)) {
      const states = ['maharashtra', 'delhi', 'karnataka', 'tamil nadu', 'gujarat', 'rajasthan', 'uttar pradesh', 'west bengal', 'punjab', 'haryana', 'kerala', 'andhra pradesh'];
      const foundState = states.find(s => lowerMessage.includes(s));
      if (foundState) {
        user.state = foundState.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        profileUpdated = true;
        updateMessage = `✅ Updated your state to ${user.state}. `;
      }
    }
    // Update employment
    else if (lowerMessage.match(/(?:i am|i'm|update.*employment|set.*employment).*(employed|unemployed|student|self-employed|self employed|retired)/)) {
      const employmentMatch = lowerMessage.match(/(employed|unemployed|student|self-employed|self employed|retired)/);
      if (employmentMatch) {
        user.employment = employmentMatch[1].replace('self employed', 'self-employed');
        profileUpdated = true;
        updateMessage = `✅ Updated your employment status to ${user.employment}. `;
      }
    }
    // Update education
    else if (lowerMessage.match(/(?:my education is|education is|update.*education|set.*education|studied)/)) {
      const educationLevels = ['primary', 'secondary', 'graduate', 'post graduate', 'postgraduate', 'professional'];
      const foundEducation = educationLevels.find(e => lowerMessage.includes(e));
      if (foundEducation) {
        user.education = foundEducation;
        profileUpdated = true;
        updateMessage = `✅ Updated your education to ${foundEducation}. `;
      }
    }

    // Attach user profile to request for chat service
    (req as any).userId = userId;
    (req as any).userProfile = user;

    // If profile was updated, prepend the update message to the response
    if (profileUpdated) {
      const originalSend = res.json.bind(res);
      res.json = function(data: any) {
        if (data.response) {
          data.response = updateMessage + data.response;
        }
        return originalSend(data);
      };
    }

    // Use chat controller
    await chatController.sendMessage(req, res);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message', details: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint to see all users
app.get('/api/debug/users', (req, res) => {
  res.json({ 
    users: users.map(u => ({ 
      userId: u.userId, 
      email: u.email, 
      name: u.name 
    })),
    count: users.length
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

export default app;

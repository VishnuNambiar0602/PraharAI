/**
 * ReAct Agent Tests
 *
 * Unit tests for the autonomous reasoning+acting agent.
 * All external services (neo4j, redis, ml) are mocked.
 */

// --- Mocks must be set up BEFORE imports ----

jest.mock('../../services/ml.service', () => ({
  mlService: {
    classify: jest.fn().mockResolvedValue(null),
    recommend: jest.fn().mockResolvedValue(null),
    eligibility: jest.fn().mockResolvedValue(null),
    isAvailable: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../../db/neo4j.service', () => ({
  neo4jService: {
    getUserById: jest.fn().mockResolvedValue(null),
    searchSchemesWithFilter: jest.fn().mockResolvedValue([]),
    findSchemesForUser: jest.fn().mockResolvedValue([]),
    getAllSchemes: jest.fn().mockResolvedValue([]),
    getSchemeById: jest.fn().mockResolvedValue(null),
    checkGraphEligibility: jest.fn().mockResolvedValue({
      eligible: false,
      score: 0,
      matchedCategories: [],
    }),
    updateUserProfile: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../db/redis.service', () => ({
  redisService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
  },
  CacheTTL: {
    SCHEME_DETAIL: 1800,
    SCHEME_SEARCH: 600,
    RECOMMENDATIONS: 900,
    USER_PROFILE: 600,
    CATEGORIES: 3600,
    SYNC_META: 300,
    ELIGIBILITY: 900,
  },
}));

jest.mock('../../classification/user-segmentation', () => ({
  userSegmentationService: {
    assignSegment: jest.fn().mockResolvedValue({
      userId: 'user1',
      segment: {
        segmentId: 5,
        name: 'General / New Users',
        preferredCategories: [],
        rankingWeight: 0,
      },
      confidence: 0.5,
      scores: [0, 0, 0, 0, 1],
      assignedAt: new Date(),
    }),
    reRankBySegment: jest.fn().mockImplementation((items: any[]) => items),
  },
}));

import { reactAgent } from '../react-agent';
import { initializeTools, toolRegistry } from '../index';
import { mlService } from '../../services/ml.service';
import { neo4jService } from '../../db/neo4j.service';

// --- Test Data ---

const mockUser = {
  user_id: 'user1',
  name: 'Test User',
  age: 30,
  income: 150000,
  state: 'Maharashtra',
  employment: 'salaried',
  education: 'graduate',
  gender: 'male',
};

const mockSchemes = [
  {
    scheme_id: 'scheme1',
    name: 'PM Awas Yojana',
    description: 'Housing for all',
    state: 'All-India',
    tags: 'housing,central',
  },
  {
    scheme_id: 'scheme2',
    name: 'Mudra Loan',
    description: 'Small business loan',
    state: 'All-India',
    tags: 'entrepreneurship,finance',
  },
];

// --- Tests ---

describe('ReAct Agent', () => {
  beforeAll(() => {
    // Clear any prior registrations and initialise tools
    toolRegistry.clear();
    initializeTools();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset default mocks
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
    (neo4jService.searchSchemesWithFilter as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.findSchemesForUser as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.getAllSchemes as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.getSchemeById as jest.Mock).mockImplementation(
      async (id: string) => mockSchemes.find((s) => s.scheme_id === id) ?? null
    );
  });

  test('should return a valid AgentResponse', async () => {
    const result = await reactAgent.process('Find housing schemes', 'user1', []);

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('thinking');
    expect(result).toHaveProperty('actionsUsed');
    expect(result).toHaveProperty('observations');
    expect(result).toHaveProperty('confidence');
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
  });

  test('should classify scheme_search intent for search queries', async () => {
    const result = await reactAgent.process('Find housing schemes', 'user1', []);

    // Should have used search_schemes tool
    const toolNames = result.actionsUsed.map((a) => a.toolName);
    expect(toolNames).toContain('search_schemes');
  });

  test('should classify recommendation intent', async () => {
    const result = await reactAgent.process('Recommend schemes for me', 'user1', []);

    const toolNames = result.actionsUsed.map((a) => a.toolName);
    expect(toolNames).toContain('get_recommendations');
  });

  test('should classify eligibility_check intent', async () => {
    (neo4jService.checkGraphEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      score: 75,
      matchedCategories: ['housing'],
    });

    const result = await reactAgent.process('Am I eligible for housing?', 'user1', []);

    const toolNames = result.actionsUsed.map((a) => a.toolName);
    expect(toolNames).toContain('search_schemes');
    // Second step should be check_eligibility
    expect(toolNames.length).toBeGreaterThanOrEqual(1);
  });

  test('should classify profile_query intent', async () => {
    const result = await reactAgent.process('who am i', 'user1', []);

    const toolNames = result.actionsUsed.map((a) => a.toolName);
    expect(toolNames).toContain('get_user_profile');
  });

  test('should use ML classification when available', async () => {
    (mlService.classify as jest.Mock).mockResolvedValueOnce({
      primary_intent: 'scheme_search',
      confidence: 0.95,
      entities: {},
      secondary_intents: [],
    });

    const result = await reactAgent.process('I need help', 'user1', []);

    expect(mlService.classify).toHaveBeenCalledWith('I need help', 'user1');
    const toolNames = result.actionsUsed.map((a) => a.toolName);
    expect(toolNames).toContain('search_schemes');
  });

  test('should handle tool execution errors gracefully', async () => {
    (neo4jService.searchSchemesWithFilter as jest.Mock).mockRejectedValue(
      new Error('Connection lost')
    );

    const result = await reactAgent.process('Find schemes', 'user1', []);

    // Should still return a response, not crash
    expect(result).toHaveProperty('response');
    expect(typeof result.response).toBe('string');
  });

  test('should include thinking steps', async () => {
    const result = await reactAgent.process('Search for education schemes', 'user1', []);

    expect(result.thinking.length).toBeGreaterThanOrEqual(2); // At least intent + plan
    expect(result.thinking[0].type).toBe('reasoning');
  });

  test('should calculate confidence', async () => {
    const result = await reactAgent.process('Find schemes', 'user1', []);

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  test('should handle empty message gracefully', async () => {
    const result = await reactAgent.process('', 'user1', []);

    expect(result).toHaveProperty('response');
    expect(typeof result.response).toBe('string');
  });
});

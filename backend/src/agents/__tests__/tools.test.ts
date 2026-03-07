/**
 * Tools Integration Tests
 *
 * Tests for all tool implementations:
 *  - SearchSchemesTool
 *  - GetSchemeDetailsTool
 *  - GetSchemesByCategoryTool
 *  - CheckEligibilityTool
 *  - UpdateUserProfileTool
 *  - GetUserProfileTool
 *  - GetRecommendationsTool
 *  - FindBestSchemesTool
 *  - AnalyzeEligibilityTool
 *
 * All external services (neo4j, redis, ml, segmentation) are mocked.
 */

// --- Mocks ---

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
    getUserById: jest.fn(),
    searchSchemesWithFilter: jest.fn(),
    findSchemesForUser: jest.fn(),
    getAllSchemes: jest.fn(),
    getSchemeById: jest.fn(),
    checkGraphEligibility: jest.fn(),
    updateUserProfile: jest.fn(),
    findSchemesByCategories: jest.fn(),
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

import {
  SearchSchemesTool,
  GetSchemeDetailsTool,
  GetSchemesByCategoryTool,
  CheckEligibilityTool,
  UpdateUserProfileTool,
  GetUserProfileTool,
  GetRecommendationsTool,
  FindBestSchemesTool,
  AnalyzeEligibilityTool,
} from '../tools';
import { neo4jService } from '../../db/neo4j.service';
import { mlService } from '../../services/ml.service';

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

describe('SearchSchemesTool', () => {
  const tool = new SearchSchemesTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.searchSchemesWithFilter as jest.Mock).mockResolvedValue(mockSchemes);
  });

  test('should search schemes with query', async () => {
    const result = await tool.execute({ query: 'housing' });
    expect(result.success).toBe(true);
    expect(neo4jService.searchSchemesWithFilter).toHaveBeenCalled();
  });

  test('should fail without query', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Required parameter missing');
  });
});

describe('GetSchemeDetailsTool', () => {
  const tool = new GetSchemeDetailsTool();

  const detailScheme = {
    ...mockSchemes[0],
    tags: '["housing","central"]',
    categories_json: '[{"type":"Employment","value":"Any"}]',
    ministry: 'Housing Ministry',
    scheme_url: 'https://example.gov.in',
    last_updated: '2024-01-01',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getSchemeById as jest.Mock).mockResolvedValue(detailScheme);
  });

  test('should get scheme details by ID', async () => {
    const result = await tool.execute({ schemeId: 'scheme1' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(neo4jService.getSchemeById).toHaveBeenCalledWith('scheme1');
  });

  test('should fail without schemeId', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
  });

  test('should handle scheme not found', async () => {
    (neo4jService.getSchemeById as jest.Mock).mockResolvedValue(null);
    const result = await tool.execute({ schemeId: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

describe('GetSchemesByCategoryTool', () => {
  const tool = new GetSchemesByCategoryTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.findSchemesByCategories as jest.Mock).mockResolvedValue(mockSchemes);
  });

  test('should get schemes by category and value', async () => {
    const result = await tool.execute({ category: 'Employment', value: 'Farmer' });
    expect(result.success).toBe(true);
    expect(neo4jService.findSchemesByCategories).toHaveBeenCalled();
  });

  test('should fail without category', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
  });
});

describe('CheckEligibilityTool', () => {
  const tool = new CheckEligibilityTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
    (neo4jService.getSchemeById as jest.Mock).mockResolvedValue(mockSchemes[0]);
    (neo4jService.checkGraphEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      score: 80,
      matchedCategories: ['housing'],
    });
  });

  test('should check eligibility with userId and schemeId', async () => {
    const result = await tool.execute({ userId: 'user1', schemeId: 'scheme1' });
    expect(result.success).toBe(true);
  });

  test('should fail without required parameters', async () => {
    const result = await tool.execute({});
    expect(result.success).toBe(false);
  });
});

describe('UpdateUserProfileTool', () => {
  const tool = new UpdateUserProfileTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.updateUserProfile as jest.Mock).mockResolvedValue(undefined);
  });

  test('should update user profile', async () => {
    const result = await tool.execute({
      userId: 'user1',
      updates: { age: 31, income: 200000 },
    });
    expect(result.success).toBe(true);
    expect(neo4jService.updateUserProfile).toHaveBeenCalled();
  });

  test('should fail without userId', async () => {
    const result = await tool.execute({ updates: { age: 31 } });
    expect(result.success).toBe(false);
  });
});

describe('GetUserProfileTool', () => {
  const tool = new GetUserProfileTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
  });

  test('should get user profile', async () => {
    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(neo4jService.getUserById).toHaveBeenCalledWith('user1');
  });

  test('should handle user not found', async () => {
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(null);
    const result = await tool.execute({ userId: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

describe('GetRecommendationsTool', () => {
  const tool = new GetRecommendationsTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
    (neo4jService.findSchemesForUser as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.getAllSchemes as jest.Mock).mockResolvedValue(mockSchemes);
  });

  test('should generate recommendations for a user', async () => {
    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data.recommendations).toBeDefined();
    expect(result.data.recommendations.length).toBeGreaterThan(0);
  });

  test('should return cached recommendations when available', async () => {
    const { redisService } = require('../../db/redis.service');
    (redisService.get as jest.Mock).mockResolvedValueOnce({
      userId: 'user1',
      count: 2,
      recommendations: mockSchemes,
      source: 'graph',
    });

    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data.cached).toBe(true);
  });

  test('should fail for non-existent user', async () => {
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(null);
    const result = await tool.execute({ userId: 'nonexistent' });
    expect(result.success).toBe(false);
  });

  test('should use ML ranking when ML service responds', async () => {
    (mlService.recommend as jest.Mock).mockResolvedValueOnce({
      recommendations: [{ id: 'scheme1', name: 'PM Awas Yojana', relevanceScore: 0.95 }],
      total: 1,
      cached: false,
    });

    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data.source).toBe('ml');
  });
});

describe('FindBestSchemesTool', () => {
  const tool = new FindBestSchemesTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
    (neo4jService.findSchemesForUser as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.searchSchemesWithFilter as jest.Mock).mockResolvedValue([]);
    (neo4jService.checkGraphEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      score: 80,
      matchedCategories: ['housing'],
    });
  });

  test('should find best schemes for a user', async () => {
    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data.schemes).toBeDefined();
  });

  test('should fail for non-existent user', async () => {
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(null);
    const result = await tool.execute({ userId: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

describe('AnalyzeEligibilityTool', () => {
  const tool = new AnalyzeEligibilityTool();

  beforeEach(() => {
    jest.clearAllMocks();
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(mockUser);
    (neo4jService.findSchemesForUser as jest.Mock).mockResolvedValue(mockSchemes);
    (neo4jService.getSchemeById as jest.Mock).mockImplementation(
      async (id: string) => mockSchemes.find((s) => s.scheme_id === id) ?? null
    );
    (neo4jService.checkGraphEligibility as jest.Mock).mockResolvedValue({
      eligible: true,
      score: 75,
      matchedCategories: ['housing'],
    });
  });

  test('should analyze eligibility across top matching schemes', async () => {
    const result = await tool.execute({ userId: 'user1' });
    expect(result.success).toBe(true);
    expect(result.data.results).toBeDefined();
    expect(result.data.schemesChecked).toBeGreaterThanOrEqual(0);
  });

  test('should analyze eligibility for specific schemes', async () => {
    const result = await tool.execute({
      userId: 'user1',
      schemeIds: ['scheme1'],
    });
    expect(result.success).toBe(true);
  });

  test('should fail for non-existent user', async () => {
    (neo4jService.getUserById as jest.Mock).mockResolvedValue(null);
    const result = await tool.execute({ userId: 'nonexistent' });
    expect(result.success).toBe(false);
  });
});

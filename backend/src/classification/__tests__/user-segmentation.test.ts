/**
 * User Segmentation Tests
 *
 * Tests for rule-based user segmentation and re-ranking.
 */

jest.mock('../../db/neo4j.service', () => ({
  neo4jService: {
    getUserById: jest.fn(),
    searchSchemesWithFilter: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../db/redis.service', () => ({
  redisService: {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  },
  CacheTTL: { USER_PROFILE: 600 },
}));

jest.mock('../../services/ml.service', () => ({
  mlService: {
    isAvailable: jest.fn().mockResolvedValue(false),
    classify: jest.fn().mockResolvedValue(null),
  },
}));

import { userSegmentationService, SEGMENTS } from '../user-segmentation';
import { neo4jService } from '../../db/neo4j.service';

describe('User Segmentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('SEGMENTS constant', () => {
    test('should define exactly 5 segments', () => {
      expect(SEGMENTS).toHaveLength(5);
    });

    test('each segment should have required fields', () => {
      for (const seg of SEGMENTS) {
        expect(seg).toHaveProperty('segmentId');
        expect(seg).toHaveProperty('name');
        expect(seg).toHaveProperty('description');
        expect(seg).toHaveProperty('preferredCategories');
        expect(seg).toHaveProperty('rankingWeight');
      }
    });
  });

  describe('assignSegment', () => {
    test('should assign Young Professional segment for salaried 30-year-old', async () => {
      (neo4jService.getUserById as jest.Mock).mockResolvedValue({
        user_id: 'u1',
        age: 30,
        income: 500000,
        employment: 'salaried',
        education: 'graduate',
        state: 'Maharashtra',
        gender: 'male',
      });

      const result = await userSegmentationService.assignSegment('u1');
      expect(result.segment.segmentId).toBe(1);
      expect(result.segment.name).toBe('Young Professionals');
    });

    test('should assign Farmer segment for farmer profile', async () => {
      (neo4jService.getUserById as jest.Mock).mockResolvedValue({
        user_id: 'u2',
        age: 45,
        income: 100000,
        employment: 'farmer',
        education: 'school',
        state: 'Rajasthan',
        rural_urban: 'rural',
        gender: 'male',
      });

      const result = await userSegmentationService.assignSegment('u2');
      expect(result.segment.segmentId).toBe(2);
      expect(result.segment.name).toBe('Farmers & Rural');
    });

    test('should assign Student segment for young student', async () => {
      (neo4jService.getUserById as jest.Mock).mockResolvedValue({
        user_id: 'u3',
        age: 20,
        income: 0,
        employment: 'student',
        education: 'undergraduate',
        state: 'Delhi',
        gender: 'female',
      });

      const result = await userSegmentationService.assignSegment('u3');
      expect(result.segment.segmentId).toBe(3);
      expect(result.segment.name).toBe('Students & Education Seekers');
    });

    test('should assign Social Benefit segment for disabled user', async () => {
      (neo4jService.getUserById as jest.Mock).mockResolvedValue({
        user_id: 'u4',
        age: 50,
        income: 50000,
        employment: 'unemployed',
        education: 'school',
        state: 'Bihar',
        disability: true,
        caste: 'SC',
        gender: 'male',
      });

      const result = await userSegmentationService.assignSegment('u4');
      expect(result.segment.segmentId).toBe(4);
      expect(result.segment.name).toBe('Social Benefit Seekers');
    });

    test('should assign General segment for unknown user', async () => {
      (neo4jService.getUserById as jest.Mock).mockResolvedValue(null);

      const result = await userSegmentationService.assignSegment('unknown');
      expect(result.segment.segmentId).toBe(5);
      expect(result.segment.name).toBe('General / New Users');
    });

    test('should return cached result when available', async () => {
      const { redisService } = require('../../db/redis.service');
      const cached = {
        userId: 'u1',
        segment: SEGMENTS[0],
        confidence: 0.9,
        scores: [1, 0, 0, 0, 0],
        assignedAt: new Date(),
      };
      (redisService.get as jest.Mock).mockResolvedValueOnce(cached);

      const result = await userSegmentationService.assignSegment('u1');
      expect(result).toEqual(cached);
      expect(neo4jService.getUserById).not.toHaveBeenCalled();
    });
  });

  describe('reRankBySegment', () => {
    test('should boost matching category schemes', () => {
      const items = [
        { relevanceScore: 50, tags: ['education'], schemeId: 's1' },
        { relevanceScore: 80, tags: ['housing'], schemeId: 's2' },
        { relevanceScore: 60, tags: ['scholarship'], schemeId: 's3' },
      ];

      const reRanked = userSegmentationService.reRankBySegment(items, SEGMENTS[2]); // Students

      // Education and scholarship should be boosted
      expect(reRanked[0].schemeId).toBe('s3'); // scholarship boosted from 60
      expect(reRanked[0].relevanceScore).toBeGreaterThan(60);
    });

    test('should not change order for General segment', () => {
      const items = [
        { relevanceScore: 90, tags: ['housing'] },
        { relevanceScore: 80, tags: ['education'] },
        { relevanceScore: 70, tags: ['agriculture'] },
      ];

      const reRanked = userSegmentationService.reRankBySegment(items, SEGMENTS[4]); // General
      expect(reRanked[0].relevanceScore).toBe(90);
      expect(reRanked[1].relevanceScore).toBe(80);
      expect(reRanked[2].relevanceScore).toBe(70);
    });

    test('should handle items without tags', () => {
      const items = [{ relevanceScore: 50 }, { relevanceScore: 80 }];

      const reRanked = userSegmentationService.reRankBySegment(items, SEGMENTS[0]);
      expect(reRanked).toHaveLength(2);
    });
  });

  describe('getSegment', () => {
    test('should return correct segment by ID', () => {
      const seg = userSegmentationService.getSegment(2);
      expect(seg.name).toBe('Farmers & Rural');
    });

    test('should return General for invalid ID', () => {
      const seg = userSegmentationService.getSegment(99);
      expect(seg.segmentId).toBe(5);
    });
  });
});

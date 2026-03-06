/**
 * Recommendation Tools
 *
 * Tools for generating cached personalized scheme recommendations:
 * - get_recommendations: ML-ranked recommendations for a user
 */

import { BaseTool } from './base';
import { ParameterDefinition } from './types';
import { neo4jService } from '../../db/neo4j.service';
import { mlService } from '../../services/ml.service';
import { redisService, CacheTTL } from '../../db/redis.service';
import { userSegmentationService } from '../../classification/user-segmentation';

/**
 * Get personalized scheme recommendations for a user
 */
export class GetRecommendationsTool extends BaseTool {
  name = 'get_recommendations';
  description =
    'Get personalized scheme recommendations ranked by relevance for a specific user. Uses ML service when available, falls back to graph-based matching.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID to get recommendations for',
      required: true,
    },
    count: {
      type: 'number',
      description: 'Number of recommendations to return (1-20, default 5)',
      required: false,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();
    const count = Math.min(params.count || 5, 20);

    if (!userId) {
      throw new Error('userId is required');
    }

    // Check cache first
    const cacheKey = `recommendations:${userId}:${count}`;
    const cached = await redisService.get<any>(cacheKey);
    if (cached) {
      console.log(`✅ Recommendations cache hit for user ${userId}`);
      return { ...cached, cached: true };
    }

    console.log(`🎯 Generating recommendations for user: ${userId}`);

    // Get user profile
    const user = await neo4jService.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const userProfile = {
      userId: user.user_id,
      age: user.age,
      income: user.income,
      state: user.state,
      employment: user.employment,
      education: user.education,
      gender: user.gender,
    };

    // Get candidate schemes via graph matching
    const candidates = await neo4jService.findSchemesForUser(userId, count * 3);

    if (candidates.length === 0) {
      // Fallback: get all schemes
      const allSchemes = await neo4jService.getAllSchemes(count * 3);
      candidates.push(...allSchemes);
    }

    // Try ML-based ranking
    const mlResult = await mlService.recommend(
      userProfile,
      candidates.map((s) => ({
        id: s.scheme_id,
        name: s.name,
        description: s.description,
        state: s.state,
        tags: s.tags,
      })),
      count
    );

    let recommendations;
    if (mlResult && mlResult.recommendations.length > 0) {
      recommendations = mlResult.recommendations.slice(0, count).map((rec, idx) => ({
        rank: idx + 1,
        schemeId: rec.id || rec.schemeId,
        name: rec.name,
        relevanceScore: Math.round((rec.relevanceScore || 0) * 100),
        state:
          candidates.find((c) => c.scheme_id === (rec.id || rec.schemeId))?.state || 'All-India',
      }));
    } else {
      // Fallback: graph-based ranking (already ordered by relevance)
      recommendations = candidates.slice(0, count).map((s, idx) => ({
        rank: idx + 1,
        schemeId: s.scheme_id,
        name: s.name,
        relevanceScore: Math.max(20, 100 - idx * 10),
        state: s.state || 'All-India',
      }));
    }

    // Apply segment-based re-ranking
    const segmentAssignment = await userSegmentationService.assignSegment(userId);
    const tagsForRanking = recommendations.map((r) => {
      const raw = candidates.find((c) => c.scheme_id === r.schemeId)?.tags;
      const tags: string[] =
        typeof raw === 'string' ? raw.split(',').map((t: string) => t.trim()) : (raw ?? []);
      return { ...r, tags };
    });
    const reRanked = userSegmentationService.reRankBySegment(
      tagsForRanking,
      segmentAssignment.segment
    );
    // Re-assign ranks after re-ranking
    recommendations = reRanked.map((r, idx) => ({
      rank: idx + 1,
      schemeId: r.schemeId,
      name: r.name,
      relevanceScore: r.relevanceScore,
      state: r.state,
    }));

    const result = {
      userId,
      count: recommendations.length,
      recommendations,
      segment: segmentAssignment.segment.name,
      source: mlResult ? 'ml' : 'graph',
      cached: false,
    };

    // Cache the result
    await redisService.set(cacheKey, result, CacheTTL.RECOMMENDATIONS);
    console.log(`✅ Generated ${recommendations.length} recommendations for ${userId}`);

    return result;
  }
}

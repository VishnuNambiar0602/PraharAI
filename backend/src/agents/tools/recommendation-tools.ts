/**
 * Recommendation Tools
 *
 * Tools for generating cached personalized scheme recommendations:
 * - get_recommendations: ML-ranked recommendations for a user
 */

import { BaseTool } from './base';
import { ParameterDefinition } from './types';
import { redisService, CacheTTL } from '../../db/redis.service';
import { recommendationRankingService } from '../../services/recommendation-ranking.service';

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
    const ranked = await recommendationRankingService.generate(userId, count);

    const result = {
      userId,
      count: ranked.recommendations.length,
      recommendations: ranked.recommendations.map((item) => ({
        rank: item.rank,
        schemeId: item.schemeId,
        name: item.name,
        relevanceScore: item.relevanceScore,
        state: item.state,
        explanation: item.explanation,
      })),
      segment: ranked.meta.segment,
      source: ranked.meta.source,
      rankingMetrics: ranked.meta.metrics,
      cached: false,
    };

    // Cache the result
    await redisService.set(cacheKey, result, CacheTTL.RECOMMENDATIONS);
    console.log(`✅ Generated ${ranked.recommendations.length} recommendations for ${userId}`);

    return result;
  }
}

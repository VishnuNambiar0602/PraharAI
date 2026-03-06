/**
 * Compound Tools
 *
 * Multi-step tools that chain multiple tool calls internally:
 * - find_best_schemes_for_user: Search → Filter → Rank
 * - analyze_user_eligibility: Get schemes → Check eligibility for each
 */

import { BaseTool } from './base';
import { ParameterDefinition } from './types';
import { neo4jService } from '../../db/neo4j.service';
import { mlService } from '../../services/ml.service';
import { redisService, CacheTTL } from '../../db/redis.service';
import { userSegmentationService } from '../../classification/user-segmentation';

/**
 * Find the best schemes for a user — combines graph search + ML ranking
 */
export class FindBestSchemesTool extends BaseTool {
  name = 'find_best_schemes_for_user';
  description =
    'Find the best government schemes for a specific user by combining graph-based matching with ML ranking. Returns a scored and ranked list.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID',
      required: true,
    },
    count: {
      type: 'number',
      description: 'Number of results (1-20, default 5)',
      required: false,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();
    const count = Math.min(params.count || 5, 20);

    if (!userId) throw new Error('userId is required');

    const cacheKey = `best_schemes:${userId}:${count}`;
    const cached = await redisService.get<any>(cacheKey);
    if (cached) return { ...cached, cached: true };

    console.log(`🔎 Finding best schemes for user ${userId}`);

    // Step 1: Get user profile
    const user = await neo4jService.getUserById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    const userProfile = {
      userId: user.user_id,
      age: user.age,
      income: user.income,
      state: user.state,
      employment: user.employment,
      education: user.education,
      gender: user.gender,
    };

    // Step 2: Graph-based candidate retrieval (broad set)
    const graphCandidates = await neo4jService.findSchemesForUser(userId, count * 4);

    // Step 3: Also search by state for broader coverage
    let stateCandidates: any[] = [];
    if (user.state) {
      stateCandidates = await neo4jService.searchSchemesWithFilter('', user.state, count * 2);
    }

    // Merge & deduplicate candidates
    const candidateMap = new Map<string, any>();
    for (const s of [...graphCandidates, ...stateCandidates]) {
      if (!candidateMap.has(s.scheme_id)) {
        candidateMap.set(s.scheme_id, s);
      }
    }
    const allCandidates = Array.from(candidateMap.values());

    // Step 4: ML ranking
    const mlResult = await mlService.recommend(
      userProfile,
      allCandidates.map((s) => ({
        id: s.scheme_id,
        name: s.name,
        description: s.description,
        state: s.state,
        tags: s.tags,
      })),
      count
    );

    let ranked;
    if (mlResult && mlResult.recommendations.length > 0) {
      ranked = mlResult.recommendations.slice(0, count).map((rec, idx) => ({
        rank: idx + 1,
        schemeId: rec.id || rec.schemeId,
        name: rec.name,
        relevanceScore: Math.round((rec.relevanceScore || 0) * 100),
        state:
          allCandidates.find((c) => c.scheme_id === (rec.id || rec.schemeId))?.state || 'All-India',
      }));
    } else {
      // Graph + eligibility fallback
      const scoredCandidates = [];
      for (const c of allCandidates.slice(0, count * 2)) {
        const eligibility = await neo4jService.checkGraphEligibility(userId, c.scheme_id);
        scoredCandidates.push({ ...c, score: eligibility.score });
      }
      scoredCandidates.sort((a, b) => b.score - a.score);

      ranked = scoredCandidates.slice(0, count).map((s, idx) => ({
        rank: idx + 1,
        schemeId: s.scheme_id,
        name: s.name,
        relevanceScore: s.score,
        state: s.state || 'All-India',
      }));
    }

    // Step 5: Apply segment-based re-ranking
    const segmentAssignment = await userSegmentationService.assignSegment(userId);
    const reRanked = userSegmentationService.reRankBySegment(
      ranked.map((r) => ({
        ...r,
        tags: allCandidates.find((c) => c.scheme_id === r.schemeId)?.tags ?? [],
      })),
      segmentAssignment.segment
    );
    ranked = reRanked.map((r, idx) => ({
      rank: idx + 1,
      schemeId: r.schemeId,
      name: r.name,
      relevanceScore: r.relevanceScore,
      state: r.state,
    }));

    const result = {
      userId,
      count: ranked.length,
      schemes: ranked,
      segment: segmentAssignment.segment.name,
      source: mlResult ? 'ml_ranked' : 'graph_scored',
      cached: false,
    };

    await redisService.set(cacheKey, result, CacheTTL.RECOMMENDATIONS);
    console.log(`✅ Found ${ranked.length} best schemes for ${userId}`);
    return result;
  }
}

/**
 * Analyze eligibility across multiple schemes
 */
export class AnalyzeEligibilityTool extends BaseTool {
  name = 'analyze_user_eligibility';
  description =
    'Check eligibility across multiple schemes for a user. Returns a comprehensive eligibility report.';

  parameters: Record<string, ParameterDefinition> = {
    userId: {
      type: 'string',
      description: 'The user ID',
      required: true,
    },
    schemeIds: {
      type: 'array',
      description: 'List of scheme IDs to check (max 5). If empty, checks top matching schemes.',
      required: false,
      items: { type: 'string', description: 'Scheme ID' },
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const userId = params.userId?.trim();
    if (!userId) throw new Error('userId is required');

    let schemeIds: string[] = params.schemeIds || [];

    console.log(`📊 Analyzing eligibility for user ${userId}`);

    // Get user
    const user = await neo4jService.getUserById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // If no specific schemes, find top matching ones
    if (schemeIds.length === 0) {
      const candidates = await neo4jService.findSchemesForUser(userId, 5);
      schemeIds = candidates.map((c) => c.scheme_id);
    }

    // Limit to 5 to prevent excessive processing
    schemeIds = schemeIds.slice(0, 5);

    const userProfile = {
      userId: user.user_id,
      age: user.age,
      income: user.income,
      state: user.state,
      employment: user.employment,
      education: user.education,
      gender: user.gender,
    };

    const results = [];

    for (const schemeId of schemeIds) {
      try {
        const scheme = await neo4jService.getSchemeById(schemeId);
        if (!scheme) continue;

        // Try ML eligibility
        let eligibility = await mlService.eligibility(userProfile, {
          id: scheme.scheme_id,
          name: scheme.name,
          state: scheme.state,
          tags: (scheme.tags || '').split(','),
          description: scheme.description,
        });

        if (!eligibility) {
          // Graph-based fallback
          const graphResult = await neo4jService.checkGraphEligibility(userId, schemeId);
          eligibility = {
            scheme_id: schemeId,
            score: graphResult.score / 100,
            percentage: graphResult.score,
            category: graphResult.score >= 60 ? 'potentially_eligible' : 'low_eligibility',
            met_criteria: graphResult.matchedCategories,
            unmet_criteria: [],
            explanation: graphResult.eligible
              ? `Graph matching found ${graphResult.matchedCategories.length} category matches.`
              : 'Limited category overlap found.',
          };
        }

        results.push({
          schemeId,
          schemeName: scheme.name,
          percentage: eligibility.percentage,
          category: eligibility.category,
          metCriteria: eligibility.met_criteria,
          explanation: eligibility.explanation,
        });
      } catch (error: any) {
        // Skip failed checks, continue with others
        console.warn(`⚠️ Eligibility check failed for ${schemeId}: ${error.message}`);
      }
    }

    // Sort by percentage descending
    results.sort((a, b) => b.percentage - a.percentage);

    return {
      userId,
      userName: user.name,
      schemesChecked: results.length,
      results,
      summary:
        results.length > 0
          ? `Checked ${results.length} schemes. Best match: ${results[0].schemeName} (${results[0].percentage}%)`
          : 'No schemes could be checked for eligibility.',
    };
  }
}

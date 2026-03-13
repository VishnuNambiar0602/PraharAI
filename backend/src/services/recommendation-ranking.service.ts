import { neo4jService } from '../db/neo4j.service';
import { mlService } from './ml.service';
import { userSegmentationService } from '../classification/user-segmentation';

type CandidateScheme = {
  schemeId: string;
  name: string;
  description: string;
  state: string | null;
  ministry: string | null;
  tags: string[];
  categories: string[];
  categoryLabel: string;
  schemeUrl: string | null;
  sourceHints: string[];
};

type ScoredCandidate = CandidateScheme & {
  graphScore: number;
  matchedCategories: string[];
  relevanceScore: number;
  explanation: string;
};

export type RankedRecommendation = {
  rank: number;
  schemeId: string;
  name: string;
  relevanceScore: number;
  state: string;
  category: string;
  benefits: string;
  description: string;
  applicationUrl: string;
  explanation: string;
};

export type RecommendationMeta = {
  source: 'ml' | 'hybrid_graph';
  segment: string;
  metrics: {
    candidateCount: number;
    eligibleCount: number;
    shortlistedCount: number;
    mlBoostedCount: number;
    uniqueCategoriesTopN: number;
    avgTopScore: number;
  };
};

type GenerationResult = {
  userId: string;
  recommendations: RankedRecommendation[];
  meta: RecommendationMeta;
};

function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v || '').trim()).filter((v) => v.length > 0);
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((v) => String(v || '').trim()).filter((v) => v.length > 0);
      }
    } catch {
      // ignore parse errors and split by comma
    }
    return trimmed
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function toCategoryLabels(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((v: any) => {
        if (!v || typeof v !== 'object') return '';
        const type = String(v.type || '').trim();
        const value = String(v.value || '').trim();
        return type && value ? `${type}:${value}` : '';
      })
      .filter((v: string) => v.length > 0);
  } catch {
    return [];
  }
}

function primaryCategory(labels: string[]): string {
  return labels.find((l) => l.length > 0) || 'General';
}

function normalizeCandidate(raw: any, hint: string): CandidateScheme {
  const tags = toStringArray(raw?.tags);
  const categories = toCategoryLabels(raw?.categories_json);
  const schemeId = String(raw?.scheme_id || raw?.schemeId || raw?.id || '').trim();
  return {
    schemeId,
    name: String(raw?.name || raw?.title || 'Untitled Scheme').trim(),
    description: String(raw?.description || '').trim(),
    state: raw?.state ? String(raw.state).trim() : null,
    ministry: raw?.ministry ? String(raw.ministry).trim() : null,
    tags,
    categories,
    categoryLabel: primaryCategory(categories),
    schemeUrl: raw?.scheme_url || raw?.schemeUrl || null,
    sourceHints: [hint],
  };
}

function buildBaseScore(candidate: CandidateScheme, user: any): number {
  let score = 20;
  const userState = String(user?.state || '')
    .trim()
    .toLowerCase();
  const schemeState = String(candidate.state || '')
    .trim()
    .toLowerCase();
  if (userState && schemeState && userState === schemeState) score += 20;
  if (!schemeState) score += 6;

  const interests = toStringArray(user?.interests).map((i) => i.toLowerCase());
  if (interests.length > 0) {
    const corpus =
      `${candidate.name} ${candidate.description} ${candidate.tags.join(' ')} ${candidate.categories.join(' ')}`.toLowerCase();
    let matches = 0;
    for (const interest of interests) {
      if (interest && corpus.includes(interest)) matches += 1;
    }
    score += Math.min(24, matches * 6);
  }

  if (candidate.sourceHints.includes('graph')) score += 8;
  if (candidate.sourceHints.includes('state')) score += 5;
  return Math.min(100, Math.max(0, score));
}

function createExplanation(candidate: ScoredCandidate, user: any): string {
  const reasons: string[] = [];
  if (candidate.matchedCategories.length > 0) {
    reasons.push(
      `matched profile categories (${candidate.matchedCategories.slice(0, 2).join(', ')})`
    );
  }

  const userState = String(user?.state || '')
    .trim()
    .toLowerCase();
  const schemeState = String(candidate.state || '')
    .trim()
    .toLowerCase();
  if (userState && schemeState && userState === schemeState) {
    reasons.push('available in your state');
  } else if (!schemeState) {
    reasons.push('available across states');
  }

  if (reasons.length === 0) {
    reasons.push('strong relevance from profile and scheme metadata');
  }

  return `Recommended because ${reasons.join('; ')}.`;
}

function applyDiversityRerank(items: ScoredCandidate[], count: number): ScoredCandidate[] {
  const selected: ScoredCandidate[] = [];
  const remaining = [...items].sort((a, b) => b.relevanceScore - a.relevanceScore);
  const seenByCategory = new Map<string, number>();

  while (selected.length < count && remaining.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < remaining.length; i += 1) {
      const item = remaining[i];
      const seen = seenByCategory.get(item.categoryLabel) || 0;
      const adjusted = item.relevanceScore - seen * 12;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const picked = remaining.splice(bestIdx, 1)[0];
    selected.push(picked);
    seenByCategory.set(picked.categoryLabel, (seenByCategory.get(picked.categoryLabel) || 0) + 1);
  }

  return selected;
}

class RecommendationRankingService {
  async generate(userId: string, requestedCount = 5): Promise<GenerationResult> {
    const count = Math.max(1, Math.min(20, Math.floor(requestedCount) || 5));
    const user = await neo4jService.getUserById(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const [graphCandidates, stateCandidates, fallbackCandidates] = await Promise.all([
      neo4jService.findSchemesForUser(userId, Math.max(count * 6, 30)),
      user.state
        ? neo4jService.searchSchemesWithFilter('', String(user.state), Math.max(count * 4, 20))
        : Promise.resolve([]),
      neo4jService.getAllSchemes(Math.max(count * 4, 20), 0),
    ]);

    const candidateMap = new Map<string, CandidateScheme>();
    const pushCandidates = (rows: any[], hint: string) => {
      for (const row of rows) {
        const candidate = normalizeCandidate(row, hint);
        if (!candidate.schemeId) continue;
        const existing = candidateMap.get(candidate.schemeId);
        if (!existing) {
          candidateMap.set(candidate.schemeId, candidate);
          continue;
        }
        existing.sourceHints = Array.from(new Set([...existing.sourceHints, hint]));
      }
    };

    pushCandidates(graphCandidates, 'graph');
    pushCandidates(stateCandidates, 'state');
    pushCandidates(fallbackCandidates, 'fallback');

    let candidates = Array.from(candidateMap.values());
    if (candidates.length === 0) {
      return {
        userId,
        recommendations: [],
        meta: {
          source: 'hybrid_graph',
          segment: 'Unknown',
          metrics: {
            candidateCount: 0,
            eligibleCount: 0,
            shortlistedCount: 0,
            mlBoostedCount: 0,
            uniqueCategoriesTopN: 0,
            avgTopScore: 0,
          },
        },
      };
    }

    const prelim = candidates
      .map((candidate) => ({ candidate, prelimScore: buildBaseScore(candidate, user) }))
      .sort((a, b) => b.prelimScore - a.prelimScore)
      .slice(0, Math.max(count * 4, 20));

    const enriched: ScoredCandidate[] = [];
    for (const { candidate, prelimScore } of prelim) {
      const eligibility = await neo4jService.checkGraphEligibility(userId, candidate.schemeId);
      // Hard filter: reject very weak graph matches unless scheme is state-aligned.
      const sameState =
        String(user?.state || '')
          .trim()
          .toLowerCase() &&
        String(candidate.state || '')
          .trim()
          .toLowerCase() ===
          String(user?.state || '')
            .trim()
            .toLowerCase();
      if (eligibility.score < 20 && !sameState) continue;

      const blended = Math.round(prelimScore * 0.35 + eligibility.score * 0.65);
      enriched.push({
        ...candidate,
        graphScore: eligibility.score,
        matchedCategories: eligibility.matchedCategories,
        relevanceScore: blended,
        explanation: '',
      });
    }

    if (enriched.length === 0) {
      enriched.push(
        ...prelim.slice(0, count).map(({ candidate, prelimScore }) => ({
          ...candidate,
          graphScore: 0,
          matchedCategories: [],
          relevanceScore: prelimScore,
          explanation: '',
        }))
      );
    }

    let mlBoostedCount = 0;
    let source: RecommendationMeta['source'] = 'hybrid_graph';
    const mlResult = await mlService.recommend(
      {
        userId: user.user_id,
        age: user.age,
        income: user.income,
        state: user.state,
        employment: user.employment,
        education: user.education,
        gender: user.gender,
        interests: user.interests,
      },
      enriched.map((item) => ({
        id: item.schemeId,
        name: item.name,
        description: item.description,
        state: item.state,
        tags: item.tags,
      })),
      Math.max(count * 2, 10)
    );

    if (mlResult && mlResult.recommendations.length > 0) {
      source = 'ml';
      const mlScores = new Map<string, number>();
      for (const rec of mlResult.recommendations) {
        const rid = String(rec.id || rec.schemeId || rec.scheme_id || '').trim();
        if (!rid) continue;
        const raw = Number(rec.relevanceScore ?? rec.relevance_score ?? 0);
        const score = raw > 1 ? raw : raw * 100;
        mlScores.set(rid, Math.max(0, Math.min(100, score)));
      }

      for (const item of enriched) {
        const mlScore = mlScores.get(item.schemeId);
        if (mlScore == null) continue;
        mlBoostedCount += 1;
        item.relevanceScore = Math.round(item.relevanceScore * 0.7 + mlScore * 0.3);
      }
    }

    const segmentAssignment = await userSegmentationService.assignSegment(userId);
    const segmentRanked = userSegmentationService.reRankBySegment(
      enriched,
      segmentAssignment.segment
    );
    const diverse = applyDiversityRerank(segmentRanked, count);

    for (const item of diverse) {
      item.explanation = createExplanation(item, user);
    }

    const recommendations: RankedRecommendation[] = diverse.map((item, idx) => ({
      rank: idx + 1,
      schemeId: item.schemeId,
      name: item.name,
      relevanceScore: item.relevanceScore,
      state: item.state || 'All-India',
      category: item.categoryLabel,
      benefits: item.ministry || 'Government of India',
      description: item.description || 'No description available',
      applicationUrl: item.schemeUrl || `https://www.myscheme.gov.in/schemes/${item.schemeId}`,
      explanation: item.explanation,
    }));

    const uniqueTopCategories = new Set(recommendations.map((r) => r.category));
    const avgTopScore =
      recommendations.length > 0
        ? Math.round(
            (recommendations.reduce((sum, rec) => sum + rec.relevanceScore, 0) /
              recommendations.length) *
              10
          ) / 10
        : 0;

    return {
      userId,
      recommendations,
      meta: {
        source,
        segment: segmentAssignment.segment.name,
        metrics: {
          candidateCount: candidates.length,
          eligibleCount: enriched.length,
          shortlistedCount: recommendations.length,
          mlBoostedCount,
          uniqueCategoriesTopN: uniqueTopCategories.size,
          avgTopScore,
        },
      },
    };
  }
}

export const recommendationRankingService = new RecommendationRankingService();

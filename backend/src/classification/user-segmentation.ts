/**
 * User Segmentation Service
 *
 * Provides rule-based + ML-hybrid user segmentation with 5 predefined segments.
 * Each segment has preferred scheme categories for personalized ranking.
 *
 * Segments:
 *   1 - Young Professionals (age 25-35, employed, higher income)
 *   2 - Farmers & Rural (farmer employment, rural, low-mid income)
 *   3 - Students & Education Seekers (age <25 or student employment)
 *   4 - Social Benefit Seekers (disability, minority, BPL)
 *   5 - General / New Users (catch-all / insufficient data)
 */

import { neo4jService } from '../db/neo4j.service';
import { redisService, CacheTTL } from '../db/redis.service';
import { mlService } from '../services/ml.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSegment {
  segmentId: number;
  name: string;
  description: string;
  preferredCategories: string[];
  rankingWeight: number; // 0.0 – 1.0, used in recommendation blending
}

export interface SegmentAssignment {
  userId: string;
  segment: UserSegment;
  confidence: number; // 0.0 – 1.0
  scores: number[]; // raw scores per segment (index = segmentId - 1)
  assignedAt: Date;
}

export interface BatchSegmentResult {
  total: number;
  segmented: number;
  failed: number;
  distribution: Record<number, number>; // segmentId → count
}

// ─── Segments Definition ──────────────────────────────────────────────────────

export const SEGMENTS: UserSegment[] = [
  {
    segmentId: 1,
    name: 'Young Professionals',
    description: 'Age 25-35, employed, higher income bracket',
    preferredCategories: [
      'housing',
      'skill development',
      'entrepreneurship',
      'startup',
      'employment',
      'urban development',
    ],
    rankingWeight: 0.4,
  },
  {
    segmentId: 2,
    name: 'Farmers & Rural',
    description: 'Farmers, agricultural workers, rural residents',
    preferredCategories: [
      'agriculture',
      'rural development',
      'irrigation',
      'crop insurance',
      'farmer welfare',
      'animal husbandry',
    ],
    rankingWeight: 0.4,
  },
  {
    segmentId: 3,
    name: 'Students & Education Seekers',
    description: 'Students, young learners, scholarship seekers',
    preferredCategories: [
      'education',
      'scholarship',
      'skill development',
      'higher education',
      'research',
      'vocational training',
    ],
    rankingWeight: 0.4,
  },
  {
    segmentId: 4,
    name: 'Social Benefit Seekers',
    description: 'Persons with disabilities, minorities, BPL families',
    preferredCategories: [
      'social welfare',
      'disability',
      'minority welfare',
      'pension',
      'health',
      'food security',
      'women welfare',
    ],
    rankingWeight: 0.4,
  },
  {
    segmentId: 5,
    name: 'General / New Users',
    description: 'New users or users with insufficient profile data',
    preferredCategories: [],
    rankingWeight: 0.0,
  },
];

// ─── Segmentation Service ─────────────────────────────────────────────────────

class UserSegmentationService {
  /**
   * Assign a user to a segment based on their profile.
   * Uses ML classification when available, falls back to rule-based scoring.
   */
  async assignSegment(userId: string): Promise<SegmentAssignment> {
    // Check cache
    const cacheKey = `segment:${userId}`;
    const cached = await redisService.get<SegmentAssignment>(cacheKey);
    if (cached) return cached;

    const user = await neo4jService.getUserById(userId);
    if (!user) {
      // Unknown user → General segment
      return this.buildAssignment(userId, 5, 0.5, [0, 0, 0, 0, 1]);
    }

    // Try ML-based classification first
    const mlSegment = await this.tryMLSegmentation(user);
    if (mlSegment) {
      await redisService.set(cacheKey, mlSegment, CacheTTL.USER_PROFILE);
      return mlSegment;
    }

    // Rule-based scoring
    const scores = this.computeScores(user);
    const bestIdx = scores.indexOf(Math.max(...scores));
    const segmentId = bestIdx + 1;
    const confidence = scores[bestIdx];

    const assignment = this.buildAssignment(userId, segmentId, confidence, scores);
    await redisService.set(cacheKey, assignment, CacheTTL.USER_PROFILE);
    return assignment;
  }

  /**
   * Compute per-segment affinity scores (0–1) from profile attributes.
   */
  private computeScores(profile: Record<string, any>): number[] {
    const age = Number(profile.age) || 0;
    const income = Number(profile.income ?? profile.annual_income ?? profile.annualIncome) || 0;
    const employment = (
      profile.employment ??
      profile.employment_status ??
      profile.employmentStatus ??
      ''
    ).toLowerCase();
    const education = (
      profile.education ??
      profile.education_level ??
      profile.educationLevel ??
      ''
    ).toLowerCase();
    const ruralUrban = (profile.rural_urban ?? profile.ruralUrban ?? '').toLowerCase();
    const disability =
      profile.disability === true || profile.disability === 'true' || profile.disability === 'yes';
    const caste = (profile.caste ?? '').toLowerCase();

    const scores = [0, 0, 0, 0, 0];

    // Segment 1: Young Professionals
    if (age >= 25 && age <= 35) scores[0] += 0.3;
    else if (age >= 22 && age <= 40) scores[0] += 0.15;
    if (['employed', 'self-employed', 'salaried'].includes(employment)) scores[0] += 0.3;
    if (income > 300000) scores[0] += 0.2;
    if (['graduate', 'post-graduate', 'professional'].includes(education)) scores[0] += 0.2;

    // Segment 2: Farmers & Rural
    if (['farmer', 'agricultural', 'agriculture'].includes(employment)) scores[1] += 0.4;
    if (ruralUrban === 'rural') scores[1] += 0.25;
    if (income > 0 && income <= 200000) scores[1] += 0.15;
    if (age >= 25) scores[1] += 0.1;
    if (['labourer', 'labour', 'daily wage'].includes(employment) && ruralUrban === 'rural')
      scores[1] += 0.1;

    // Segment 3: Students & Education Seekers
    if (['student', 'unemployed'].includes(employment) && age < 30) scores[2] += 0.35;
    if (age < 25) scores[2] += 0.25;
    else if (age < 30) scores[2] += 0.1;
    if (['school', '10th', '12th', 'undergraduate'].includes(education)) scores[2] += 0.2;
    if (income === 0 || income < 100000) scores[2] += 0.1;

    // Segment 4: Social Benefit Seekers
    if (disability) scores[3] += 0.35;
    if (['sc', 'st', 'obc'].includes(caste)) scores[3] += 0.2;
    if (income > 0 && income < 100000) scores[3] += 0.15;
    if (['unemployed', 'labourer', 'labour', 'daily wage'].includes(employment)) scores[3] += 0.15;
    if (age >= 60) scores[3] += 0.15;

    // Segment 5: General / New Users (baseline)
    const hasData = age > 0 || income > 0 || employment !== '' || education !== '';
    scores[4] = hasData ? 0.1 : 0.5;

    // Normalise so max = 1
    const maxScore = Math.max(...scores);
    if (maxScore > 0) {
      for (let i = 0; i < scores.length; i++) {
        scores[i] = Number((scores[i] / maxScore).toFixed(3));
      }
    }

    return scores;
  }

  /**
   * Try to use ML service for segmentation (maps ML cluster to segment).
   */
  private async tryMLSegmentation(profile: Record<string, any>): Promise<SegmentAssignment | null> {
    const available = await mlService.isAvailable();
    if (!available) return null;

    const classifyResult = await mlService.classify(
      `segment user age:${profile.age} income:${profile.income} employment:${profile.employment}`,
      profile.userId ?? profile.user_id
    );
    if (!classifyResult) return null;

    // Map ML intent to segment only if confidence is strong
    const intent = classifyResult.primary_intent;
    const conf = classifyResult.confidence;
    if (conf < 0.6) return null;

    let segmentId = 5;
    if (intent === 'recommendation' || intent === 'scheme_search') {
      // ML doesn't give a segment directly, fall back to rules
      return null;
    }

    const scores = this.computeScores(profile);
    const bestIdx = scores.indexOf(Math.max(...scores));
    segmentId = bestIdx + 1;

    return this.buildAssignment(profile.userId ?? profile.user_id, segmentId, conf, scores);
  }

  /**
   * Re-rank scheme recommendations by blending relevance with segment preference.
   *
   * Formula:  finalScore = (1 – weight) × relevanceScore + weight × categoryBoost
   *
   * - relevanceScore: original score (0-100)
   * - categoryBoost: 100 if the scheme's category matches the segment's preferences, else 0
   * - weight: segment.rankingWeight (default 0.4 for all but General)
   */
  reRankBySegment<T extends { relevanceScore: number; tags?: string[]; categories?: string[] }>(
    items: T[],
    segment: UserSegment
  ): T[] {
    if (segment.preferredCategories.length === 0) return items;

    const w = segment.rankingWeight;
    const preferred = new Set(segment.preferredCategories.map((c) => c.toLowerCase()));

    const scored = items.map((item) => {
      const cats = [...(item.tags ?? []), ...(item.categories ?? [])].map((c) => c.toLowerCase());

      const boost = cats.some((c) => preferred.has(c)) ? 100 : 0;
      const finalScore = (1 - w) * item.relevanceScore + w * boost;

      return { ...item, relevanceScore: Math.round(finalScore) };
    });

    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored;
  }

  /**
   * Batch-assign segments to all users in the database.
   */
  async batchAssignSegments(): Promise<BatchSegmentResult> {
    const allUsers = await this.getAllUsers();

    const distribution: Record<number, number> = {};
    let segmented = 0;
    let failed = 0;

    for (const user of allUsers) {
      try {
        const assignment = await this.assignSegment(user.userId ?? user.user_id);
        distribution[assignment.segment.segmentId] =
          (distribution[assignment.segment.segmentId] || 0) + 1;
        segmented++;
      } catch {
        failed++;
      }
    }

    return { total: allUsers.length, segmented, failed, distribution };
  }

  /**
   * Get segment by ID.
   */
  getSegment(segmentId: number): UserSegment {
    return SEGMENTS.find((s) => s.segmentId === segmentId) ?? SEGMENTS[4];
  }

  // ─── Internals ────────────────────────────────────────────────────────────

  private buildAssignment(
    userId: string,
    segmentId: number,
    confidence: number,
    scores: number[]
  ): SegmentAssignment {
    return {
      userId,
      segment: this.getSegment(segmentId),
      confidence,
      scores,
      assignedAt: new Date(),
    };
  }

  private async getAllUsers(): Promise<any[]> {
    // Batch segmentation is intended to run from a cron job that
    // iterates user IDs directly (e.g. ClassificationService.reclassifyAllUsers).
    // This lightweight fallback returns an empty list to degrade gracefully.
    return [];
  }
}

export const userSegmentationService = new UserSegmentationService();

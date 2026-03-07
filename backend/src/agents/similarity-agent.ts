/**
 * Similarity Check Agent
 *
 * Responsibilities:
 * 1. Match user profiles with schemes based on graph categories
 * 2. Calculate eligibility scores
 * 3. Rank and recommend schemes — with optional ML re-ranking (T-10)
 *
 * Reads from Neo4j graph database as the primary data source.
 */

import { neo4jService, CategoryMapping, SchemeRow } from '../db/neo4j.service';
import { mlService } from '../services/ml.service';

interface UserProfile {
  userId: string;
  employment?: string;
  income?: string;
  locality?: string;
  socialCategory?: string;
  education?: string;
  povertyLine?: string;
  state?: string;
  age?: number;
  interests?: string[];
}

interface SchemeMatch {
  schemeId: string;
  name: string;
  description: string;
  ministry: string | null;
  state: string | null;
  tags: string[];
  categories: CategoryMapping[];
  schemeUrl: string | null;
  similarityScore: number;
  eligibilityScore: number;
  matchedCategories: string[];
  explanation: string;
}

class SimilarityAgent {
  /**
   * Find matching schemes for a user profile
   */
  async findMatchingSchemes(profile: UserProfile, limit: number = 20): Promise<SchemeMatch[]> {
    try {
      console.log(`🔍 Finding schemes for user ${profile.userId}`);

      const categoryFilters = this.buildCategoryFilters(profile);
      const rows = await this.findSchemesByCategories(categoryFilters, limit * 3);

      const matches = rows.map((row) => this.calculateMatch(row, profile, categoryFilters));

      matches.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
      const topMatches = matches.slice(0, limit);

      // T-10: Optional ML re-ranking — fire and forget, use result if fast enough
      try {
        const mlAvailable = await mlService.isAvailable();
        if (mlAvailable) {
          const schemesForML = topMatches.map((m) => ({
            id: m.schemeId,
            name: m.name,
            description: m.description,
            tags: m.tags,
            state: m.state,
            ministry: m.ministry,
          }));
          const mlResult = await mlService.recommend(profile as any, schemesForML, limit);
          if (mlResult && mlResult.recommendations.length > 0) {
            const mlScores = new Map<string, number>();
            mlResult.recommendations.forEach((r, idx) => {
              const id = r.id || r.schemeId || '';
              mlScores.set(id, mlResult.recommendations.length - idx);
            });
            topMatches.forEach((m) => {
              const mlScore = mlScores.get(m.schemeId);
              if (mlScore !== undefined) {
                m.eligibilityScore = Math.round(
                  m.eligibilityScore * 0.6 + (mlScore / limit) * 100 * 0.4
                );
              }
            });
            topMatches.sort((a, b) => b.eligibilityScore - a.eligibilityScore);
            console.log('✅ ML re-ranking applied');
          }
        }
      } catch (mlErr) {
        console.debug('ML re-ranking skipped:', (mlErr as Error).message);
      }

      return topMatches;
    } catch (error) {
      console.error('Error finding matching schemes:', error);
      throw error;
    }
  }

  /**
   * Build category filters from user profile
   */
  private buildCategoryFilters(profile: UserProfile): CategoryMapping[] {
    const filters: CategoryMapping[] = [];
    if (profile.employment) filters.push({ type: 'Employment', value: profile.employment });
    if (profile.income) filters.push({ type: 'Income', value: profile.income });
    if (profile.locality) filters.push({ type: 'Locality', value: profile.locality });
    if (profile.socialCategory)
      filters.push({ type: 'SocialCategory', value: profile.socialCategory });
    if (profile.education) filters.push({ type: 'Education', value: profile.education });
    if (profile.povertyLine) filters.push({ type: 'PovertyLine', value: profile.povertyLine });
    return filters;
  }

  /**
   * Find schemes by multiple categories (graph traversal through Neo4j)
   */
  private async findSchemesByCategories(
    categories: CategoryMapping[],
    limit: number
  ): Promise<SchemeRow[]> {
    if (categories.length === 0) {
      return neo4jService.getAllSchemes(limit);
    }
    return neo4jService.findSchemesByCategories(categories, limit);
  }

  /**
   * Calculate match score for a scheme row
   */
  private calculateMatch(
    row: SchemeRow,
    profile: UserProfile,
    userCategories: CategoryMapping[]
  ): SchemeMatch {
    const scheme = neo4jService.toScheme(row);
    const schemeCategories: CategoryMapping[] = JSON.parse(row.categories_json || '[]');
    const matchedCategories: string[] = [];
    let categoryMatches = 0;

    for (const userCat of userCategories) {
      const hasMatch = schemeCategories.some(
        (sc) => sc.type === userCat.type && (sc.value === userCat.value || sc.value === 'Any')
      );
      if (hasMatch) {
        categoryMatches++;
        matchedCategories.push(`${userCat.type}: ${userCat.value}`);
      }
    }

    const similarityScore =
      userCategories.length > 0 ? categoryMatches / userCategories.length : 0.5;
    let eligibilityScore = similarityScore * 100;

    if (profile.state && row.state === profile.state) {
      eligibilityScore = Math.min(100, eligibilityScore + 10);
    }
    if (!row.state) {
      eligibilityScore = Math.min(100, eligibilityScore + 5);
    }

    const textScore = this.calculateTextSimilarity(row, profile);
    eligibilityScore = Math.min(100, eligibilityScore + textScore * 10);

    const explanation = this.generateExplanation(matchedCategories, eligibilityScore, scheme);

    return {
      schemeId: row.scheme_id,
      name: row.name,
      description: row.description || '',
      ministry: row.ministry,
      state: row.state,
      tags: JSON.parse(row.tags || '[]'),
      categories: schemeCategories,
      schemeUrl: row.scheme_url ?? null,
      similarityScore: Math.round(similarityScore * 100) / 100,
      eligibilityScore: Math.round(eligibilityScore),
      matchedCategories,
      explanation,
    };
  }

  /**
   * Calculate text similarity using keyword matching
   */
  private calculateTextSimilarity(row: SchemeRow, profile: UserProfile): number {
    if (!profile.interests || profile.interests.length === 0) return 0;

    const tags: string[] = JSON.parse(row.tags || '[]');
    const schemeText = `${row.name} ${row.description || ''} ${tags.join(' ')}`.toLowerCase();
    let matches = 0;

    for (const interest of profile.interests) {
      if (schemeText.includes(interest.toLowerCase())) matches++;
    }

    return matches / profile.interests.length;
  }

  /**
   * Generate explanation for the match
   */
  private generateExplanation(matchedCategories: string[], score: number, scheme: any): string {
    if (matchedCategories.length === 0) {
      return 'This is a general scheme that may be applicable to you.';
    }

    const categoryText = matchedCategories.join(', ');
    const scoreText =
      score >= 80 ? 'highly eligible' : score >= 60 ? 'eligible' : 'potentially eligible';
    const desc = (scheme.description || '').substring(0, 100);
    return `You are ${scoreText} for this scheme based on: ${categoryText}. ${desc}...`;
  }

  /**
   * Search schemes by text query
   */
  async searchSchemes(query: string, limit: number = 20, offset: number = 0): Promise<any[]> {
    try {
      const rows = await neo4jService.searchSchemes(query, limit, offset);
      return rows.map((row) => neo4jService.toScheme(row));
    } catch (error) {
      console.error('Error searching schemes:', error);
      throw error;
    }
  }

  /**
   * Get scheme by ID with categories
   */
  async getSchemeById(schemeId: string): Promise<any | null> {
    try {
      const row = await neo4jService.getSchemeById(schemeId);
      if (!row) return null;
      return neo4jService.toScheme(row);
    } catch (error) {
      console.error('Error getting scheme by ID:', error);
      throw error;
    }
  }

  /**
   * Get all available categories
   */
  async getAllCategories(): Promise<Record<string, string[]>> {
    try {
      return await neo4jService.getAllCategories();
    } catch (error) {
      console.error('Error getting all categories:', error);
      throw error;
    }
  }
}

export const similarityAgent = new SimilarityAgent();

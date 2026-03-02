/**
 * Similarity Check Agent
 * 
 * Responsibilities:
 * 1. Perform semantic similarity matching on schemes
 * 2. Match user profiles with schemes based on categories
 * 3. Calculate eligibility scores
 * 4. Rank and recommend schemes
 */

import { schemesCacheService } from '../schemes/schemes-cache.service';
import { neo4jService } from '../db/neo4j.service';
import { SCHEMA_QUERIES, CategoryType } from '../db/schemes-schema';

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
  similarityScore: number;
  eligibilityScore: number;
  matchedCategories: string[];
  explanation: string;
}

interface CategoryMapping {
  type: string;
  value: string;
}

class SimilarityAgent {
  /**
   * Find matching schemes for a user profile
   */
  async findMatchingSchemes(
    profile: UserProfile,
    limit: number = 20
  ): Promise<SchemeMatch[]> {
    try {
      console.log(`🔍 Finding schemes for user ${profile.userId}`);

      // Build category filters from user profile
      const categoryFilters = this.buildCategoryFilters(profile);

      // Find schemes matching categories
      const schemes = await this.findSchemesByCategories(categoryFilters, limit * 3);

      // Calculate similarity and eligibility scores
      const matches = schemes.map((scheme) =>
        this.calculateMatch(scheme, profile, categoryFilters)
      );

      // Sort by eligibility score (descending)
      matches.sort((a, b) => b.eligibilityScore - a.eligibilityScore);

      // Return top matches
      return matches.slice(0, limit);
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

    if (profile.employment) {
      filters.push({
        type: CategoryType.EMPLOYMENT,
        value: profile.employment,
      });
    }

    if (profile.income) {
      filters.push({
        type: CategoryType.INCOME,
        value: profile.income,
      });
    }

    if (profile.locality) {
      filters.push({
        type: CategoryType.LOCALITY,
        value: profile.locality,
      });
    }

    if (profile.socialCategory) {
      filters.push({
        type: CategoryType.SOCIAL_CATEGORY,
        value: profile.socialCategory,
      });
    }

    if (profile.education) {
      filters.push({
        type: CategoryType.EDUCATION,
        value: profile.education,
      });
    }

    if (profile.povertyLine) {
      filters.push({
        type: CategoryType.POVERTY_LINE,
        value: profile.povertyLine,
      });
    }

    return filters;
  }

  /**
   * Find schemes by multiple categories
   */
  private async findSchemesByCategories(
    categories: CategoryMapping[],
    limit: number
  ): Promise<any[]> {
    try {
      // Try Neo4j first
      try {
        // If no categories, return all schemes
        if (categories.length === 0) {
          const result = await neo4jService.executeQuery(
            `MATCH (s:Scheme)
             OPTIONAL MATCH (s)-[:BELONGS_TO]->(c:Category)
             RETURN s, collect({type: c.type, value: c.value}) as categories
             LIMIT $limit`,
            { limit }
          );

          return result.records.map((record: any) => ({
            ...record.get('s').properties,
            categories: record.get('categories'),
          }));
        }

        // Find schemes matching ANY of the categories (union)
        const query = `
          MATCH (s:Scheme)-[:BELONGS_TO]->(c:Category)
          WHERE (c.type, c.value) IN $categoryPairs OR c.value = 'Any'
          WITH DISTINCT s
          OPTIONAL MATCH (s)-[:BELONGS_TO]->(cat:Category)
          RETURN s, collect({type: cat.type, value: cat.value}) as categories
          LIMIT $limit
        `;

        const categoryPairs = categories.map((c) => [c.type, c.value]);

        const result = await neo4jService.executeQuery(query, {
          categoryPairs,
          limit,
        });

        return result.records.map((record: any) => ({
          ...record.get('s').properties,
          categories: record.get('categories'),
        }));
      } catch (neo4jError) {
        // Fallback to cache
        console.log('Neo4j query failed, using cache');
        const schemes = schemesCacheService.findSchemesByCategories(categories, limit);
        
        return schemes.map((scheme) => ({
          ...scheme,
          categories: scheme.categories,
        }));
      }
    } catch (error) {
      console.error('Error finding schemes by categories:', error);
      throw error;
    }
  }

  /**
   * Calculate match score for a scheme
   */
  private calculateMatch(
    scheme: any,
    profile: UserProfile,
    userCategories: CategoryMapping[]
  ): SchemeMatch {
    const schemeCategories = scheme.categories || [];
    const matchedCategories: string[] = [];
    let categoryMatches = 0;

    // Count category matches
    for (const userCat of userCategories) {
      const hasMatch = schemeCategories.some(
        (schemeCat: CategoryMapping) =>
          schemeCat.type === userCat.type &&
          (schemeCat.value === userCat.value || schemeCat.value === 'Any')
      );

      if (hasMatch) {
        categoryMatches++;
        matchedCategories.push(`${userCat.type}: ${userCat.value}`);
      }
    }

    // Calculate similarity score (0-1)
    const similarityScore =
      userCategories.length > 0 ? categoryMatches / userCategories.length : 0.5;

    // Calculate eligibility score (0-100)
    let eligibilityScore = similarityScore * 100;

    // Boost score for state match
    if (profile.state && scheme.state === profile.state) {
      eligibilityScore = Math.min(100, eligibilityScore + 10);
    }

    // Boost score for national schemes
    if (!scheme.state) {
      eligibilityScore = Math.min(100, eligibilityScore + 5);
    }

    // Text similarity boost (simple keyword matching)
    const textScore = this.calculateTextSimilarity(scheme, profile);
    eligibilityScore = Math.min(100, eligibilityScore + textScore * 10);

    // Generate explanation
    const explanation = this.generateExplanation(
      matchedCategories,
      eligibilityScore,
      scheme
    );

    return {
      schemeId: scheme.schemeId,
      name: scheme.name,
      description: scheme.description,
      ministry: scheme.ministry,
      state: scheme.state,
      tags: scheme.tags || [],
      categories: schemeCategories,
      similarityScore: Math.round(similarityScore * 100) / 100,
      eligibilityScore: Math.round(eligibilityScore),
      matchedCategories,
      explanation,
    };
  }

  /**
   * Calculate text similarity using keyword matching
   */
  private calculateTextSimilarity(scheme: any, profile: UserProfile): number {
    if (!profile.interests || profile.interests.length === 0) return 0;

    const schemeText = `${scheme.name} ${scheme.description} ${(scheme.tags || []).join(' ')}`.toLowerCase();
    let matches = 0;

    for (const interest of profile.interests) {
      if (schemeText.includes(interest.toLowerCase())) {
        matches++;
      }
    }

    return profile.interests.length > 0 ? matches / profile.interests.length : 0;
  }

  /**
   * Generate explanation for the match
   */
  private generateExplanation(
    matchedCategories: string[],
    score: number,
    scheme: any
  ): string {
    if (matchedCategories.length === 0) {
      return 'This is a general scheme that may be applicable to you.';
    }

    const categoryText = matchedCategories.join(', ');
    const scoreText =
      score >= 80 ? 'highly eligible' : score >= 60 ? 'eligible' : 'potentially eligible';

    return `You are ${scoreText} for this scheme based on: ${categoryText}. ${scheme.description.substring(0, 100)}...`;
  }

  /**
   * Search schemes by text query
   */
  async searchSchemes(query: string, limit: number = 20): Promise<any[]> {
    try {
      const lowerQuery = query.toLowerCase();

      try {
        // Try Neo4j first
        const result = await neo4jService.executeQuery(
          `MATCH (s:Scheme)
           WHERE toLower(s.name) CONTAINS $query 
              OR toLower(s.description) CONTAINS $query
              OR ANY(tag IN s.tags WHERE toLower(tag) CONTAINS $query)
           OPTIONAL MATCH (s)-[:BELONGS_TO]->(c:Category)
           RETURN s, collect({type: c.type, value: c.value}) as categories
           LIMIT $limit`,
          { query: lowerQuery, limit }
        );

        return result.records.map((record: any) => ({
          ...record.get('s').properties,
          categories: record.get('categories'),
        }));
      } catch (neo4jError) {
        // Fallback to cache
        console.log('Neo4j search failed, using cache');
        return schemesCacheService.searchSchemes(query, limit);
      }
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
      try {
        // Try Neo4j first
        const result = await neo4jService.executeQuery(
          SCHEMA_QUERIES.getSchemeWithCategories,
          { schemeId }
        );

        if (result.records.length === 0) return null;

        const record = result.records[0];
        return {
          ...record.get('s').properties,
          categories: record.get('categories').map((c: any) => c.properties),
        };
      } catch (neo4jError) {
        // Fallback to cache
        console.log('Neo4j getById failed, using cache');
        return schemesCacheService.getSchemeById(schemeId);
      }
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
      try {
        // Try Neo4j first
        const result = await neo4jService.executeQuery(
          SCHEMA_QUERIES.getAllCategories,
          {}
        );

        const categories: Record<string, string[]> = {};

        for (const record of result.records) {
          const type = record.get('type');
          const value = record.get('value');

          if (!categories[type]) {
            categories[type] = [];
          }

          categories[type].push(value);
        }

        return categories;
      } catch (neo4jError) {
        // Fallback to cache
        console.log('Neo4j getAllCategories failed, using cache');
        return schemesCacheService.getAllCategories();
      }
    } catch (error) {
      console.error('Error getting all categories:', error);
      throw error;
    }
  }
}

export const similarityAgent = new SimilarityAgent();

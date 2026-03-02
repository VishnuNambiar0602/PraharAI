/**
 * Schemes Cache Service
 * In-memory cache for schemes data (replaces Neo4j for now)
 * This provides fast access to scheme data without requiring a graph database
 */

import { Scheme } from './india-gov.service';

interface CategoryMapping {
  type: string;
  value: string;
}

interface CachedScheme extends Scheme {
  categories: CategoryMapping[];
  lastUpdated: string;
}

class SchemesCacheService {
  private schemes: Map<string, CachedScheme> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private lastSync: Date | null = null;

  /**
   * Store schemes in cache
   */
  storeSchemes(schemes: Scheme[]): void {
    for (const scheme of schemes) {
      const categories = this.extractCategories(scheme);
      
      const cachedScheme: CachedScheme = {
        ...scheme,
        categories,
        lastUpdated: new Date().toISOString(),
      };

      this.schemes.set(scheme.schemeId, cachedScheme);

      // Update categories index
      for (const category of categories) {
        if (!this.categories.has(category.type)) {
          this.categories.set(category.type, new Set());
        }
        this.categories.get(category.type)!.add(category.value);
      }
    }

    this.lastSync = new Date();
    console.log(`✅ Cached ${schemes.length} schemes`);
  }

  /**
   * Get all schemes
   */
  getAllSchemes(): CachedScheme[] {
    return Array.from(this.schemes.values());
  }

  /**
   * Get scheme by ID
   */
  getSchemeById(schemeId: string): CachedScheme | null {
    return this.schemes.get(schemeId) || null;
  }

  /**
   * Search schemes by text
   */
  searchSchemes(query: string, limit: number = 20): CachedScheme[] {
    const lowerQuery = query.toLowerCase();
    const results: CachedScheme[] = [];

    for (const scheme of this.schemes.values()) {
      if (
        scheme.name.toLowerCase().includes(lowerQuery) ||
        scheme.description.toLowerCase().includes(lowerQuery) ||
        scheme.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
      ) {
        results.push(scheme);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Find schemes by categories
   */
  findSchemesByCategories(
    categories: CategoryMapping[],
    limit: number = 20
  ): CachedScheme[] {
    if (categories.length === 0) {
      return Array.from(this.schemes.values()).slice(0, limit);
    }

    const results: CachedScheme[] = [];

    for (const scheme of this.schemes.values()) {
      // Check if scheme matches any of the requested categories
      const hasMatch = categories.some((reqCat) =>
        scheme.categories.some(
          (schemeCat) =>
            schemeCat.type === reqCat.type &&
            (schemeCat.value === reqCat.value || schemeCat.value === 'Any')
        )
      );

      if (hasMatch) {
        results.push(scheme);
        if (results.length >= limit) break;
      }
    }

    return results;
  }

  /**
   * Get all categories
   */
  getAllCategories(): Record<string, string[]> {
    const result: Record<string, string[]> = {};

    for (const [type, values] of this.categories.entries()) {
      result[type] = Array.from(values);
    }

    return result;
  }

  /**
   * Get cache stats
   */
  getStats() {
    return {
      totalSchemes: this.schemes.size,
      totalCategories: this.categories.size,
      lastSync: this.lastSync?.toISOString() || null,
    };
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.schemes.clear();
    this.categories.clear();
    this.lastSync = null;
  }

  /**
   * Extract categories from scheme data
   */
  private extractCategories(scheme: Scheme): CategoryMapping[] {
    const categories: CategoryMapping[] = [];
    const text = `${scheme.name} ${scheme.description} ${scheme.tags.join(' ')}`.toLowerCase();

    // Employment categories
    const employmentRules: Record<string, string[]> = {
      Employed: ['employed', 'employee', 'worker', 'job'],
      Unemployed: ['unemployed', 'jobless', 'unemployment'],
      'Self-Employed': ['self-employed', 'entrepreneur', 'business owner'],
      Student: ['student', 'education', 'scholarship'],
      Retired: ['retired', 'pension', 'senior citizen'],
    };

    for (const [key, keywords] of Object.entries(employmentRules)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({ type: 'Employment', value: key });
      }
    }

    // Income categories
    const incomeRules: Record<string, string[]> = {
      'Below 1 Lakh': ['bpl', 'below poverty', 'poor', 'low income'],
      '1-3 Lakh': ['middle income', 'moderate income'],
      'Above 10 Lakh': ['high income', 'wealthy'],
    };

    for (const [key, keywords] of Object.entries(incomeRules)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({ type: 'Income', value: key });
      }
    }

    // Locality categories
    if (text.includes('rural') || text.includes('village') || text.includes('farmer')) {
      categories.push({ type: 'Locality', value: 'Rural' });
    }
    if (text.includes('urban') || text.includes('city')) {
      categories.push({ type: 'Locality', value: 'Urban' });
    }

    // Social categories
    const socialRules: Record<string, string[]> = {
      SC: ['sc', 'scheduled caste'],
      ST: ['st', 'scheduled tribe', 'tribal'],
      OBC: ['obc', 'other backward'],
      Minority: ['minority', 'muslim', 'christian'],
      Women: ['women', 'woman', 'female', 'girl'],
      PWD: ['pwd', 'disabled', 'disability', 'handicapped'],
      General: ['general'],
    };

    for (const [key, keywords] of Object.entries(socialRules)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({ type: 'SocialCategory', value: key });
      }
    }

    // Education categories
    const educationRules: Record<string, string[]> = {
      Primary: ['primary', 'elementary'],
      Secondary: ['secondary', 'high school'],
      Graduate: ['graduate', 'degree', 'college'],
      'Post-Graduate': ['post graduate', 'masters', 'phd'],
      Professional: ['professional', 'technical', 'vocational'],
    };

    for (const [key, keywords] of Object.entries(educationRules)) {
      if (keywords.some((kw) => text.includes(kw))) {
        categories.push({ type: 'Education', value: key });
      }
    }

    // Poverty line
    if (text.includes('bpl') || text.includes('below poverty')) {
      categories.push({ type: 'PovertyLine', value: 'BPL' });
    } else if (text.includes('apl') || text.includes('above poverty')) {
      categories.push({ type: 'PovertyLine', value: 'APL' });
    }

    // If no categories found, add "Any" for each type
    if (categories.length === 0) {
      categories.push(
        { type: 'Employment', value: 'Any' },
        { type: 'Income', value: 'Any' },
        { type: 'Locality', value: 'Any' },
        { type: 'SocialCategory', value: 'Any' },
        { type: 'Education', value: 'Any' },
        { type: 'PovertyLine', value: 'Any' }
      );
    }

    return categories;
  }
}

export const schemesCacheService = new SchemesCacheService();

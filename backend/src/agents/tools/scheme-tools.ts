/**
 * Scheme Tools
 *
 * Tools for searching and retrieving scheme information:
 * - search_schemes: Find schemes by keyword, state, category
 * - get_scheme_details: Get full information about a specific scheme
 */

import { BaseTool } from './base';
import { ParameterDefinition } from './types';
import { neo4jService } from '../../db/neo4j.service';

/**
 * Search for schemes matching criteria
 */
export class SearchSchemesTool extends BaseTool {
  name = 'search_schemes';
  description =
    'Search for government schemes by keyword, state, or category. Returns list of matching schemes with basic info.';

  parameters: Record<string, ParameterDefinition> = {
    query: {
      type: 'string',
      description: 'Search keyword or phrase (e.g., "agriculture", "education", "women")',
      required: true,
    },
    state: {
      type: 'string',
      description:
        'Optional state filter (e.g., "Maharashtra", "Punjab"). Leave empty for all-India schemes.',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results to return (1-50, default 10)',
      required: false,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const query = params.query?.trim() || '';
    const state = params.state?.trim() || undefined;
    const limit = Math.min(params.limit || 10, 50); // Cap at 50

    if (!query || query.length < 2) {
      throw new Error('Search query must be at least 2 characters');
    }

    console.log(
      `🔍 Searching schemes: query="${query}", state="${state || 'all'}", limit=${limit}`
    );

    try {
      // Use optimized full-text search with optional state filter
      const schemes = await neo4jService.searchSchemesWithFilter(query, state, limit);

      const results = schemes.map((scheme) => ({
        id: scheme.scheme_id,
        name: scheme.name,
        ministry: scheme.ministry,
        state: scheme.state || 'All-India',
        description: (scheme.description || '').slice(0, 150) + '...',
        url: scheme.scheme_url,
      }));

      if (results.length === 0) {
        console.log(`❌ No schemes found for: "${query}"`);
      } else {
        console.log(`✅ Found ${results.length} schemes matching "${query}"`);
      }

      return {
        query,
        state: state || 'All-India',
        count: results.length,
        schemes: results,
      };
    } catch (error) {
      console.error('Search schemes error:', error);
      throw error;
    }
  }
}

/**
 * Get detailed information about a specific scheme
 */
export class GetSchemeDetailsTool extends BaseTool {
  name = 'get_scheme_details';
  description =
    'Get complete details about a specific scheme including description, eligibility, benefits, application process, and application URL.';

  parameters: Record<string, ParameterDefinition> = {
    schemeId: {
      type: 'string',
      description: 'The scheme ID (e.g., "scheme_001")',
      required: true,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const schemeId = params.schemeId?.trim();

    if (!schemeId) {
      throw new Error('Scheme ID is required');
    }

    console.log(`📋 Fetching details for scheme: ${schemeId}`);

    try {
      // Get scheme from Neo4j
      const scheme = await neo4jService.getSchemeById(schemeId);

      if (!scheme) {
        throw new Error(`Scheme not found: ${schemeId}`);
      }

      // Parse categories
      const categories = JSON.parse(scheme.categories_json || '[]');
      const tags = JSON.parse(scheme.tags || '[]');

      const result = {
        id: scheme.scheme_id,
        name: scheme.name,
        ministry: scheme.ministry,
        state: scheme.state || 'All-India',
        description: scheme.description,
        applicationUrl: scheme.scheme_url,
        lastUpdated: scheme.last_updated || null,
        categories: categories,
        tags: tags,
      };

      console.log(`✅ Retrieved details for: ${scheme.name}`);
      return result;
    } catch (error) {
      console.error('Get scheme details error:', error);
      throw error;
    }
  }
}

/**
 * Get schemes by category (employment, state, etc)
 */
export class GetSchemesByCategoryTool extends BaseTool {
  name = 'get_schemes_by_category';
  description =
    'Get schemes matching a specific category like employment type, education level, or locality.';

  parameters: Record<string, ParameterDefinition> = {
    category: {
      type: 'string',
      description: 'Category type (e.g., "Agriculture", "Education", "Healthcare", "Women")',
      required: true,
    },
    value: {
      type: 'string',
      description: 'Category value (e.g., "Farmer", "College", "Rural")',
      required: true,
    },
    limit: {
      type: 'number',
      description: 'Maximum number of results (default 10)',
      required: false,
    },
  };

  protected async executeImpl(params: Record<string, any>): Promise<any> {
    const category = params.category?.trim();
    const value = params.value?.trim();
    const limit = Math.min(params.limit || 10, 50);

    if (!category || !value) {
      throw new Error('Both category and value are required');
    }

    console.log(`🏷️ Fetching schemes by ${category}=${value}`);

    try {
      const schemes = await neo4jService.findSchemesByCategories(
        [{ type: category, value }],
        limit
      );

      const results = schemes.map((s) => ({
        id: s.scheme_id,
        name: s.name,
        ministry: s.ministry,
        state: s.state || 'All-India',
      }));

      console.log(`✅ Found ${results.length} schemes for ${category}=${value}`);
      return {
        category,
        value,
        count: results.length,
        schemes: results,
      };
    } catch (error) {
      console.error('Get schemes by category error:', error);
      throw error;
    }
  }
}

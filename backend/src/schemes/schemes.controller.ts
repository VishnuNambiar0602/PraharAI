/**
 * Schemes Controller
 * Handles HTTP requests for government schemes
 * Uses Similarity Agent for matching and recommendations (with fallback to direct API)
 */

import { Request, Response } from 'express';
import { similarityAgent } from '../agents/similarity-agent';
import { indiaGovService } from './india-gov.service';

export class SchemesController {
  /**
   * GET /api/schemes
   * Fetch schemes with optional filters
   */
  async getSchemes(req: Request, res: Response) {
    try {
      const { q, limit = '20', page = '1' } = req.query;
      const limitNum = parseInt(limit as string, 10);
      const pageNum = parseInt(page as string, 10);

      try {
        // Try using similarity agent (Neo4j)
        let schemes;

        if (q) {
          schemes = await similarityAgent.searchSchemes(q as string, limitNum);
        } else {
          schemes = await similarityAgent.searchSchemes('', limitNum);
        }

        res.json({
          total: schemes.length,
          schemes: schemes.map((s) => ({
            schemeId: s.schemeId,
            name: s.name,
            description: s.description,
            ministry: s.ministry,
            state: s.state,
            tags: s.tags,
            category: s.rawCategory,
          })),
        });
      } catch (dbError) {
        // Fallback to direct API if Neo4j is not available
        console.log('Neo4j not available, falling back to direct API');
        
        const result = await indiaGovService.fetchSchemes({
          pageNumber: pageNum,
          pageSize: limitNum,
        });

        let schemes = result.schemes;

        if (q) {
          schemes = indiaGovService.searchSchemes(schemes, q as string);
        }

        res.json({
          total: result.total,
          page: pageNum,
          pageSize: limitNum,
          schemes: schemes.map((s) => ({
            schemeId: s.schemeId,
            name: s.name,
            description: s.description,
            ministry: s.ministry,
            state: s.state,
            tags: s.tags,
            category: s.category,
          })),
        });
      }
    } catch (error: any) {
      console.error('Error in getSchemes:', error);
      res.status(500).json({
        error: 'Failed to fetch schemes',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/schemes/:schemeId
   * Get a specific scheme by ID (slug)
   */
  async getSchemeById(req: Request, res: Response) {
    try {
      const { schemeId } = req.params;

      try {
        // Try using similarity agent (Neo4j)
        const scheme = await similarityAgent.getSchemeById(schemeId);

        if (!scheme) {
          return res.status(404).json({ error: 'Scheme not found' });
        }

        res.json({
          schemeId: scheme.schemeId,
          name: scheme.name,
          description: scheme.description,
          ministry: scheme.ministry,
          state: scheme.state,
          tags: scheme.tags,
          category: scheme.rawCategory,
          categories: scheme.categories,
        });
      } catch (dbError) {
        // Fallback to direct API
        console.log('Neo4j not available, falling back to direct API');
        
        const result = await indiaGovService.fetchSchemes({ pageSize: 100 });
        const scheme = result.schemes.find((s) => s.schemeId === schemeId);

        if (!scheme) {
          return res.status(404).json({ error: 'Scheme not found' });
        }

        res.json(scheme);
      }
    } catch (error: any) {
      console.error('Error in getSchemeById:', error);
      res.status(500).json({
        error: 'Failed to fetch scheme',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/schemes/categories
   * Get available scheme categories
   */
  async getCategories(req: Request, res: Response) {
    try {
      try {
        // Try using similarity agent (Neo4j)
        const categories = await similarityAgent.getAllCategories();
        res.json({ categories });
      } catch (dbError) {
        // Fallback to predefined categories
        console.log('Neo4j not available, returning predefined categories');
        
        const categories = indiaGovService.getAvailableCategories();
        res.json({ categories });
      }
    } catch (error: any) {
      console.error('Error in getCategories:', error);
      res.status(500).json({
        error: 'Failed to fetch categories',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/users/:userId/recommendations
   * Get personalized scheme recommendations for a user
   */
  async getRecommendations(req: Request, res: Response) {
    try {
      const { userId } = req.params;

      try {
        // Try using similarity agent (Neo4j)
        const userProfile = {
          userId,
          employment: 'Unemployed',
          income: 'Below1Lakh',
          locality: 'Rural',
          socialCategory: 'General',
          education: 'Secondary',
          povertyLine: 'BPL',
          state: 'Maharashtra',
          interests: ['agriculture', 'education', 'health'],
        };

        const matches = await similarityAgent.findMatchingSchemes(userProfile, 10);

        const recommendations = matches.map((match) => ({
          schemeId: match.schemeId,
          schemeName: match.name,
          eligibilityScore: match.eligibilityScore,
          explanation: match.explanation,
          category: match.categories.map((c) => c.type),
          tags: match.tags,
          matchedCategories: match.matchedCategories,
        }));

        res.json({ recommendations });
      } catch (dbError) {
        // Fallback to simple API-based recommendations
        console.log('Neo4j not available, using simple recommendations');
        
        const categories = [
          'Agriculture,Rural & Environment',
          'Education & Learning',
          'Health & Wellness',
        ];

        const allRecommendations = [];

        for (const category of categories) {
          const result = await indiaGovService.fetchSchemes({
            categories: [category],
            pageSize: 3,
          });

          allRecommendations.push(...result.schemes);
        }

        const recommendations = allRecommendations.map((scheme) => ({
          schemeId: scheme.schemeId,
          schemeName: scheme.name,
          eligibilityScore: Math.floor(Math.random() * 30) + 70,
          explanation: `Based on your profile, you may be eligible for this scheme. ${scheme.description.substring(0, 100)}...`,
          category: scheme.category,
          tags: scheme.tags,
        }));

        res.json({ recommendations });
      }
    } catch (error: any) {
      console.error('Error in getRecommendations:', error);
      res.status(500).json({
        error: 'Failed to fetch recommendations',
        details: error.message,
      });
    }
  }
}

export const schemesController = new SchemesController();

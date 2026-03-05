/**
 * Schemes Controller
 * Handles HTTP requests for government schemes
 * Reads from Neo4j graph (via SimilarityAgent) with sample-data fallback
 */

import { Request, Response } from 'express';
import { similarityAgent } from '../agents/similarity-agent';
import { sampleSchemes } from './sample-schemes';
import { neo4jService } from '../db/neo4j.service';

export class SchemesController {
  /**
   * GET /api/schemes
   * Fetch schemes with optional filters
   */
  async getSchemes(req: Request, res: Response) {
    try {
      const { q, limit = '20' } = req.query;
      const limitNum = Math.floor(Number(limit) || 20);

      try {
        const schemes = q
          ? await similarityAgent.searchSchemes(q as string, limitNum)
          : await similarityAgent.searchSchemes('', limitNum);

        res.json(
          schemes.map((s: any) => ({
            id: s.schemeId,
            title: s.name,
            description: s.description || 'No description available',
            category: s.rawCategory || s.categories?.[0]?.type || 'General',
            benefits: s.ministry || 'Government of India',
            eligibility: s.tags?.join(', ') || 'Check official website',
            applicationUrl: s.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${s.schemeId}`,
          }))
        );
      } catch (dbError) {
        console.log('Neo4j not ready, using sample data');
        let schemes = sampleSchemes as any[];
        if (q) {
          const lq = q.toString().toLowerCase();
          schemes = schemes.filter(
            (s) =>
              s.name.toLowerCase().includes(lq) ||
              s.description.toLowerCase().includes(lq) ||
              s.tags?.some((t: string) => t.toLowerCase().includes(lq))
          );
        }
        res.json(
          schemes.slice(0, limitNum).map((s) => ({
            id: s.schemeId,
            title: s.name,
            description: s.description || 'No description available',
            category: Array.isArray(s.category) ? s.category[0] : s.category || 'General',
            benefits: s.ministry || 'Government of India',
            eligibility: Array.isArray(s.tags) ? s.tags.join(', ') : 'Check official website',
          }))
        );
      }
    } catch (error: any) {
      console.error('Error in getSchemes:', error);
      res.status(500).json({ error: 'Failed to fetch schemes', details: error.message });
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
        const scheme = await similarityAgent.getSchemeById(schemeId);
        if (!scheme) return res.status(404).json({ error: 'Scheme not found' });

        return res.json({
          id: scheme.schemeId,
          title: scheme.name,
          description: scheme.description || 'No description available',
          category: scheme.rawCategory || scheme.categories?.[0]?.type || 'General',
          benefits: scheme.ministry || 'Government of India',
          eligibility: scheme.tags?.join(', ') || 'Check official website',
          applicationProcess: 'Visit the official government portal to apply',
          requiredDocuments: ['Aadhaar Card', 'Income Certificate', 'Residence Proof'],
          applicationUrl:
            scheme.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${scheme.schemeId}`,
        });
      } catch (dbError) {
        const scheme = sampleSchemes.find((s) => s.schemeId === schemeId);
        if (!scheme) return res.status(404).json({ error: 'Scheme not found' });

        return res.json({
          id: scheme.schemeId,
          title: scheme.name,
          description: scheme.description || 'No description available',
          category: Array.isArray(scheme.category) ? scheme.category[0] : 'General',
          benefits: scheme.ministry || 'Government of India',
          eligibility: Array.isArray(scheme.tags)
            ? scheme.tags.join(', ')
            : 'Check official website',
          applicationProcess: 'Visit the official government portal to apply',
          requiredDocuments: ['Aadhaar Card', 'Income Certificate', 'Residence Proof'],
          applicationUrl: `https://www.myscheme.gov.in/schemes/${scheme.schemeId}`,
        });
      }
    } catch (error: any) {
      console.error('Error in getSchemeById:', error);
      return res.status(500).json({ error: 'Failed to fetch scheme', details: error.message });
    }
  }

  /**
   * GET /api/schemes/categories
   * Get available scheme categories
   */
  async getCategories(_req: Request, res: Response) {
    try {
      const categories = await similarityAgent.getAllCategories();
      res.json({ categories });
    } catch (error: any) {
      console.error('Error in getCategories:', error);
      res.status(500).json({ error: 'Failed to fetch categories', details: error.message });
    }
  }

  /**
   * GET /api/schemes/stats
   * Get scheme statistics (total count, last sync time, category count)
   */
  async getStats(_req: Request, res: Response) {
    try {
      const [count, syncMeta, categories] = await Promise.all([
        neo4jService.getSchemeCount(),
        neo4jService.getSyncMeta(),
        similarityAgent.getAllCategories(),
      ]);

      const categoryCount = Object.keys(categories).length;

      return res.json({
        total: count,
        lastSync: syncMeta.last_sync,
        categories: categoryCount,
      });
    } catch (error: any) {
      console.error('Error in getStats:', error);
      return res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
  }

  /**
   * GET /api/users/:userId/recommendations
   * Get personalized scheme recommendations for a user
   */
  async getRecommendations(req: Request, res: Response) {
    try {
      const { userId } = req.params;

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

      res.json(
        matches.map((m) => ({
          id: m.schemeId,
          title: m.name,
          description: m.description || 'No description available',
          category: m.categories?.[0]?.type || 'General',
          benefits: m.ministry || 'Government of India',
          eligibilityScore: m.eligibilityScore,
          applicationUrl: m.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${m.schemeId}`,
        }))
      );
    } catch (error: any) {
      console.error('Error in getRecommendations:', error);
      res.status(500).json({ error: 'Failed to fetch recommendations', details: error.message });
    }
  }
}

export const schemesController = new SchemesController();

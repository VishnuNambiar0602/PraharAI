/**
 * Schemes Controller
 * Handles HTTP requests for government schemes
 * Reads from Neo4j graph (via SimilarityAgent) with sample-data fallback
 */

import { Request, Response } from 'express';
import { similarityAgent } from '../agents/similarity-agent';
import { sampleSchemes } from './sample-schemes';
import { neo4jService } from '../db/neo4j.service';
import { recommendationRankingService } from '../services/recommendation-ranking.service';

export class SchemesController {
  private toCleanList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item || '').trim()).filter((item) => item.length > 0);
  }

  private summarize(values: string[], max = 3, fallback = 'Check official website'): string {
    if (!values.length) return fallback;
    return values.slice(0, max).join(', ');
  }

  private primaryCategory(scheme: any): string {
    const raw = Array.isArray(scheme?.category) ? scheme.category : [];
    const firstRaw = raw.find((c: unknown) => String(c || '').trim().length > 0);
    if (firstRaw) return String(firstRaw);

    const mapped = Array.isArray(scheme?.categories) ? scheme.categories : [];
    const firstMapped = mapped.find((c: any) => c?.type && c?.value && c.value !== 'Any');
    if (firstMapped) return `${String(firstMapped.type)}:${String(firstMapped.value)}`;

    return 'General';
  }

  private mapSchemeForList(s: any) {
    const pageEligibility = this.toCleanList(s?.pageDetails?.eligibility);
    const pageBenefits = this.toCleanList(s?.pageDetails?.benefits);
    const tags = this.toCleanList(s?.tags);
    const title = String(s?.pageDetails?.title || s?.name || '').trim();
    const description = String(s?.pageDetails?.description || s?.description || '').trim();
    const ministry = String(
      s?.pageDetails?.ministry || s?.ministry || 'Government of India'
    ).trim();

    return {
      id: s.schemeId,
      title: title || 'Untitled Scheme',
      description: description || 'No description available',
      category: this.primaryCategory(s),
      benefits: this.summarize(pageBenefits, 2, ministry || 'Government of India'),
      eligibility: this.summarize(
        pageEligibility,
        3,
        this.summarize(tags, 4, 'Check official website')
      ),
      ministry,
      state: s.state || null,
      tags,
      rawCategories: Array.isArray(s?.category) ? s.category : [],
      matchedCategories: Array.isArray(s?.categories) ? s.categories : [],
      applicationUrl: s.schemeUrl ?? `https://www.myscheme.gov.in/schemes/${s.schemeId}`,
      enrichment: {
        hasPageDetails: Boolean(s?.pageDetails?.schemeId),
        enrichedAt: s?.pageDetails?.enrichedAt ?? null,
      },
      pageDetails: {
        schemeId: s?.pageDetails?.schemeId ?? null,
        title: s?.pageDetails?.title ?? null,
        ministry: s?.pageDetails?.ministry ?? null,
        description: s?.pageDetails?.description ?? null,
        eligibility: pageEligibility,
        benefits: pageBenefits,
        references: Array.isArray(s?.pageDetails?.references) ? s.pageDetails.references : [],
        applicationProcess: Array.isArray(s?.pageDetails?.applicationProcess)
          ? s.pageDetails.applicationProcess
          : [],
        eligibilityMarkdown: s?.pageDetails?.eligibilityMarkdown ?? null,
        benefitsMarkdown: s?.pageDetails?.benefitsMarkdown ?? null,
        descriptionMarkdown: s?.pageDetails?.descriptionMarkdown ?? null,
        exclusionsMarkdown: s?.pageDetails?.exclusionsMarkdown ?? null,
        raw: s?.pageDetails?.raw ?? null,
        enrichedAt: s?.pageDetails?.enrichedAt ?? null,
      },
    };
  }

  private mapSchemeForDetail(s: any) {
    const mapped = this.mapSchemeForList(s);
    return {
      ...mapped,
      eligibilityCriteria: mapped.pageDetails.eligibility,
      benefitsList: mapped.pageDetails.benefits,
    };
  }

  private mapSampleSchemeForList(s: any) {
    const tags = this.toCleanList(s?.tags);
    const rawCategories = Array.isArray(s?.category) ? s.category : [];
    return {
      id: s.schemeId,
      title: s.name,
      description: s.description || 'No description available',
      category: String(rawCategories[0] || 'General'),
      benefits: s.ministry || 'Government of India',
      eligibility: this.summarize(tags, 4, 'Check official website'),
      ministry: s.ministry || 'Government of India',
      state: s.state || null,
      tags,
      rawCategories,
      matchedCategories: [],
      applicationUrl: `https://www.myscheme.gov.in/schemes/${s.schemeId}`,
      enrichment: {
        hasPageDetails: false,
        enrichedAt: null,
      },
      pageDetails: {
        schemeId: null,
        title: null,
        ministry: null,
        description: null,
        eligibility: [],
        benefits: [],
        enrichedAt: null,
      },
    };
  }

  /**
   * GET /api/schemes
   * Fetch schemes with optional filters
   */
  async getSchemes(req: Request, res: Response) {
    try {
      const { q, limit = '20', page = '1' } = req.query;
      const limitNum = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
      const pageNum = Math.max(1, Math.floor(Number(page) || 1));
      const offset = (pageNum - 1) * limitNum;
      const query = typeof q === 'string' ? q.trim() : '';
      const wantsPaginated = req.query.paginated === 'true' || req.query.page !== undefined;

      try {
        const [schemes, total] = await Promise.all([
          similarityAgent.searchSchemes(query, limitNum, offset),
          neo4jService.countSearchSchemes(query),
        ]);

        const mapped = schemes.map((s: any) => this.mapSchemeForList(s));
        if (!wantsPaginated) {
          return res.json(mapped);
        }

        return res.json({
          items: mapped,
          total,
          page: pageNum,
          pageSize: limitNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        });
      } catch (dbError) {
        console.log('Neo4j not ready, using sample data');
        let schemes = sampleSchemes as any[];
        if (query) {
          const lq = query.toLowerCase();
          schemes = schemes.filter(
            (s) =>
              s.name.toLowerCase().includes(lq) ||
              s.description.toLowerCase().includes(lq) ||
              s.tags?.some((t: string) => t.toLowerCase().includes(lq))
          );
        }

        const total = schemes.length;
        const pageSlice = schemes.slice(offset, offset + limitNum);
        const mapped = pageSlice.map((s) => this.mapSampleSchemeForList(s));

        if (!wantsPaginated) {
          return res.json(mapped);
        }

        return res.json({
          items: mapped,
          total,
          page: pageNum,
          pageSize: limitNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
        });
      }
    } catch (error: any) {
      console.error('Error in getSchemes:', error);
      return res.status(500).json({ error: 'Failed to fetch schemes', details: error.message });
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

        return res.json(this.mapSchemeForDetail(scheme));
      } catch (dbError) {
        const scheme = sampleSchemes.find((s) => s.schemeId === schemeId);
        if (!scheme) return res.status(404).json({ error: 'Scheme not found' });

        const mapped = this.mapSampleSchemeForList(scheme);
        return res.json({
          ...mapped,
          eligibilityCriteria: [],
          benefitsList: [],
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
   * Get personalized scheme recommendations for a user.
   */
  async getRecommendations(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const count = Math.min(20, Math.max(1, Number(req.query.count) || 10));
      const includeMeta = String(req.query.includeMeta || '') === 'true';

      const ranked = await recommendationRankingService.generate(userId, count);
      const payload = ranked.recommendations.map((item) => ({
        id: item.schemeId,
        title: item.name,
        description: item.description,
        category: item.category,
        benefits: item.benefits,
        eligibilityScore: item.relevanceScore,
        applicationUrl: item.applicationUrl,
        explanation: item.explanation,
      }));

      console.log(
        JSON.stringify({
          event: 'recommendation_ranking',
          userId,
          source: ranked.meta.source,
          segment: ranked.meta.segment,
          metrics: ranked.meta.metrics,
        })
      );

      if (!includeMeta) {
        return res.json(payload);
      }

      return res.json({
        items: payload,
        meta: ranked.meta,
      });
    } catch (error: any) {
      console.error('Error in getRecommendations:', error);
      return res
        .status(500)
        .json({ error: 'Failed to fetch recommendations', details: error.message });
    }
  }

  /**
   * POST /api/users/:userId/recommendations/feedback
   * Capture recommendation feedback signals for future ranking improvements.
   */
  async postRecommendationFeedback(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { schemeId, action, source, rank, score } = req.body || {};

      if (!schemeId || typeof schemeId !== 'string') {
        return res.status(400).json({ error: 'schemeId is required' });
      }

      const allowed = new Set(['viewed', 'clicked', 'saved', 'applied', 'dismissed']);
      const normalizedAction = String(action || '')
        .trim()
        .toLowerCase();
      if (!allowed.has(normalizedAction)) {
        return res.status(400).json({
          error: 'action must be one of viewed, clicked, saved, applied, dismissed',
        });
      }

      await neo4jService.recordRecommendationFeedback({
        userId,
        schemeId: String(schemeId).trim(),
        action: normalizedAction,
        source: typeof source === 'string' ? source.trim() : undefined,
        rank: Number.isFinite(Number(rank)) ? Number(rank) : undefined,
        score: Number.isFinite(Number(score)) ? Number(score) : undefined,
      });

      return res.status(201).json({ success: true });
    } catch (error: any) {
      console.error('Error in postRecommendationFeedback:', error);
      return res.status(500).json({ error: 'Failed to record feedback', details: error.message });
    }
  }
}

export const schemesController = new SchemesController();

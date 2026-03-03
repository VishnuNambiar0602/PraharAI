/**
 * ML Service — HTTP client for the Python ML microservice (T-09)
 *
 * Connects to ml-pipeline/api.py running on port 8000.
 * All calls have a timeout + fallback so the backend never blocks.
 *
 * Endpoints used:
 *   POST /classify    — intent classification + entity extraction
 *   POST /recommend   — ranked scheme recommendations
 *   POST /eligibility — eligibility score for a user-scheme pair
 *   GET  /health      — service health
 */

const ML_BASE = process.env.ML_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT_MS = 3000; // 3 s — if ML is slow we fall back instantly

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClassifyResult {
  primary_intent: string; // scheme_search | eligibility_check | application_info | ...
  confidence: number;
  entities: Record<string, any>; // { age: 25, state: "Gujarat", ... }
  secondary_intents: string[];
}

export interface RecommendResult {
  recommendations: Array<{
    id?: string;
    schemeId?: string;
    name: string;
    relevanceScore: number;
    [key: string]: any;
  }>;
  total: number;
  cached: boolean;
}

export interface EligibilityResult {
  scheme_id: string;
  score: number;         // 0.0 – 1.0
  percentage: number;    // 0 – 100
  category: string;      // highly_eligible | potentially_eligible | low_eligibility
  met_criteria: string[];
  unmet_criteria: string[];
  explanation: string;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function postWithTimeout<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null; // timeout or connection refused
  } finally {
    clearTimeout(timer);
  }
}

async function getWithTimeout<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class MLService {
  private _available: boolean | null = null; // null = not checked yet
  private _lastCheck = 0;
  private readonly HEALTH_CACHE_MS = 30_000; // re-check every 30 s

  /** Quick availability probe — cached */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this._available !== null && now - this._lastCheck < this.HEALTH_CACHE_MS) {
      return this._available;
    }
    const result = await getWithTimeout('/health');
    this._available = result !== null;
    this._lastCheck = now;
    if (this._available) console.log('✅ ML service available at', ML_BASE);
    return this._available;
  }

  /**
   * Classify intent of a user message.
   * Returns null if ML service is unavailable.
   */
  async classify(message: string, userId?: string): Promise<ClassifyResult | null> {
    return postWithTimeout<ClassifyResult>('/classify', { message, user_id: userId });
  }

  /**
   * Generate ML-ranked recommendations from a list of candidate schemes.
   * Returns null if ML service is unavailable.
   */
  async recommend(
    userProfile: Record<string, any>,
    schemes: any[],
    maxResults = 10
  ): Promise<RecommendResult | null> {
    return postWithTimeout<RecommendResult>('/recommend', {
      user_profile: userProfile,
      schemes,
      max_results: maxResults,
      min_score: 0.2,
    });
  }

  /**
   * Calculate eligibility score for a single user-scheme pair.
   * Returns null if ML service is unavailable.
   */
  async eligibility(
    userProfile: Record<string, any>,
    scheme: Record<string, any>
  ): Promise<EligibilityResult | null> {
    return postWithTimeout<EligibilityResult>('/eligibility', {
      user_profile: userProfile,
      scheme,
    });
  }
}

export const mlService = new MLService();

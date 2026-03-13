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
const TIMEOUT_MS = 15000; // 15 s — /chat does a roundtrip through backend schemes API + Neo4j

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
    scheme_id?: string;
    name: string;
    scheme_name?: string;
    relevanceScore?: number;
    relevance_score?: number;
    [key: string]: any;
  }>;
  total: number;
  cached: boolean;
}

export interface ChatResult {
  response: string;
  suggestions: string[];
  extracted_entities?: Record<string, any>;
}

export interface MLServiceStatus {
  baseUrl: string;
  timeoutMs: number;
  available: boolean | null;
  lastCheckAt: string | null;
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open';
    consecutiveFailures: number;
    openUntil: string | null;
  };
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Normalize backend profile to ML user_profile schema.
 * Backend -> ML should prefer snake_case keys at boundary.
 */
function normalizeUserProfile(userProfile: Record<string, any>): Record<string, any> {
  const userId = userProfile.user_id ?? userProfile.userId ?? userProfile.id ?? '';
  const annualIncome = userProfile.annual_income ?? userProfile.income ?? 0;
  const occupation = userProfile.occupation ?? userProfile.employment ?? '';
  const educationLevel = userProfile.education_level ?? userProfile.education ?? '';
  const isDisabled =
    userProfile.is_disabled ?? userProfile.disability ?? userProfile.isDisabled ?? false;
  const isMinority = userProfile.is_minority ?? userProfile.minority ?? userProfile.isMinority;

  return {
    user_id: String(userId || ''),
    name: userProfile.name ?? null,
    email: userProfile.email ?? null,
    age: toNumber(userProfile.age, 0),
    state: userProfile.state ?? '',
    gender: userProfile.gender ?? null,
    annual_income: toNumber(annualIncome, 0),
    occupation: occupation ?? '',
    education_level: educationLevel ?? '',
    disability: Boolean(isDisabled),
    is_disabled: Boolean(isDisabled),
    ...(isMinority !== undefined ? { is_minority: Boolean(isMinority) } : {}),

    // New high/medium impact fields
    marital_status: userProfile.marital_status ?? userProfile.maritalStatus ?? null,
    family_size: toNumber(userProfile.family_size ?? userProfile.familySize, 0),
    rural_urban: userProfile.rural_urban ?? userProfile.residenceType ?? null,
    poverty_status: userProfile.poverty_status ?? userProfile.povertyStatus ?? null,
    ration_card: userProfile.ration_card ?? userProfile.rationCard ?? null,
    land_ownership: userProfile.land_ownership ?? userProfile.landOwnership ?? null,
    district: userProfile.district ?? null,
    disability_type: userProfile.disability_type ?? userProfile.disabilityType ?? null,
    minority_community: userProfile.minority_community ?? userProfile.minorityCommunity ?? null,
    social_category: userProfile.social_category ?? userProfile.socialCategory ?? null,
    interests: userProfile.interests ?? null,

    // Compatibility aliases consumed by some current ML chat heuristics.
    income: toNumber(annualIncome, 0),
    employment: occupation ?? '',
    education: educationLevel ?? '',
  };
}

function normalizeRecommendationResult(result: RecommendResult | null): RecommendResult | null {
  if (!result) return null;
  return {
    total: toNumber(result.total, 0),
    cached: Boolean(result.cached),
    recommendations: (result.recommendations || []).map((rec) => {
      const resolvedId = rec.id ?? rec.schemeId ?? rec.scheme_id ?? '';
      const resolvedScore = toNumber(rec.relevanceScore ?? rec.relevance_score, 0);
      const resolvedName = rec.name ?? rec.scheme_name ?? '';
      return {
        ...rec,
        name: resolvedName,
        id: resolvedId,
        schemeId: rec.schemeId ?? rec.scheme_id ?? resolvedId,
        relevanceScore: resolvedScore,
      };
    }),
  };
}

export interface EligibilityResult {
  scheme_id: string;
  score: number; // 0.0 – 1.0
  percentage: number; // 0 – 100
  category: string; // highly_eligible | potentially_eligible | low_eligibility
  met_criteria: string[];
  unmet_criteria: string[];
  explanation: string;
}

// ─── HTTP helper ──────────────────────────────────────────────────────────────

async function postWithTimeout<T>(path: string, body: unknown): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(`${ML_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) {
      console.warn(`⚠️ ML call failed: POST ${path} status=${res.status} latencyMs=${latencyMs}`);
      return null;
    }
    console.log(`✅ ML call succeeded: POST ${path} latencyMs=${latencyMs}`);
    return res.json() as Promise<T>;
  } catch {
    const latencyMs = Date.now() - startedAt;
    console.warn(`⚠️ ML call error: POST ${path} latencyMs=${latencyMs}`);
    return null; // timeout or connection refused
  } finally {
    clearTimeout(timer);
  }
}

async function getWithTimeout<T>(path: string): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(`${ML_BASE}${path}`, { signal: controller.signal });
    const latencyMs = Date.now() - startedAt;
    if (!res.ok) {
      console.warn(`⚠️ ML call failed: GET ${path} status=${res.status} latencyMs=${latencyMs}`);
      return null;
    }
    console.log(`✅ ML call succeeded: GET ${path} latencyMs=${latencyMs}`);
    return res.json() as Promise<T>;
  } catch {
    const latencyMs = Date.now() - startedAt;
    console.warn(`⚠️ ML call error: GET ${path} latencyMs=${latencyMs}`);
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
  private breakerState: 'closed' | 'open' | 'half-open' = 'closed';
  private consecutiveFailures = 0;
  private openUntilMs = 0;
  private readonly BREAKER_FAILURE_THRESHOLD = Number(process.env.ML_CB_FAILURES || 3);
  private readonly BREAKER_OPEN_MS = Number(process.env.ML_CB_OPEN_MS || 30000);

  private canCallML(): boolean {
    const now = Date.now();
    if (this.breakerState === 'open') {
      if (now >= this.openUntilMs) {
        this.breakerState = 'half-open';
        return true;
      }
      return false;
    }
    return true;
  }

  private noteSuccess(): void {
    this.consecutiveFailures = 0;
    this.breakerState = 'closed';
    this.openUntilMs = 0;
  }

  private noteFailure(): void {
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.BREAKER_FAILURE_THRESHOLD) {
      this.breakerState = 'open';
      this.openUntilMs = Date.now() + this.BREAKER_OPEN_MS;
    }
  }

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

  getStatus(): MLServiceStatus {
    return {
      baseUrl: ML_BASE,
      timeoutMs: TIMEOUT_MS,
      available: this._available,
      lastCheckAt: this._lastCheck > 0 ? new Date(this._lastCheck).toISOString() : null,
      circuitBreaker: {
        state: this.breakerState,
        consecutiveFailures: this.consecutiveFailures,
        openUntil: this.openUntilMs > 0 ? new Date(this.openUntilMs).toISOString() : null,
      },
    };
  }

  /**
   * Classify intent of a user message.
   * Returns null if ML service is unavailable.
   */
  async classify(message: string, userId?: string): Promise<ClassifyResult | null> {
    if (!this.canCallML()) return null;
    const result = await postWithTimeout<ClassifyResult>('/classify', { message, user_id: userId });
    if (result) this.noteSuccess();
    else this.noteFailure();
    return result;
  }

  /**
   * Generate ML-ranked recommendations from a list of candidate schemes.
   * Returns null if ML service is unavailable.
   */
  async recommend(
    userProfile: Record<string, any>,
    schemes: any[],
    maxResults = 10,
    minScore = 0.2
  ): Promise<RecommendResult | null> {
    if (!this.canCallML()) return null;
    const result = await postWithTimeout<RecommendResult>('/recommend', {
      user_profile: normalizeUserProfile(userProfile),
      schemes,
      max_results: maxResults,
      min_score: minScore,
    });
    if (result) this.noteSuccess();
    else this.noteFailure();
    return normalizeRecommendationResult(result);
  }

  /**
   * Calculate eligibility score for a single user-scheme pair.
   * Returns null if ML service is unavailable.
   */
  async eligibility(
    userProfile: Record<string, any>,
    scheme: Record<string, any>
  ): Promise<EligibilityResult | null> {
    if (!this.canCallML()) return null;
    const result = await postWithTimeout<EligibilityResult>('/eligibility', {
      user_profile: normalizeUserProfile(userProfile),
      scheme,
    });
    if (result) this.noteSuccess();
    else this.noteFailure();
    return result;
  }

  /**
   * Process conversational response from ML chat endpoint.
   * Returns null when ML is unavailable or times out.
   */
  async chat(
    message: string,
    userProfile: Record<string, any>,
    conversationHistory: Array<{ role: string; content: string }> = []
  ): Promise<ChatResult | null> {
    if (!this.canCallML()) return null;
    const result = await postWithTimeout<ChatResult>('/chat', {
      message,
      user_profile: normalizeUserProfile(userProfile),
      conversation_history: conversationHistory,
    });
    if (result) this.noteSuccess();
    else this.noteFailure();
    return result;
  }
}

export const mlService = new MLService();

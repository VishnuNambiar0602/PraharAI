/**
 * Panchayat Dashboard API Service
 * Panchayat users authenticate with email/password and receive a JWT token.
 */

const API_BASE = '/api';

const TOKEN_KEY = 'panchayatToken';
const USER_KEY = 'panchayatUser';

export class PanchayatSessionError extends Error {
  constructor(message = 'Your panchayat session has expired. Please sign in again.') {
    super(message);
    this.name = 'PanchayatSessionError';
  }
}

export interface PanchayatUser {
  userId: string;
  email: string;
  name: string;
  panchayatName: string;
  district: string;
  state: string;
}

function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) || '';
}

function setPanchayatUser(user: PanchayatUser): PanchayatUser {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

async function panchayatFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    headers: {
      ...authHeaders(),
      ...(init.headers || {}),
    },
  });

  if (res.status === 401 || res.status === 403) {
    clearSession();
    const body = await res.json().catch(() => ({}));
    throw new PanchayatSessionError((body as any).error || undefined);
  }

  return res;
}

function normalizeBeneficiary(raw: any): import('./types').Beneficiary {
  const panchayatName = raw.panchayatName ?? raw.panchayat_name ?? raw.village ?? undefined;

  return {
    ...raw,
    userId: raw.userId ?? raw.user_id ?? '',
    createdAt: raw.createdAt ?? raw.created_at ?? '',
    onboardingComplete: Boolean(raw.onboardingComplete ?? raw.onboarding_complete),
    village: raw.village ?? panchayatName,
    panchayatName,
  };
}

// ─── Authentication ───────────────────────────────────────────

export async function panchayatLogin(email: string, password: string): Promise<PanchayatUser> {
  const res = await fetch(`${API_BASE}/panchayat/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Login failed');
  }
  const data = await res.json();
  localStorage.setItem(TOKEN_KEY, data.token);
  return setPanchayatUser(data.user as PanchayatUser);
}

export async function getCurrentPanchayatUser(): Promise<PanchayatUser> {
  const res = await panchayatFetch(`${API_BASE}/panchayat/me`, {
    method: 'GET',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).error || 'Failed to fetch panchayat profile');
  }
  const user = (await res.json()) as PanchayatUser;
  return setPanchayatUser(user);
}

export function getPanchayatUser(): PanchayatUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as PanchayatUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// ─── Dashboard Stats ──────────────────────────────────────────
// (kept for backwards compat but prefer getPanchayatScopedStats)
export async function getDashboardStats() {
  return getPanchayatScopedStats();
}

// ─── Panchayat-scoped stats ──────────────────────────────────

export async function getPanchayatScopedStats() {
  const res = await panchayatFetch(`${API_BASE}/panchayat/stats`);
  if (!res.ok) throw new Error('Failed to fetch panchayat stats');
  return res.json();
}

// ─── Panchayat-scoped citizens ────────────────────────────────

export async function getPanchayatCitizens(params?: {
  q?: string;
  page?: number;
  limit?: number;
  onboarding?: 'all' | 'complete' | 'pending';
}): Promise<import('./types').PanchayatCitizenListResponse> {
  const query = new URLSearchParams();
  if (params?.q) query.set('q', params.q);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.onboarding && params.onboarding !== 'all') {
    query.set('onboarding', params.onboarding);
  }

  const queryString = query.toString();
  const url = queryString
    ? `${API_BASE}/panchayat/citizens?${queryString}`
    : `${API_BASE}/panchayat/citizens`;
  const res = await panchayatFetch(url);
  if (!res.ok) throw new Error('Failed to fetch citizens');

  const body = await res.json();
  return {
    items: Array.isArray(body.items) ? body.items.map(normalizeBeneficiary) : [],
    total: Number(body.total) || 0,
    page: Number(body.page) || params?.page || 1,
    limit: Number(body.limit) || params?.limit || 20,
    hasMore: Boolean(body.hasMore),
  };
}

export async function registerCitizen(data: {
  name: string;
  email: string;
  age?: number;
  gender?: string;
  employment?: string;
  income?: string;
  education?: string;
}): Promise<{ citizenId: string; message: string }> {
  const res = await panchayatFetch(`${API_BASE}/panchayat/citizens`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  const body = await res.json();
  if (!res.ok) throw new Error((body as any).error || 'Failed to register citizen');
  return body;
}

// ─── Beneficiaries (all, admin-level – kept for backwards compat) ─────────────

export async function getAllBeneficiaries() {
  const res = await panchayatFetch(`${API_BASE}/admin/users`);
  if (!res.ok) throw new Error('Failed to fetch beneficiaries');
  return res.json();
}

export async function deleteBeneficiary(userId: string): Promise<void> {
  const res = await panchayatFetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete beneficiary');
}

// ─── Schemes ──────────────────────────────────────────────────

export async function getSchemes(params?: {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('q', params.search);
  if (params?.category) query.set('category', params.category);
  const res = await panchayatFetch(`${API_BASE}/schemes?${query}`);
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json();
}

// ─── Sync status ──────────────────────────────────────────────

export async function getSyncStatus() {
  const res = await panchayatFetch(`${API_BASE}/admin/sync/status`);
  if (!res.ok) throw new Error('Failed to fetch sync status');
  return res.json();
}

export async function triggerSync() {
  const res = await panchayatFetch(`${API_BASE}/admin/sync`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to trigger sync');
  return res.json();
}

// ─── Health (not shown in panchayat UI) ─────────────────────

export async function getSystemHealth() {
  const res = await panchayatFetch(`${API_BASE}/admin/health`);
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

// ─── Analytics (panchayat-scoped local derivation) ───────────

export async function getAnalytics(): Promise<import('./types').AnalyticsData> {
  const res = await panchayatFetch(`${API_BASE}/panchayat/analytics`);
  if (!res.ok) throw new Error('Failed to fetch analytics');
  const raw = await res.json();
  const summary = raw.summary ?? {};
  const trends = raw.trends ?? {};
  const dist = raw.distribution ?? {};

  const toDistEntry = (arr: any[], labelKey: string): import('./types').DistributionEntry[] => {
    const total = arr.reduce((s: number, e: any) => s + (Number(e.count) || 0), 0) || 1;
    return arr.map((e: any) => ({
      label: String(e[labelKey] ?? ''),
      count: Number(e.count) || 0,
      percentage: Math.round(((Number(e.count) || 0) / total) * 100),
    }));
  };

  const fmtDate = (d: string) => {
    const dt = new Date(d);
    return isNaN(dt.getTime())
      ? d
      : dt.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  };

  return {
    totalCitizens: summary.totalCitizens ?? 0,
    onboardedCitizens: summary.onboardedCitizens ?? 0,
    pendingCitizens: summary.pendingCitizens ?? 0,
    totalSchemes: summary.totalSchemes ?? 0,
    enrichedSchemes: summary.enrichedSchemes ?? 0,
    enrichmentRate: summary.enrichmentRate ?? 0,
    state: summary.state ?? '',
    district: summary.district ?? '',
    panchayatName: summary.panchayatName ?? '',
    employmentDistribution: toDistEntry(dist.byEmployment ?? [], 'employment'),
    genderDistribution: toDistEntry(dist.byGender ?? [], 'gender'),
    registrationTrend: (trends.registrations ?? []).map((entry: any) => ({
      day: fmtDate(entry.date),
      count: Number(entry.count) || 0,
    })),
  };
}

// ─── AI Scheme Recommendations for a beneficiary ─────────────

export async function getRecommendationsForBeneficiary(userId: string) {
  const res = await panchayatFetch(
    `${API_BASE}/users/${encodeURIComponent(userId)}/recommendations`
  );
  if (!res.ok) throw new Error('Failed to get recommendations');
  return res.json();
}

// ─── Activity logs (not used in panchayat UI) ───────────────

export async function getActivityLogs() {
  const res = await panchayatFetch(`${API_BASE}/admin/activity`);
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
}

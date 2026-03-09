/**
 * Panchayat Dashboard API Service
 * Panchayat users authenticate with email/password and receive a JWT token.
 */

const API_BASE = '/api';

const TOKEN_KEY = 'panchayatToken';
const USER_KEY = 'panchayatUser';

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

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
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
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user as PanchayatUser;
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

export async function getDashboardStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

// ─── Beneficiaries (users) ────────────────────────────────────

export async function getAllBeneficiaries() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch beneficiaries');
  return res.json();
}

export async function deleteBeneficiary(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
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
  const res = await fetch(`${API_BASE}/schemes?${query}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json();
}

// ─── Sync status ──────────────────────────────────────────────

export async function getSyncStatus() {
  const res = await fetch(`${API_BASE}/admin/sync/status`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch sync status');
  return res.json();
}

export async function triggerSync() {
  const res = await fetch(`${API_BASE}/admin/sync`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to trigger sync');
  return res.json();
}

// ─── Health ───────────────────────────────────────────────────

export async function getSystemHealth() {
  const res = await fetch(`${API_BASE}/admin/health`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

// ─── Analytics ────────────────────────────────────────────────

export async function getAnalytics(): Promise<import('./types').AnalyticsData> {
  const res = await fetch(`${API_BASE}/panchayat/analytics`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  const raw = await res.json();

  // Backend shape: { summary, trends: { users[], sync[] }, distribution: { byState[], byEmployment[] } }
  const summary = raw.summary ?? {};
  const trends = raw.trends ?? {};
  const dist = raw.distribution ?? {};

  const totalUsers: number = summary.totalUsers ?? 0;
  const totalSchemes: number = summary.totalSchemes ?? 0;

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
    totalUsers,
    totalSchemes,
    enrichedSchemes: summary.enrichedSchemes ?? 0,
    activeSchemes: totalSchemes,
    stateDistribution: toDistEntry(dist.byState ?? [], 'state'),
    employmentDistribution: toDistEntry(dist.byEmployment ?? [], 'employment'),
    userGrowthTrend: (trends.users ?? []).map((u: any) => ({
      month: fmtDate(u.date),
      users: Number(u.count) || 0,
    })),
    schemeSyncTrend: (trends.sync ?? []).map((s: any) => ({
      month: fmtDate(s.date),
      schemes: Number(s.synced) || 0,
    })),
  };
}

// ─── AI Scheme Recommendations for a beneficiary ─────────────

export async function getRecommendationsForBeneficiary(userId: string) {
  const res = await fetch(`${API_BASE}/users/${encodeURIComponent(userId)}/recommendations`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to get recommendations');
  return res.json();
}

// ─── Activity logs ────────────────────────────────────────────

export async function getActivityLogs() {
  const res = await fetch(`${API_BASE}/admin/activity`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
}

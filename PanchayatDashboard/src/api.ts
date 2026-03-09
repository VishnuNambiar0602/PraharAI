/**
 * Panchayat Dashboard API Service
 * Uses the same admin credentials / backend as the central admin panel
 */

const API_BASE = '/api';

function getAdminKey(): string {
  return localStorage.getItem('panchayatKey') || '';
}

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  return key ? { 'X-Admin-Key': key } : {};
}

// ─── Authentication ───────────────────────────────────────────

export async function verifyAdminKey(key: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/sync/status`, {
      headers: { 'X-Admin-Key': key },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function saveAdminKey(key: string): void {
  localStorage.setItem('panchayatKey', key);
}

export function clearAdminKey(): void {
  localStorage.removeItem('panchayatKey');
}

export function isAuthenticated(): boolean {
  return !!getAdminKey();
}

// ─── Dashboard Stats ──────────────────────────────────────────

export async function getDashboardStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

// ─── Beneficiaries (users) ────────────────────────────────────

export async function getAllBeneficiaries() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch beneficiaries');
  return res.json();
}

export async function deleteBeneficiary(userId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to delete beneficiary');
}

// ─── Schemes ──────────────────────────────────────────────────

export async function getSchemes(params?: { page?: number; limit?: number; search?: string; category?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));
  if (params?.search) query.set('search', params.search);
  if (params?.category) query.set('category', params.category);
  const res = await fetch(`${API_BASE}/admin/schemes?${query}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json();
}

// ─── Sync status ──────────────────────────────────────────────

export async function getSyncStatus() {
  const res = await fetch(`${API_BASE}/admin/sync/status`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch sync status');
  return res.json();
}

export async function triggerSync() {
  const res = await fetch(`${API_BASE}/admin/sync`, {
    method: 'POST',
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to trigger sync');
  return res.json();
}

// ─── Health ───────────────────────────────────────────────────

export async function getSystemHealth() {
  const res = await fetch(`${API_BASE}/admin/health`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

// ─── Analytics ────────────────────────────────────────────────

export async function getAnalytics() {
  const res = await fetch(`${API_BASE}/admin/analytics`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

// ─── Activity logs ────────────────────────────────────────────

export async function getActivityLogs() {
  const res = await fetch(`${API_BASE}/admin/activity`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
}

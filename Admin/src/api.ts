/**
 * Admin API Service
 * Connects to backend API with admin authentication
 */

const API_BASE = '/api';

// Admin key from environment or localStorage
function getAdminKey(): string {
  return localStorage.getItem('adminKey') || '';
}

function adminHeaders(): Record<string, string> {
  const key = getAdminKey();
  return key ? { 'X-Admin-Key': key } : {};
}

// ─── Authentication ──────────────────────────────────────────────────────────

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
  localStorage.setItem('adminKey', key);
}

export function clearAdminKey(): void {
  localStorage.removeItem('adminKey');
}

export function isAuthenticated(): boolean {
  return !!getAdminKey();
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const res = await fetch(`${API_BASE}/admin/stats`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch dashboard stats');
  return res.json();
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getAllUsers() {
  const res = await fetch(`${API_BASE}/admin/users`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}

export async function getUserById(userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch user');
  return res.json();
}

export async function deleteUser(userId: string) {
  const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to delete user');
  return res.json();
}

// ─── Schemes ─────────────────────────────────────────────────────────────────

export async function getAllSchemes(limit = 100) {
  const res = await fetch(`${API_BASE}/schemes?limit=${limit}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json();
}

export async function getSchemeById(schemeId: string) {
  const res = await fetch(`${API_BASE}/schemes/${schemeId}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch scheme');
  return res.json();
}

export async function updateScheme(schemeId: string, data: any) {
  const res = await fetch(`${API_BASE}/admin/schemes/${schemeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...adminHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update scheme');
  return res.json();
}

export async function deleteScheme(schemeId: string) {
  const res = await fetch(`${API_BASE}/admin/schemes/${schemeId}`, {
    method: 'DELETE',
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to delete scheme');
  return res.json();
}

// ─── Sync Management ─────────────────────────────────────────────────────────

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

// ─── User Groups ─────────────────────────────────────────────────────────────

export async function getUserGroups() {
  const res = await fetch(`${API_BASE}/admin/user-groups`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch user groups');
  return res.json();
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function getAnalytics(days = 30) {
  const res = await fetch(`${API_BASE}/admin/analytics?days=${days}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  return res.json();
}

// ─── Activity Logs ───────────────────────────────────────────────────────────

export async function getActivityLogs(limit = 50) {
  const res = await fetch(`${API_BASE}/admin/activity?limit=${limit}`, {
    headers: { ...adminHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch activity logs');
  return res.json();
}

// ─── System Health ───────────────────────────────────────────────────────────

export async function getSystemHealth() {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('Failed to fetch system health');
  return res.json();
}

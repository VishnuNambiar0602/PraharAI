/**
 * API Service — connects frontend_new to the backend at /api (proxied via Vite)
 */

const API_BASE = '/api';

function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('accessToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginUser(email: string, password: string) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Login failed' }));
    throw new Error(err.error || 'Login failed');
  }
  return res.json(); // { user, accessToken, refreshToken }
}

export async function registerUser(data: {
  email: string;
  password: string;
  name: string;
  age?: number;
  income?: number;
  state?: string;
  gender?: string;
}) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }));
    throw new Error(err.error || 'Registration failed');
  }
  return res.json();
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getProfile(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/profile`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function updateProfile(userId: string, data: Record<string, any>) {
  const res = await fetch(`${API_BASE}/users/${userId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}

// ─── Schemes ─────────────────────────────────────────────────────────────────

export async function fetchSchemes(params?: Record<string, string> | string, limit = 20) {
  const urlParams = new URLSearchParams();
  if (typeof params === 'string') {
    if (params) urlParams.set('q', params);
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) urlParams.set(k, v);
    });
  }
  urlParams.set('limit', String(limit));

  const res = await fetch(`${API_BASE}/schemes?${urlParams}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json(); // array of { id, title, description, category, benefits, eligibility }
}

export async function fetchSchemesPage(
  params?: Record<string, string> | string,
  page = 1,
  limit = 12
) {
  const urlParams = new URLSearchParams();
  if (typeof params === 'string') {
    if (params) urlParams.set('q', params);
  } else if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v) urlParams.set(k, v);
    });
  }
  urlParams.set('page', String(page));
  urlParams.set('limit', String(limit));
  urlParams.set('paginated', 'true');

  const res = await fetch(`${API_BASE}/schemes?${urlParams}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch schemes');
  return res.json() as Promise<{
    items: Array<Record<string, any>>;
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }>;
}

export async function fetchSchemeById(id: string) {
  const res = await fetch(`${API_BASE}/schemes/${id}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Scheme not found');
  return res.json();
}

export async function fetchRecommendations(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/recommendations`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json();
}

// ─── Chat ────────────────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  conversationHistory: { role: string; content: string }[] = []
) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ message, conversationHistory }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json(); // { response, suggestions? }
}

// ─── Nudges ──────────────────────────────────────────────────────────────────

export async function fetchNudges(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/nudges`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch nudges');
  return res.json();
}

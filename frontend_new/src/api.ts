/**
 * API Service — connects frontend_new to the backend at /api (proxied via Vite)
 */

import { Scheme, SchemePageDetails } from './types';

const API_BASE = '/api';

export interface RecommendationApiItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  benefits?: string;
  eligibility?: string;
  applicationUrl?: string;
  eligibilityScore?: number;
}

export interface ChatApiResponse {
  response: string;
  suggestions?: string[];
  degraded?: boolean;
}

function cleanText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function canonicalKey(value: string): string {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dedupeStringList(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const rawValue of values) {
    const value = cleanText(rawValue);
    if (!value) continue;
    const key = canonicalKey(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }

  return output;
}

function parseJsonIfString(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return dedupeStringList(
      value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
    );
  }
  if (typeof value === 'string' && value.trim()) {
    return dedupeStringList(
      cleanText(value)
        .split(/\n|,/) 
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }
  return [];
}

function normalizeReferences(value: unknown): Array<{ title: string; url: string }> {
  const parsed = parseJsonIfString(value);
  if (!Array.isArray(parsed)) return [];

  const refs = parsed
    .map((ref) => {
      if (!ref || typeof ref !== 'object') return null;
      const castRef = ref as Record<string, unknown>;
      const title = typeof castRef.title === 'string' ? cleanText(castRef.title) : '';
      const url = typeof castRef.url === 'string' ? cleanText(castRef.url) : '';
      return title && url ? { title, url } : null;
    })
    .filter((ref): ref is { title: string; url: string } => Boolean(ref));

  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = ref.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function markdownToSteps(markdown: string): string[] {
  const content = cleanText(markdown);
  const lines = content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const steps = dedupeStringList(
    lines
    .map((line) =>
      line
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+[.)]\s+/, '')
        .replace(/^\*\*Step\s*\d+\s*:\*\*/i, '')
        .replace(/^Step\s*\d+\s*:/i, '')
        .replace(/^#+\s*/, '')
        .replace(/^>\s*/, '')
        .replace(/^[*_]{2,}|[*_]{2,}$/g, '')
        .trim()
    )
    .filter(Boolean)
  );

  return steps;
}

function normalizeApplicationProcess(value: unknown): Array<{ mode: string; markdown: string; steps: string[] }> {
  const parsed = parseJsonIfString(value);

  if (Array.isArray(parsed)) {
    return parsed
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          if (typeof entry === 'string') {
            return { mode: 'General', markdown: '', steps: [entry] };
          }
          return null;
        }

        const castEntry = entry as Record<string, unknown>;
        const mode = typeof castEntry.mode === 'string' ? castEntry.mode : 'General';
        const markdown = typeof castEntry.markdown === 'string' ? castEntry.markdown : '';
        const explicitSteps = toStringArray(castEntry.steps);
        const steps = explicitSteps.length > 0 ? explicitSteps : markdownToSteps(markdown);

        return { mode, markdown, steps };
      })
      .filter((entry): entry is { mode: string; markdown: string; steps: string[] } => Boolean(entry));
  }

  if (parsed && typeof parsed === 'object') {
    const castObj = parsed as Record<string, unknown>;

    // Single structured object: { mode, steps, markdown }
    if ('mode' in castObj || 'steps' in castObj || 'markdown' in castObj) {
      return [
        {
          mode: typeof castObj.mode === 'string' ? castObj.mode : 'General',
          markdown: typeof castObj.markdown === 'string' ? castObj.markdown : '',
          steps:
            toStringArray(castObj.steps).length > 0
              ? toStringArray(castObj.steps)
              : markdownToSteps(typeof castObj.markdown === 'string' ? castObj.markdown : ''),
        },
      ];
    }

    // Mode-keyed object variants: { Offline: [...] } or { Offline: { steps, markdown } }
    return Object.entries(castObj)
      .map(([mode, modeValue]) => {
        if (typeof modeValue === 'string') {
          return { mode, markdown: modeValue, steps: markdownToSteps(modeValue) };
        }
        if (Array.isArray(modeValue)) {
          return { mode, markdown: '', steps: toStringArray(modeValue) };
        }
        if (modeValue && typeof modeValue === 'object') {
          const castModeValue = modeValue as Record<string, unknown>;
          const modeMarkdown = typeof castModeValue.markdown === 'string' ? castModeValue.markdown : '';
          const modeSteps = toStringArray(castModeValue.steps);
          return {
            mode,
            markdown: modeMarkdown,
            steps: modeSteps.length > 0 ? modeSteps : markdownToSteps(modeMarkdown),
          };
        }
        return null;
      })
      .filter((entry): entry is { mode: string; markdown: string; steps: string[] } => Boolean(entry));
  }

  return [];
}

function normalizePageDetails(value: unknown): SchemePageDetails | undefined {
  const parsedValue = parseJsonIfString(value);
  if (!parsedValue || typeof parsedValue !== 'object') return undefined;

  const details = parsedValue as Record<string, unknown>;
  return {
    schemeId: typeof details.schemeId === 'string' ? details.schemeId : null,
    title: typeof details.title === 'string' ? details.title : null,
    ministry: typeof details.ministry === 'string' ? details.ministry : null,
    description: typeof details.description === 'string' ? details.description : null,
    eligibility: toStringArray(details.eligibility),
    benefits: toStringArray(details.benefits),
    references: normalizeReferences(details.references),
    applicationProcess: normalizeApplicationProcess(details.applicationProcess),
    eligibilityMarkdown:
      details.eligibilityMarkdown === null || typeof details.eligibilityMarkdown === 'string'
        ? (details.eligibilityMarkdown as string | null)
        : undefined,
    benefitsMarkdown:
      details.benefitsMarkdown === null || typeof details.benefitsMarkdown === 'string'
        ? (details.benefitsMarkdown as string | null)
        : undefined,
    descriptionMarkdown:
      details.descriptionMarkdown === null || typeof details.descriptionMarkdown === 'string'
        ? (details.descriptionMarkdown as string | null)
        : undefined,
    exclusionsMarkdown:
      details.exclusionsMarkdown === null || typeof details.exclusionsMarkdown === 'string'
        ? (details.exclusionsMarkdown as string | null)
        : undefined,
    raw: details.raw && typeof details.raw === 'object' ? (details.raw as Record<string, unknown>) : undefined,
    enrichedAt:
      details.enrichedAt === null || typeof details.enrichedAt === 'string'
        ? (details.enrichedAt as string | null)
        : undefined,
  };
}

function normalizeScheme(item: unknown): Scheme {
  const data = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
  const pageDetails = normalizePageDetails(data.pageDetails);
  const topLevelApplicationProcess = normalizeApplicationProcess(data.applicationProcess);
  const topLevelReferences = normalizeReferences(data.references);
  const normalizedPageDetails = pageDetails
    ? {
        ...pageDetails,
        references:
          pageDetails.references && pageDetails.references.length > 0
            ? pageDetails.references
            : topLevelReferences,
        applicationProcess:
          pageDetails.applicationProcess && pageDetails.applicationProcess.length > 0
            ? pageDetails.applicationProcess
            : topLevelApplicationProcess,
      }
    : topLevelApplicationProcess.length > 0 || topLevelReferences.length > 0
      ? {
          schemeId: null,
          title: null,
          ministry: null,
          description: null,
          eligibility: [],
          benefits: [],
          references: topLevelReferences,
          applicationProcess: topLevelApplicationProcess,
          enrichedAt: null,
        }
      : undefined;

  const eligibilityCriteria = toStringArray(data.eligibilityCriteria);
  const benefitsList = toStringArray(data.benefitsList);
  const eligibilityItems = eligibilityCriteria.length
    ? eligibilityCriteria
    : normalizedPageDetails?.eligibility?.length
      ? normalizedPageDetails.eligibility
      : toStringArray(data.eligibility);
  const benefitsItems = benefitsList.length
    ? benefitsList
    : normalizedPageDetails?.benefits?.length
      ? normalizedPageDetails.benefits
      : toStringArray(data.benefits);

  return {
    id: typeof data.id === 'string' ? data.id : '',
    title: typeof data.title === 'string' ? data.title : 'Untitled Scheme',
    description:
      typeof data.description === 'string'
        ? data.description
        : normalizedPageDetails?.description || undefined,
    category: typeof data.category === 'string' ? data.category : 'General',
    ministry:
      typeof data.ministry === 'string'
        ? data.ministry
        : normalizedPageDetails?.ministry || undefined,
    state: typeof data.state === 'string' ? data.state : undefined,
    benefits:
      typeof data.benefits === 'string'
        ? data.benefits
        : benefitsItems[0] || undefined,
    benefit:
      typeof data.benefit === 'string'
        ? data.benefit
        : benefitsItems[0] || undefined,
    eligibility:
      typeof data.eligibility === 'string'
        ? data.eligibility
        : eligibilityItems[0] || undefined,
    applicationUrl:
      typeof data.applicationUrl === 'string' ? data.applicationUrl : undefined,
    tags: Array.isArray(data.tags) ? (data.tags.filter((tag) => typeof tag === 'string') as string[]) : undefined,
    rawCategories: Array.isArray(data.rawCategories)
      ? (data.rawCategories.filter((cat) => typeof cat === 'string') as string[])
      : undefined,
    matchedCategories: Array.isArray(data.matchedCategories)
      ? (data.matchedCategories
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null;
            const castEntry = entry as Record<string, unknown>;
            const type = typeof castEntry.type === 'string' ? castEntry.type : '';
            const value = typeof castEntry.value === 'string' ? castEntry.value : '';
            return type && value ? { type, value } : null;
          })
          .filter((entry): entry is { type: string; value: string } => Boolean(entry)))
      : undefined,
    enrichment:
      data.enrichment && typeof data.enrichment === 'object'
        ? {
            hasPageDetails: Boolean((data.enrichment as Record<string, unknown>).hasPageDetails),
            enrichedAt:
              typeof (data.enrichment as Record<string, unknown>).enrichedAt === 'string'
                ? ((data.enrichment as Record<string, unknown>).enrichedAt as string)
                : null,
          }
        : undefined,
    pageDetails: normalizedPageDetails,
    eligibilityCriteria: eligibilityItems,
    benefitsList: benefitsItems,
    applicationProcess:
      typeof data.applicationProcess === 'string' ? cleanText(data.applicationProcess) : undefined,
    requiredDocuments: toStringArray(data.requiredDocuments),
    deadline: typeof data.deadline === 'string' ? data.deadline : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
  };
}

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
  const payload = await res.json();

  if (Array.isArray(payload)) {
    return payload.map(normalizeScheme);
  }

  if (Array.isArray(payload?.items)) {
    return payload.items.map(normalizeScheme);
  }

  return [] as Scheme[];
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
  const payload = await res.json();

  return {
    items: Array.isArray(payload?.items) ? payload.items.map(normalizeScheme) : [],
    total: Number(payload?.total) || 0,
    page: Number(payload?.page) || page,
    pageSize: Number(payload?.pageSize) || limit,
    totalPages: Number(payload?.totalPages) || 1,
  } satisfies {
    items: Scheme[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export async function fetchSchemeById(id: string) {
  const res = await fetch(`${API_BASE}/schemes/${id}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Scheme not found');
  const payload = await res.json();
  return normalizeScheme(payload);
}

export async function fetchRecommendations(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/recommendations`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch recommendations');
  return res.json() as Promise<RecommendationApiItem[]>;
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
  return res.json() as Promise<ChatApiResponse>; // { response, suggestions?, degraded? }
}

// ─── Nudges ──────────────────────────────────────────────────────────────────

export async function fetchNudges(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/nudges`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to fetch nudges');
  return res.json();
}

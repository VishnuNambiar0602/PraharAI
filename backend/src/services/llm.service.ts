/**
 * LLM Service — Abstracted LLM interface (T-12)
 *
 * Supports:
 *   - ollama  (local, free) — default if running on localhost:11434
 *   - openai  — requires LLM_API_KEY
 *   - gemini  — requires LLM_API_KEY
 *   - none    — falls back to template responses (no LLM)
 *
 * Config via .env:
 *   LLM_PROVIDER=ollama          # ollama | openai | gemini | none
 *   LLM_MODEL=llama3             # model name for the provider
 *   LLM_API_KEY=sk-...           # required for openai / gemini
 *   LLM_BASE_URL=http://...      # override API base (optional)
 */

const PROVIDER = (process.env.LLM_PROVIDER || 'none').toLowerCase();
const MODEL = process.env.LLM_MODEL || 'llama3';
const API_KEY = process.env.LLM_API_KEY || '';
const BASE_URL = process.env.LLM_BASE_URL || '';

const TIMEOUT_MS = 15_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  provider: string;
  model: string;
  tokens?: number;
}

// ─── Providers ────────────────────────────────────────────────────────────────

async function callOllama(messages: LLMMessage[]): Promise<string> {
  const base = BASE_URL || 'http://localhost:11434';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ollama ${res.status}`);
    const data: any = await res.json();
    return data?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(messages: LLMMessage[]): Promise<string> {
  const base = BASE_URL || 'https://api.openai.com/v1';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ model: MODEL || 'gpt-4o-mini', messages }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI ${res.status}`);
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(messages: LLMMessage[]): Promise<string> {
  const model = MODEL || 'gemini-1.5-flash';
  const base = BASE_URL || `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // Convert to Gemini content format
    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const systemMsg = messages.find(m => m.role === 'system');

    const body: any = { contents };
    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const res = await fetch(`${base}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data: any = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } finally {
    clearTimeout(timer);
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class LLMService {
  readonly provider = PROVIDER;
  readonly model = MODEL;

  get isConfigured(): boolean {
    if (PROVIDER === 'none') return false;
    if (PROVIDER === 'ollama') return true; // no key needed
    return !!API_KEY;
  }

  /**
   * Send a chat completion request.
   * Returns null if the provider is 'none' or call fails — callers must handle fallback.
   */
  async chat(messages: LLMMessage[]): Promise<LLMResponse | null> {
    if (!this.isConfigured) return null;

    try {
      let content = '';

      if (PROVIDER === 'ollama') {
        content = await callOllama(messages);
      } else if (PROVIDER === 'openai') {
        content = await callOpenAI(messages);
      } else if (PROVIDER === 'gemini') {
        content = await callGemini(messages);
      }

      if (!content) return null;
      return { content, provider: PROVIDER, model: MODEL };
    } catch (err) {
      console.warn(`[LLM] ${PROVIDER} call failed:`, (err as Error).message);
      return null;
    }
  }

  /**
   * Single-turn completion shorthand — pass a system prompt + user message.
   */
  async complete(systemPrompt: string, userMessage: string): Promise<string | null> {
    const result = await this.chat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ]);
    return result?.content ?? null;
  }
}

export const llmService = new LLMService();

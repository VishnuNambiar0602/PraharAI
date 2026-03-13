import { Send, Bot, User, ChevronRight, AlertCircle, RefreshCcw } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import ReactMarkdown, { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { sendChatMessage } from '../api';
import { useAuth } from '../AuthContext';

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content:
      'Namaste! I am Prahar, your assistant for government schemes. I can help you find scholarships, grants, and benefits tailored to your profile.\n\nSign in to get personalized recommendations, or ask me anything!',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    suggestions: [
      'Schemes for students',
      'PM-KISAN eligibility',
      'Scholarships for women',
      'Show all schemes',
    ],
  },
];

const CHAT_CONTEXT_MESSAGE_LIMIT = 20;
const CHAT_CONTEXT_CONTENT_LIMIT = 1200;
const CHAT_HISTORY_VERSION = 'v2';

function detectInputLanguage(text: string): string {
  if (!text) return 'en';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  return 'en';
}

function fontForLanguage(lang?: string): string {
  switch ((lang || 'en').toLowerCase()) {
    case 'hi':
    case 'mr':
    case 'ne':
      return '"Noto Sans Devanagari", "Nirmala UI", "Mangal", sans-serif';
    case 'bn':
      return '"Noto Sans Bengali", "Vrinda", sans-serif';
    case 'gu':
      return '"Noto Sans Gujarati", sans-serif';
    case 'ta':
      return '"Noto Sans Tamil", "Latha", sans-serif';
    case 'te':
      return '"Noto Sans Telugu", "Gautami", sans-serif';
    case 'kn':
      return '"Noto Sans Kannada", "Tunga", sans-serif';
    case 'ml':
      return '"Noto Sans Malayalam", "Kartika", sans-serif';
    case 'ur':
      return '"Noto Nastaliq Urdu", "Noto Sans Arabic", "Segoe UI", sans-serif';
    default:
      return 'Inter, sans-serif';
  }
}

function cleanAssistantContent(raw: string): string {
  let text = (raw || '').replace(/\r\n?/g, '\n');

  // Recover common UTF-8 mojibake (e.g., â¢, ðŸ...) when text was decoded as Latin-1.
  if (/[ÃÂâð]/.test(text)) {
    try {
      const bytes = Uint8Array.from(text.split('').map((ch) => ch.charCodeAt(0) & 0xff));
      const decoded = new TextDecoder('utf-8').decode(bytes);
      const badBefore = (text.match(/[ÃÂâð]/g) || []).length;
      const badAfter = (decoded.match(/[ÃÂâð]/g) || []).length;
      if (badAfter < badBefore) text = decoded;
    } catch {
      // Keep original when decode fails.
    }
  }

  return text
    .replace(/^\s*[•●▪]\s+/gm, '- ')
    .replace(/^\s*â¢\s*/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanSummaryForDisplay(raw: string): string {
  const cleaned = cleanAssistantContent(raw)
    .replace(/(?:matching\s+schemes|recommended\s+schemes|top\s+schemes)[\s\S]*/i, '')
    .replace(/(?:say\s+"?am\s+i\s+eligible[\s\S]*)$/i, '')
    .replace(/[•·]\s*$/g, '')
    .replace(/\*\*\s*$/g, '')
    .replace(/[#*_`]+\s*$/g, '')
    .trim();

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);

  return (sentences.join(' ') || cleaned).slice(0, 280);
}

const chatMarkdownComponents: Components = {
  h1: ({ children }) => <h1 className="chat-md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="chat-md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="chat-md-h3">{children}</h3>,
  p: ({ children }) => <p className="chat-md-p">{children}</p>,
  ul: ({ children }) => <ul className="chat-md-list">{children}</ul>,
  ol: ({ children }) => <ol className="chat-md-list chat-md-list-ordered">{children}</ol>,
  li: ({ children }) => <li className="chat-md-li">{children}</li>,
  strong: ({ children }) => <strong className="chat-md-strong">{children}</strong>,
};

export default function ChatAssistant() {
  const { isAuthenticated, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = `prahar.chat.history.${CHAT_HISTORY_VERSION}.${user?.userId || 'guest'}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) {
      setMessages(INITIAL_MESSAGES);
      return;
    }

    try {
      const parsed = JSON.parse(saved) as Message[];
      setMessages(Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_MESSAGES);
    } catch {
      setMessages(INITIAL_MESSAGES);
    }
  }, [storageKey]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, storageKey]);

  const resetChat = () => {
    setMessages(INITIAL_MESSAGES);
    setInput('');
    inputRef.current?.focus();
  };

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;
    const preferredLanguage = detectInputLanguage(content);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      language: preferredLanguage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages
        .slice(-CHAT_CONTEXT_MESSAGE_LIMIT)
        .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, CHAT_CONTEXT_CONTENT_LIMIT),
      }));

      const data = await sendChatMessage(content, history, preferredLanguage);
      const baseResponse = cleanSummaryForDisplay(
        data.structured?.summary || data.response || 'I could not process that. Please try again.'
      );
      const degradedNotice = data.degraded
        ? '\n\n(Advanced ML service is temporarily unavailable. Showing fallback guidance.)'
        : '';

      const structuredSchemes = (data.structured?.schemes || data.schemes || []).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category || 'General',
        state: s.state || undefined,
      }));

      const nextActions =
        (Array.isArray(data.structured?.next_actions) && data.structured?.next_actions.length > 0
          ? data.structured.next_actions
          : data.suggestions) || [];

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanAssistantContent(`${baseResponse}${degradedNotice}`),
        language: data.trace?.replyLanguage || preferredLanguage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: Array.isArray(nextActions) ? nextActions : [],
        schemes: structuredSchemes,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (error: any) {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error?.message || "I'm having trouble connecting to the server. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: [content, 'Show all schemes'],
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 3.75rem)' }}>
      {/* ── Gradient accent stripe ── */}
      <div
        style={{
          height: '2px',
          flexShrink: 0,
          background:
            'linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 50%, var(--color-primary) 100%)',
        }}
      />

      {/* ── Chat Header ── */}
      <div
        className="shrink-0 px-5 py-3.5 flex items-center justify-between"
        style={{
          background: 'var(--color-parchment)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="size-10 rounded-xl flex items-center justify-center"
              style={{
                background:
                  'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
                boxShadow: '0 3px 10px rgba(11,30,52,0.28)',
              }}
            >
              <Bot className="size-5 text-white" />
            </div>
            <span
              className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 pulse-ring"
              style={{ background: '#22c55e', borderColor: 'var(--color-parchment)' }}
            />
          </div>
          <div>
            <p
              className="font-bold text-sm leading-none"
              style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}
            >
              Prahar AI
            </p>
            <p
              className="text-[10px] font-semibold mt-1"
              style={{
                color: '#16a34a',
                fontFamily: 'Space Grotesk, sans-serif',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              Active · All India
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isAuthenticated && (
            <span
              className="pill"
              style={{
                background: 'var(--color-accent-50)',
                color: 'var(--color-accent-700)',
                border: '1px solid var(--color-accent-100)',
                fontSize: '0.7rem',
              }}
            >
              <AlertCircle className="size-3" /> Sign in for better results
            </span>
          )}
          <button
            type="button"
            onClick={resetChat}
            className="px-2.5 h-8 rounded-lg border text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
            style={{
              borderColor: 'var(--color-border)',
              color: 'var(--color-primary)',
              background: 'var(--color-surface-2)',
              fontFamily: 'Inter, sans-serif',
            }}
            title="Start a new chat"
          >
            <RefreshCcw className="size-3" /> New Chat
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <main
        className="flex-1 overflow-y-auto thin-scroll chat-canvas"
        style={{
          paddingTop: '1.5rem',
          paddingBottom: '1.5rem',
          paddingLeft: 'clamp(1rem, 5vw, 3rem)',
          paddingRight: 'clamp(1rem, 5vw, 3rem)',
          background: 'var(--color-surface)',
          backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      >
        <div className="max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar */}
              <div
                className="size-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{
                  background:
                    msg.role === 'assistant'
                      ? 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)'
                      : 'var(--color-accent)',
                  boxShadow:
                    msg.role === 'assistant'
                      ? '0 2px 6px rgba(11,30,52,0.25)'
                      : '0 2px 6px rgba(200,112,13,0.3)',
                }}
              >
                {msg.role === 'assistant' ? (
                  <Bot className="size-3.5 text-white" />
                ) : (
                  <User className="size-3.5 text-white" />
                )}
              </div>

              {/* Bubble + metadata */}
              <div
                className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end max-w-[78%] md:max-w-[70%]' : 'items-start max-w-[96%] md:max-w-[92%]'}`}
              >
                <div
                  className={`px-4 py-3 text-sm leading-relaxed ${msg.role === 'assistant' ? 'markdown-content chat-markdown assistant-bubble' : 'whitespace-pre-wrap user-bubble'}`}
                  style={
                    msg.role === 'assistant'
                      ? {
                          borderRadius: '2px 18px 18px 18px',
                          fontFamily: fontForLanguage(msg.language),
                        }
                      : {
                          borderRadius: '18px 2px 18px 18px',
                          fontFamily: fontForLanguage(msg.language),
                        }
                  }
                >
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown components={chatMarkdownComponents} remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  ) : (
                    msg.content
                  )}
                  {msg.schemes && msg.schemes.length > 0 && (
                    <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(205,189,158,0.55)' }}>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70">
                        Matching Schemes
                      </p>
                      <div className="mt-2.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {msg.schemes.map((s) => (
                          <div
                            key={s.id}
                            className="p-3.5 rounded-xl border h-full flex flex-col"
                            style={{
                              background: 'linear-gradient(165deg, rgba(255,255,255,0.78), rgba(253,249,242,0.95))',
                              borderColor: 'rgba(205,189,158,0.72)',
                            }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-semibold text-sm leading-snug">{s.title}</p>
                              <span className="pill pill-primary text-[10px] shrink-0">{s.category || 'General'}</span>
                            </div>
                            <p className="text-xs opacity-70 mt-2 flex-1" style={{ fontFamily: fontForLanguage(msg.language) }}>
                              {s.description || s.eligibility}
                            </p>
                            <button className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                              View Details <ChevronRight className="size-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <span
                  className="text-[10px] px-1"
                  style={{ color: 'var(--color-muted-2)', fontFamily: 'Inter, sans-serif' }}
                >
                  {msg.timestamp}
                </span>

                {msg.suggestions && (
                  <div className="flex flex-wrap gap-1.5 mt-0.5">
                    {msg.suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(s)}
                        disabled={loading}
                        className="chat-suggestion-chip px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40 active:scale-95"
                        style={{
                          fontFamily: 'Inter, sans-serif',
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* ── Typing indicator — 3 bouncing dots ── */}
          {loading && (
            <div className="flex gap-3">
              <div
                className="size-8 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background:
                    'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-600) 100%)',
                  boxShadow: '0 2px 6px rgba(11,30,52,0.25)',
                }}
              >
                <Bot className="size-3.5 text-white" />
              </div>
              <div
                className="px-5 py-4 flex items-center gap-1.5"
                style={{
                  borderRadius: '2px 18px 18px 18px',
                  background: 'var(--color-parchment)',
                  border: '1px solid var(--color-border)',
                  boxShadow: '0 2px 8px rgba(26,18,8,0.07)',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2 rounded-full block"
                    style={{
                      background: 'var(--color-muted)',
                      animation: `chat-dot-bounce 1.3s ${i * 0.18}s ease-in-out infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      {/* ── Input bar ── */}
      <div
        className="shrink-0 px-4 pt-3 pb-4"
        style={{
          background: 'var(--color-parchment)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center gap-2.5">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about schemes, eligibility, or benefits…"
              disabled={loading}
              className="input-base"
              style={{
                paddingRight: '3.25rem',
                paddingTop: '0.75rem',
                paddingBottom: '0.75rem',
                borderRadius: '14px',
              }}
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-xl flex items-center justify-center disabled:opacity-35 disabled:pointer-events-none"
              style={{
                background: input.trim() ? 'var(--color-accent)' : 'var(--color-primary)',
                boxShadow: input.trim()
                  ? '0 2px 8px rgba(200,112,13,0.4)'
                  : '0 2px 8px rgba(11,30,52,0.2)',
                transform: `scale(${input.trim() ? 1 : 0.88})`,
                transition: 'background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease',
              }}
            >
              <Send className="size-3.5 text-white" />
            </button>
          </div>
        </div>
        <p
          className="text-center text-[10px] mt-2"
          style={{
            color: 'var(--color-muted-2)',
            fontFamily: 'Inter, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          Prahar AI · Powered by Digital India
        </p>
      </div>
    </div>
  );
}

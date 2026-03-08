import { Send, Bot, User, ChevronRight, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
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

export default function ChatAssistant() {
  const { isAuthenticated } = useAuth();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      const data = await sendChatMessage(content, history);
      const baseResponse = data.response || 'I could not process that. Please try again.';
      const degradedNotice = data.degraded
        ? '\n\n(Advanced ML service is temporarily unavailable. Showing fallback guidance.)'
        : '';

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `${baseResponse}${degradedNotice}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          "I'm having trouble connecting to the server. Please check your connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: ['Try again', 'Show all schemes'],
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
      </div>

      {/* ── Messages ── */}
      <main
        className="flex-1 overflow-y-auto thin-scroll"
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
                className={`flex flex-col gap-1.5 max-w-[78%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className="px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
                  style={
                    msg.role === 'assistant'
                      ? {
                          borderRadius: '2px 18px 18px 18px',
                          background: 'var(--color-parchment)',
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-ink)',
                          boxShadow: '0 2px 8px rgba(26,18,8,0.07), 0 1px 2px rgba(26,18,8,0.04)',
                          fontFamily: 'Inter, sans-serif',
                        }
                      : {
                          borderRadius: '18px 2px 18px 18px',
                          background:
                            'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-800) 100%)',
                          color: 'rgba(255,255,255,0.93)',
                          boxShadow: '0 2px 8px rgba(11,30,52,0.25)',
                          fontFamily: 'Inter, sans-serif',
                        }
                  }
                >
                  {msg.content}
                  {msg.schemes && (
                    <div
                      className="mt-3 space-y-2 pt-3"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
                    >
                      {msg.schemes.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded-xl"
                          style={{
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.15)',
                          }}
                        >
                          <p className="font-semibold text-sm">{s.title}</p>
                          <p className="text-xs opacity-70 mt-0.5">{s.eligibility}</p>
                          <button className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity">
                            View Details <ChevronRight className="size-3" />
                          </button>
                        </div>
                      ))}
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
                        className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-40 active:scale-95"
                        style={{
                          background: 'var(--color-parchment)',
                          border: '1.5px solid var(--color-border)',
                          color: 'var(--color-primary)',
                          fontFamily: 'Inter, sans-serif',
                          boxShadow: '0 1px 3px rgba(26,18,8,0.06)',
                        }}
                        onMouseEnter={(e) => {
                          const t = e.currentTarget;
                          t.style.borderColor = 'var(--color-accent)';
                          t.style.color = 'var(--color-accent-700)';
                          t.style.background = 'var(--color-accent-50)';
                        }}
                        onMouseLeave={(e) => {
                          const t = e.currentTarget;
                          t.style.borderColor = 'var(--color-border)';
                          t.style.color = 'var(--color-primary)';
                          t.style.background = 'var(--color-parchment)';
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

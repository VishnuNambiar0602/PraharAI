import { Send, Mic, Bot, User, ChevronRight, Sparkles, Loader2, AlertCircle } from 'lucide-react';
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

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I could not process that. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestions: data.suggestions,
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
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-surface">
      {/* ── Chat Header ── */}
      <div className="bg-white border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-full bg-primary flex items-center justify-center">
              <Bot className="size-5 text-white" />
            </div>
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-white" />
          </div>
          <div>
            <h1 className="font-semibold text-ink text-sm">Prahar AI Assistant</h1>
            <p className="text-[10px] text-green-600 font-semibold uppercase tracking-widest">
              Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isAuthenticated && (
            <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold px-2.5 py-1 rounded-full">
              <AlertCircle className="size-3" /> Sign in for personalised results
            </span>
          )}
          <span className="inline-flex items-center gap-1 bg-primary-50 text-primary text-[10px] font-semibold px-2.5 py-1 rounded-full border border-primary-100">
            <Sparkles className="size-3" /> Powered by Prahar AI
          </span>
        </div>
      </div>

      {/* ── Messages ── */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-5 no-scrollbar max-w-4xl mx-auto w-full">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-primary-100 text-primary'
              }`}
            >
              {msg.role === 'assistant' ? <Bot className="size-4" /> : <User className="size-4" />}
            </div>
            <div className={`max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div
                className={`px-4 py-3 rounded-xl ${
                  msg.role === 'assistant'
                    ? 'bg-white border border-border text-ink shadow-sm rounded-tl-sm'
                    : 'bg-primary text-white rounded-tr-sm'
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                {msg.schemes && (
                  <div className="mt-3 space-y-2 border-t border-white/20 pt-3">
                    {msg.schemes.map((s) => (
                      <div key={s.id} className="bg-white/10 border border-white/20 p-3 rounded-lg">
                        <p className="font-semibold text-sm">{s.title}</p>
                        <p className="text-xs opacity-75 mt-0.5">{s.eligibility}</p>
                        <button className="mt-2 text-xs font-semibold flex items-center gap-1 opacity-90 hover:opacity-100">
                          View Details <ChevronRight className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p
                className="text-[10px] text-muted font-medium px-1 block ${
                msg.role === 'user' ? 'text-right' : ''
              }"
              >
                {msg.timestamp}
              </p>
              {msg.suggestions && (
                <div className="flex flex-wrap gap-2">
                  {msg.suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(s)}
                      disabled={loading}
                      className="px-3 py-1.5 bg-white border border-border rounded-full text-xs font-medium text-primary hover:bg-primary-50 hover:border-primary/40 transition-colors disabled:opacity-40"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="size-8 rounded-full bg-primary flex items-center justify-center">
              <Bot className="size-4 text-white" />
            </div>
            <div className="bg-white border border-border rounded-xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="size-4 text-primary animate-spin" />
              <span className="text-sm text-muted">Prahar is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </main>

      {/* ── Input ── */}
      <div className="bg-white border-t border-border px-4 py-4 pb-6 md:pb-4 shrink-0">
        <div className="max-w-4xl mx-auto flex items-end gap-3">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about a scheme, eligibility, or benefit…"
              disabled={loading}
              className="input-base py-3.5! pr-14!"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 size-9 bg-primary rounded-lg flex items-center justify-center text-white hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-muted mt-2 uppercase tracking-widest">
          Powered by Digital India · Prahar AI
        </p>
      </div>
    </div>
  );
}

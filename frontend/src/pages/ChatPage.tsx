import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Namaste ${user?.name}! I am Prahar, your assistant for government schemes. I can help you find scholarships, grants, and benefits tailored to your profile. How can I help you today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    
    try {
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          userId: user?.userId 
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');
      
      const data = await response.json();
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'I apologize, but I encountered an error. Please try again.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again later.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white p-4 border-b border-primary/10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-primary/5 rounded-lg">
            <Home className="w-5 h-5 text-primary" />
          </button>
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-primary">Prahar AI</h1>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            
            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div className={`p-4 rounded-2xl shadow-sm ${
                msg.role === 'assistant' 
                ? 'bg-white text-slate-700 rounded-tl-none' 
                : 'bg-primary text-white rounded-tr-none'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block px-1">
                {msg.timestamp}
              </span>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white p-4 rounded-2xl rounded-tl-none shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-primary/10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="flex-1 relative flex items-center bg-slate-100 rounded-2xl">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask Prahar..."
              className="w-full bg-transparent border-none focus:ring-0 py-4 pl-6 pr-14 text-sm"
              disabled={loading}
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-3 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-center text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-4">
          Powered by Digital India
        </p>
      </footer>
    </div>
  );
}

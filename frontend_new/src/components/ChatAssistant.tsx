import { motion } from 'motion/react';
import { Send, Mic, Bot, User, ChevronRight, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Message } from '../types';

const INITIAL_MESSAGES: Message[] = [
  {
    id: '1',
    role: 'assistant',
    content: 'Namaste! I am Prahar, your assistant for government schemes. I can help you find scholarships, grants, and benefits tailored to your profile.',
    timestamp: '10:02 AM',
    suggestions: ['Schemes for students', 'PM-KISAN eligibility', 'Scholarships for women']
  }
];

export default function ChatAssistant() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');

  const handleSend = () => {
    if (!input.trim()) return;
    
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    setMessages([...messages, userMsg]);
    setInput('');
    
    // Mock response
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Based on your profile as a student from Rajasthan, here are the most relevant grants:',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        schemes: [
          {
            id: 's1',
            title: 'Post-Matric Scholarship',
            benefit: 'Covers tuition fees',
            eligibility: 'SC/ST/OBC students',
            deadline: '31st Oct',
            category: 'Student'
          }
        ]
      };
      setMessages(prev => [...prev, botMsg]);
    }, 1000);
  };

  return (
    <div className="flex flex-col h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white p-4 border-b border-primary/10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Bot className="size-6" />
          </div>
          <div>
            <h1 className="font-bold text-primary">Prahar AI</h1>
            <div className="flex items-center gap-1">
              <span className="size-2 bg-green-500 rounded-full" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Online</span>
            </div>
          </div>
        </div>
        <button className="flex items-center gap-1 px-3 py-1.5 bg-primary/5 rounded-full text-primary text-xs font-bold">
          <Sparkles className="size-3" />
          English
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'assistant' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {msg.role === 'assistant' ? <Bot className="size-5" /> : <User className="size-5" />}
            </div>
            
            <div className={`max-w-[80%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
              <div className={`p-4 rounded-2xl shadow-sm ${
                msg.role === 'assistant' 
                ? 'bg-white text-slate-700 rounded-tl-none' 
                : 'bg-primary text-white rounded-tr-none'
              }`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                
                {msg.schemes && (
                  <div className="mt-4 space-y-3">
                    {msg.schemes.map(s => (
                      <div key={s.id} className="bg-white border border-primary/10 p-4 rounded-xl shadow-sm">
                        <h4 className="font-bold text-primary text-sm">{s.title}</h4>
                        <p className="text-xs text-slate-500 mt-1">{s.eligibility}</p>
                        <button className="mt-3 text-primary text-xs font-bold flex items-center gap-1 hover:underline">
                          View Details
                          <ChevronRight className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block px-1">
                {msg.timestamp}
              </span>
              
              {msg.suggestions && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {msg.suggestions.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => setInput(s)}
                      className="px-4 py-2 bg-white border border-primary/10 rounded-full text-xs font-medium text-primary hover:bg-primary/5 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-primary/10 pb-24">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1 relative flex items-center bg-slate-100 rounded-2xl">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask Prahar..."
              className="w-full bg-transparent border-none focus:ring-0 py-4 pl-6 pr-14 text-sm"
            />
            <button 
              onClick={handleSend}
              className="absolute right-3 p-2 text-primary hover:bg-primary/10 rounded-xl transition-colors"
            >
              <Send className="size-5" />
            </button>
          </div>
          <button className="size-14 bg-primary text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all">
            <Mic className="size-6" />
          </button>
        </div>
        <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-4">
          Powered by Digital India
        </p>
      </footer>
    </div>
  );
}

import { motion } from 'motion/react';
import { Search, Mic, Filter, ExternalLink, School, Tractor as Agriculture, Baby, HeartPulse, Map, Bookmark, MessageSquare, User, Home, Zap, Loader2, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Scheme } from '../types';
import { fetchSchemes } from '../api';

const CATEGORIES = [
  { icon: Agriculture, label: 'Farmer' },
  { icon: School, label: 'Student' },
  { icon: Baby, label: 'Women' },
  { icon: HeartPulse, label: 'Health' },
  { icon: Map, label: 'State' },
];

export default function SchemeExplorer() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  useEffect(() => {
    loadSchemes();
  }, []);

  const loadSchemes = async (searchQuery = '', category = '') => {
    setLoading(true);
    setError('');
    try {
      // Backend only supports `q` — merge search + category into one query
      const combined = [searchQuery, category].filter(Boolean).join(' ');
      const data = await fetchSchemes(combined || undefined, 50);
      // API returns a flat array
      const list: Scheme[] = Array.isArray(data) ? data : (data.schemes ?? data.data ?? data.value ?? []);
      setSchemes(list.slice(0, 50));
    } catch {
      setError('Could not load schemes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadSchemes(query, activeCategory);
  };

  const handleCategory = (label: string) => {
    const next = activeCategory === label ? '' : label;
    setActiveCategory(next);
    loadSchemes(query, next);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-primary/10 shadow-sm">
        <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-white p-2 rounded-lg">
                <Home className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-primary">Prahar AI</h1>
            </div>
            <button className="flex items-center justify-center rounded-full w-10 h-10 bg-primary/10 text-primary">
              <User className="size-6" />
            </button>
          </div>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative flex items-center bg-primary/5 rounded-xl border border-primary/10">
            <Search className="absolute left-4 text-primary/60 size-5" />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 py-3 pl-12 pr-12 text-base placeholder:text-primary/40 outline-none" 
              placeholder="Search schemes (e.g., PM Kisan)..." 
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="absolute right-4 text-primary">
              <Mic className="size-5" />
            </button>
          </form>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => { setActiveCategory(''); loadSchemes(query, ''); }}
              className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${
                !activeCategory ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <Filter className="size-4" />
              All Schemes
            </button>
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategory(cat.label)}
                className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                  activeCategory === cat.label ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                <cat.icon className="size-4" />
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary">
            {activeCategory ? `${activeCategory} Schemes` : 'All Schemes'}
          </h2>
          <span className="text-sm font-medium text-primary/60">
            {loading ? 'Loading…' : `${schemes.length} found`}
          </span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-primary/60">
            <Loader2 className="size-10 animate-spin" />
            <p className="text-sm font-medium">Fetching schemes…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-sm">{error}</p>
            <button onClick={() => loadSchemes(query, activeCategory)} className="ml-auto text-xs font-bold underline">Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && schemes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
            <Search className="size-10" />
            <p className="text-sm font-medium">No schemes found. Try a different search.</p>
          </div>
        )}

        <div className="space-y-4 pb-24">
          {!loading && schemes.map((scheme) => (
            <motion.div 
              key={scheme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-primary/5 flex flex-col gap-4"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold leading-snug flex-1">{scheme.title}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded bg-primary/10 text-primary">
                  {scheme.category || 'General'}
                </span>
              </div>

              {scheme.description && (
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-2">{scheme.description}</p>
              )}

              {(scheme.benefits || scheme.benefit) && (
                <div className="bg-primary/5 rounded-lg p-3 flex items-center justify-between border-l-4 border-primary">
                  <span className="text-sm font-medium text-primary/70">Benefit / Ministry</span>
                  <span className="text-sm font-bold text-primary">{scheme.benefits || scheme.benefit}</span>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <User className="text-primary/60 size-5 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Eligibility / Tags</p>
                    <p className="text-sm text-slate-700">{scheme.eligibility || 'Check official website'}</p>
                  </div>
                </div>
              </div>

              {/* Apply Now — links directly to myscheme.gov.in */}
              <a
                href={scheme.applicationUrl || `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                Apply Now
                <ExternalLink className="size-4" />
              </a>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Floating Action Button */}
      <button className="fixed right-6 bottom-24 bg-primary text-white p-4 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-40 border-4 border-white">
        <Zap className="size-8" />
      </button>
    </div>
  );
}

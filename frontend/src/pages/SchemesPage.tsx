import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter, ExternalLink, Home, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Scheme {
  id: string;
  title: string;
  description: string;
  category: string;
  benefits?: string;
  eligibility?: string;
  deadline?: string;
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    fetchSchemes();
  }, []);

  const fetchSchemes = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/schemes');
      if (!response.ok) throw new Error('Failed to fetch schemes');
      
      const data = await response.json();
      setSchemes(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredSchemes = schemes.filter(scheme => {
    const matchesSearch = scheme.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         scheme.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || scheme.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(schemes.map(s => s.category)));

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-primary/10 shadow-sm">
        <div className="max-w-7xl mx-auto w-full p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => navigate('/')} className="bg-primary text-white p-2 rounded-lg">
                <Home className="w-6 h-6" />
              </button>
              <h1 className="text-xl font-bold tracking-tight text-primary">Prahar AI</h1>
            </div>
            {user ? (
              <button 
                onClick={() => navigate('/dashboard')}
                className="flex items-center justify-center rounded-full w-10 h-10 bg-primary/10 text-primary"
              >
                <User className="w-6 h-6" />
              </button>
            ) : (
              <button 
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
              >
                Login
              </button>
            )}
          </div>

          {/* Search Bar */}
          <div className="relative flex items-center bg-primary/5 rounded-xl border border-primary/10">
            <Search className="absolute left-4 text-primary/60 w-5 h-5" />
            <input 
              className="w-full bg-transparent border-none focus:ring-0 py-3 pl-12 pr-4 text-base placeholder:text-primary/40" 
              placeholder="Search schemes (e.g., PM Kisan)..." 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            <button 
              onClick={() => setSelectedCategory('')}
              className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold ${
                !selectedCategory ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
              }`}
            >
              <Filter className="w-4 h-4" />
              All Schemes
            </button>
            {categories.map((cat) => (
              <button 
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex h-9 shrink-0 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                  selectedCategory === cat ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 max-w-7xl mx-auto w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-primary">
            {selectedCategory ? `${selectedCategory} Schemes` : 'All Schemes'}
          </h2>
          <span className="text-sm font-medium text-primary/60">{filteredSchemes.length} Schemes found</span>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
          {filteredSchemes.map((scheme, index) => (
            <motion.div 
              key={scheme.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-xl p-5 shadow-sm border border-primary/5 flex flex-col gap-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-bold leading-snug flex-1">{scheme.title}</h3>
                <span className="text-xs font-bold px-2 py-1 rounded bg-primary/10 text-primary">
                  {scheme.category}
                </span>
              </div>

              <p className="text-sm text-slate-600 line-clamp-3">{scheme.description}</p>

              {scheme.benefits && (
                <div className="bg-primary/5 rounded-lg p-3 border-l-4 border-primary">
                  <span className="text-xs font-bold text-primary/70 uppercase tracking-wider">Benefit</span>
                  <p className="text-sm font-semibold text-primary mt-1">{scheme.benefits}</p>
                </div>
              )}

              <button 
                onClick={() => navigate(`/schemes/${scheme.id}`)}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                View Details
                <ExternalLink className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>

        {filteredSchemes.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-slate-500">No schemes found matching your criteria.</p>
          </div>
        )}
      </main>
    </div>
  );
}

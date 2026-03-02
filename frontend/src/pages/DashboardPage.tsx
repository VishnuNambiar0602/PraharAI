import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { 
  User, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Scheme {
  id: string;
  title: string;
  description: string;
  category: string;
  eligibilityScore?: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchRecommendations();
  }, [user, navigate]);

  const fetchRecommendations = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/users/${user?.userId}/recommendations`);
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      
      const data = await response.json();
      setRecommendations(data.slice(0, 5)); // Show top 5
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white border-b border-primary/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Welcome back, {user?.name}!
              </h1>
              <p className="text-slate-500 mt-1">Here are your personalized recommendations</p>
            </div>
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <User className="w-5 h-5" />
              Profile
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-primary/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{recommendations.length}</p>
                <p className="text-sm text-slate-500">Recommended Schemes</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-primary/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Applications Submitted</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-6 shadow-sm border border-primary/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">0</p>
                <p className="text-sm text-slate-500">Pending Deadlines</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Recommendations Section */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/5 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-slate-900">Personalized for You</h2>
            </div>
            <button
              onClick={() => navigate('/schemes')}
              className="text-primary font-semibold hover:underline flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            {recommendations.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500">No recommendations available yet.</p>
                <button
                  onClick={() => navigate('/schemes')}
                  className="mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Browse All Schemes
                </button>
              </div>
            ) : (
              recommendations.map((scheme, index) => (
                <motion.div
                  key={scheme.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="p-5 border border-slate-200 rounded-lg hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                  onClick={() => navigate(`/schemes/${scheme.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900">{scheme.title}</h3>
                        <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                          {scheme.category}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 line-clamp-2">{scheme.description}</p>
                    </div>
                    {scheme.eligibilityScore && (
                      <div className="ml-4 text-right">
                        <div className="text-2xl font-bold text-primary">
                          {scheme.eligibilityScore}%
                        </div>
                        <p className="text-xs text-slate-500">Match</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            onClick={() => navigate('/assistant')}
            className="bg-gradient-to-r from-primary to-primary/80 text-white p-6 rounded-xl shadow-lg hover:shadow-xl transition-all text-left"
          >
            <h3 className="text-xl font-bold mb-2">Need Help?</h3>
            <p className="text-white/90 mb-4">Chat with our AI assistant to find the perfect scheme for you</p>
            <div className="flex items-center gap-2 text-white font-semibold">
              Start Chat
              <ArrowRight className="w-5 h-5" />
            </div>
          </motion.button>

          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => navigate('/schemes')}
            className="bg-white border-2 border-primary/20 p-6 rounded-xl shadow-sm hover:shadow-md transition-all text-left"
          >
            <h3 className="text-xl font-bold text-slate-900 mb-2">Explore More</h3>
            <p className="text-slate-600 mb-4">Browse through all available government schemes</p>
            <div className="flex items-center gap-2 text-primary font-semibold">
              View Schemes
              <ArrowRight className="w-5 h-5" />
            </div>
          </motion.button>
        </div>
      </main>
    </div>
  );
}

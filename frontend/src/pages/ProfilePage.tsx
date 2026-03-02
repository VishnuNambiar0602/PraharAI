import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, MapPin, Edit3, Home, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface UserProfile {
  userId: string;
  name: string;
  email: string;
  gender?: string;
  age?: number;
  state?: string;
  socialCategory?: string;
  locality?: string;
  isDisabled?: boolean;
  isMinority?: boolean;
  income?: number;
  employment?: string;
  povertyLine?: string;
  education?: string;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchProfile();
  }, [user, navigate]);

  const fetchProfile = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/users/${user?.userId}/profile`);
      if (!response.ok) throw new Error('Failed to fetch profile');
      
      const data = await response.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
      <header className="bg-white p-4 border-b border-primary/10 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 hover:bg-primary/5 rounded-lg">
            <Home className="w-5 h-5 text-primary" />
          </button>
          <h1 className="font-bold text-primary text-lg">My Profile</h1>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </header>

      <main className="p-4 space-y-6 pb-8 max-w-4xl mx-auto w-full">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5"
        >
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-10 h-10" />
              </div>
            </div>
            
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-900">{profile?.name}</h2>
                <button className="text-primary p-2 hover:bg-primary/5 rounded-lg">
                  <Edit3 className="w-5 h-5" />
                </button>
              </div>
              <p className="text-slate-500 mt-1">{profile?.email}</p>
            </div>
          </div>
        </motion.div>

        {/* Personal Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Gender</p>
              <p className="text-slate-900">{profile?.gender || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Age</p>
              <p className="text-slate-900">{profile?.age || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">State</p>
              <p className="text-slate-900 flex items-center gap-1">
                <MapPin className="w-4 h-4 text-primary" />
                {profile?.state || 'Not specified'}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Locality</p>
              <p className="text-slate-900">{profile?.locality || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Social Category</p>
              <p className="text-slate-900">{profile?.socialCategory || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Education</p>
              <p className="text-slate-900">{profile?.education || 'Not specified'}</p>
            </div>
          </div>
        </motion.div>

        {/* Economic Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-4">Economic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Annual Income</p>
              <p className="text-slate-900">₹{profile?.income?.toLocaleString() || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Employment Status</p>
              <p className="text-slate-900">{profile?.employment || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Poverty Line Status</p>
              <p className="text-slate-900">{profile?.povertyLine || 'Not specified'}</p>
            </div>
          </div>
        </motion.div>

        {/* Additional Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-6 shadow-sm border border-primary/5"
        >
          <h3 className="text-lg font-bold text-slate-900 mb-4">Additional Information</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={profile?.isDisabled || false} 
                disabled 
                className="w-4 h-4 text-primary border-slate-300 rounded"
              />
              <span className="text-slate-700">Person with Disability</span>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={profile?.isMinority || false} 
                disabled 
                className="w-4 h-4 text-primary border-slate-300 rounded"
              />
              <span className="text-slate-700">Minority Community</span>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

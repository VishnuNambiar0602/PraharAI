import { useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Eye, EyeOff, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { View } from '../types';

interface LoginPageProps {
  onNavigate: (view: View) => void;
  onLoginSuccess?: () => void;  // optional callback after successful login/register
}

export default function LoginPage({ onNavigate, onLoginSuccess }: LoginPageProps) {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
    state: '',
    income: '',
    gender: '',
  });

  const update = (field: string, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          password: form.password,
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          state: form.state || undefined,
          income: form.income ? Number(form.income) : undefined,
          gender: form.gender || undefined,
        });
      }
      if (onLoginSuccess) onLoginSuccess();
      else onNavigate('home');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white p-4 border-b border-primary/10 flex items-center sticky top-0 z-10">
        <button
          onClick={() => onNavigate('home')}
          className="size-10 flex items-center justify-center text-primary hover:bg-primary/10 rounded-full"
        >
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-primary pr-10">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h1>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="size-16 bg-primary text-white rounded-2xl flex items-center justify-center mb-3 shadow-lg shadow-primary/30">
              <Bot className="size-9" />
            </div>
            <h2 className="text-2xl font-black text-slate-900">Prahar AI</h2>
            <p className="text-sm text-slate-500 mt-1">Your Government Schemes Assistant</p>
          </div>

          {/* Toggle */}
          <div className="flex bg-white rounded-xl border border-primary/10 p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'login' ? 'bg-primary text-white shadow' : 'text-slate-500'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                mode === 'register' ? 'bg-primary text-white shadow' : 'text-slate-500'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="Rahul Kumar"
                  className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary"
                >
                  {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Age</label>
                    <input
                      type="number"
                      value={form.age}
                      onChange={(e) => update('age', e.target.value)}
                      placeholder="25"
                      min={1} max={120}
                      className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">State</label>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => update('state', e.target.value)}
                      placeholder="Maharashtra"
                      className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Annual Income (₹)</label>
                  <input
                    type="number"
                    value={form.income}
                    onChange={(e) => update('income', e.target.value)}
                    placeholder="300000"
                    className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Gender</label>
                  <select
                    value={form.gender}
                    onChange={(e) => update('gender', e.target.value)}
                    className="w-full bg-white border border-primary/15 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-slate-700"
                  >
                    <option value="">Prefer not to say</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Demo credentials */}
          {mode === 'login' && (
            <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <p className="text-xs font-bold text-primary uppercase tracking-wider mb-2">Demo Credentials</p>
              <p className="text-xs text-slate-600">Email: <span className="font-mono font-bold">admin@example.com</span></p>
              <p className="text-xs text-slate-600">Password: <span className="font-mono font-bold">password</span></p>
              <button
                type="button"
                onClick={() => { update('email', 'admin@example.com'); update('password', 'password'); }}
                className="mt-2 text-xs font-bold text-primary hover:underline"
              >
                Auto-fill demo credentials →
              </button>
            </div>
          )}
        </motion.div>
      </main>
    </div>
  );
}

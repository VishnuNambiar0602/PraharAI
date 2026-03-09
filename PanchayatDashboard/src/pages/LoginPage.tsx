import { useState } from 'react';
import { Leaf, Lock, AlertCircle, MapPin } from 'lucide-react';
import { verifyAdminKey, saveAdminKey } from '../api';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const isValid = await verifyAdminKey(adminKey);
      if (isValid) {
        saveAdminKey(adminKey);
        onLogin();
      } else {
        setError('Invalid access key. Please contact your district administrator.');
      }
    } catch {
      setError('Failed to connect. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0a1a0e' }}>
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden">
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '48px 48px' }} />
        {/* Glow blob */}
        <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.06) 0%, transparent 70%)' }} />

        {/* Top logo */}
        <div className="flex items-center gap-3 relative">
          <div className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <Leaf className="size-5 text-amber-400" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none tracking-tight">Gram Sabha</p>
            <p className="text-[10px] font-semibold tracking-widest mt-0.5" style={{ color: '#2d4a32' }}>PANCHAYAT PORTAL</p>
          </div>
        </div>

        {/* Center copy */}
        <div className="relative space-y-6">
          <div className="size-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <MapPin className="size-8 text-amber-400" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight tracking-tight">
              Grassroots Welfare<br />
              <span style={{ color: '#f59e0b' }}>Management System</span>
            </h1>
            <p className="text-sm mt-4 leading-relaxed max-w-sm" style={{ color: '#4a6a50' }}>
              Monitor government scheme enrollment, track beneficiary onboarding, and ensure last-mile delivery of welfare programs at the Panchayat level.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {['Gram Panchayat', 'Beneficiary Tracking', 'Scheme Mapping', 'Rural Outreach'].map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(255,255,255,0.04)', color: '#4a6a50', border: '1px solid rgba(255,255,255,0.07)' }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[11px] relative" style={{ color: '#1e3322' }}>
          Authorised Panchayat officials only — access is audited
        </p>
      </div>

      {/* ── Right login panel ── */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
            <div className="size-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <Leaf className="size-5 text-amber-400" />
            </div>
            <p className="text-white font-bold text-lg tracking-tight">Gram Sabha</p>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white tracking-tight">Welcome</h2>
            <p className="mt-1.5 text-sm" style={{ color: '#4a6a50' }}>Enter your Panchayat access key</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="adminKey" className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#5a7a62' }}>
                Access Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-600" />
                <input
                  id="adminKey"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg font-mono transition-all duration-150
                    placeholder:text-gray-700 text-white focus:outline-none"
                  style={{ background: '#142a17', border: '1px solid #1e3322', caretColor: '#f59e0b' }}
                  required
                  onFocus={(e) => { e.target.style.borderColor = 'rgba(245,158,11,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(245,158,11,0.06)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#1e3322'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{ background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }}>
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !adminKey}
              className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              style={{ background: loading ? '#142a17' : 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: !loading ? '0 0 20px rgba(245,158,11,0.15)' : 'none' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Verifying…
                </span>
              ) : (
                'Enter Portal →'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px]" style={{ color: '#1e3322' }}>
            Gram Panchayat Welfare Portal — Ministry of Panchayati Raj
          </p>
        </div>
      </div>
    </div>
  );
}

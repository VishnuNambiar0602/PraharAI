import { useState } from 'react';
import { Leaf, Lock, Mail, MapPin } from 'lucide-react';
import { panchayatLogin, PanchayatUser } from '../api';

interface LoginPageProps {
  onLogin: (user: PanchayatUser) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await panchayatLogin(email.trim().toLowerCase(), password);
      onLogin(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-surface)' }}>
      {/* Left panel — navy hero (matches main site) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden hero-mesh">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 size-80 rounded-full blur-3xl pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(217,122,16,0.1) 0%, transparent 70%)',
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(217,122,16,0.15)',
              border: '1px solid rgba(217,122,16,0.3)',
            }}
          >
            <Leaf className="size-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <p
              className="text-white font-bold text-lg leading-none tracking-tight"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Gram Sabha
            </p>
            <p
              className="text-[10px] font-semibold tracking-widest mt-0.5"
              style={{ color: 'rgba(217,122,16,0.6)' }}
            >
              PANCHAYAT PORTAL
            </p>
          </div>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-6">
          <div
            className="size-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'rgba(217,122,16,0.1)',
              border: '1px solid rgba(217,122,16,0.2)',
            }}
          >
            <MapPin className="size-8" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <h1
              className="text-4xl font-bold text-white leading-tight tracking-tight"
              style={{ fontFamily: 'Lora, Georgia, serif' }}
            >
              Citizen Welfare
              <br />
              <span style={{ color: 'var(--color-accent)' }}>Service Desk</span>
            </h1>
            <p
              className="text-sm mt-4 leading-relaxed max-w-sm"
              style={{ color: 'rgba(255,255,255,0.45)' }}
            >
              Help villagers discover and apply for government welfare schemes. AI-powered
              eligibility matching at the grassroots level.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              'Gram Panchayat',
              'AI Scheme Matching',
              'Beneficiary Tracking',
              'Last-Mile Delivery',
            ].map((tag) => (
              <span
                key={tag}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.35)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        <p className="text-[11px] relative" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Authorised Panchayat officials only — access is audited
        </p>
      </div>

      {/* Right panel — parchment form */}
      <div
        className="flex-1 flex items-center justify-center p-8"
        style={{ background: 'var(--color-parchment)' }}
      >
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10 justify-center">
            <div
              className="size-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'rgba(217,122,16,0.15)',
                border: '1px solid rgba(217,122,16,0.3)',
              }}
            >
              <Leaf className="size-5" style={{ color: 'var(--color-accent)' }} />
            </div>
            <p
              className="font-bold text-lg tracking-tight"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Gram Sabha
            </p>
          </div>

          <div className="mb-8">
            <h2
              className="text-2xl font-bold tracking-tight"
              style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
            >
              Welcome back
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: 'var(--color-muted)' }}>
              Sign in to your Panchayat account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-muted)' }}
              >
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
                  style={{ color: 'var(--color-muted-2)' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="official@panchayat.gov.in"
                  className="p-input pl-9"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-muted)' }}
              >
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
                  style={{ color: 'var(--color-muted-2)' }}
                />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="p-input pl-9"
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg text-sm bg-red-50 border border-red-200 text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="p-btn p-btn-primary w-full justify-center py-2.5 mt-2"
            >
              {loading ? (
                <>
                  <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In to Portal'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { Users, RefreshCw, CheckCircle, Clock, PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPanchayatCitizens, getPanchayatUser } from '../api';
import type { Beneficiary } from '../types';

const AVATAR_PALETTE = [
  { bg: 'rgba(16,40,69,0.1)', text: '#24537d' },
  { bg: 'rgba(217,122,16,0.12)', text: '#a95a0a' },
  { bg: 'rgba(197,95,54,0.12)', text: '#c55f36' },
  { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  { bg: 'rgba(6,182,212,0.12)', text: '#0891b2' },
  { bg: 'rgba(24,122,66,0.12)', text: '#187a42' },
];
function getAvatarStyle(name: string) {
  let h = 0;
  for (const c of name || 'U') h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}
function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function ActivityPage() {
  const [citizens, setCitizens] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'onboarded' | 'pending'>('all');
  const navigate = useNavigate();
  const user = getPanchayatUser();

  const loadCitizens = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPanchayatCitizens();
      setCitizens(Array.isArray(data) ? data : []);
    } catch {
      setCitizens([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCitizens();
  }, [loadCitizens]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div
          className="size-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Loading…
        </p>
      </div>
    );
  }

  const filtered =
    filter === 'all'
      ? citizens
      : citizens.filter((c) =>
          filter === 'onboarded' ? c.onboardingComplete : !c.onboardingComplete
        );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
          >
            Citizen Registrations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Citizens in {user?.state || 'your state'} — sorted by registration date
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/panchayat/beneficiaries', { state: { openRegister: true } })}
            className="p-btn p-btn-primary gap-1.5"
          >
            <PlusCircle className="size-3.5" />
            Register
          </button>
          <button onClick={loadCitizens} className="p-btn p-btn-secondary gap-1.5">
            <RefreshCw className="size-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2">
        {(['all', 'onboarded', 'pending'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={
              filter === t
                ? {
                    background: 'var(--color-primary)',
                    color: '#fff',
                    border: '1px solid var(--color-primary)',
                  }
                : {
                    background: '#fff',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-ink-2)',
                  }
            }
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t !== 'all' &&
              ` (${citizens.filter((c) => (t === 'onboarded' ? c.onboardingComplete : !c.onboardingComplete)).length})`}
          </button>
        ))}
      </div>

      <div className="p-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="size-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--color-surface-2)' }}
            >
              <Users className="size-7" style={{ color: 'var(--color-muted-2)' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
              {filter === 'all' ? 'No citizens registered yet' : `No ${filter} citizens`}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
              {filter === 'all'
                ? 'Register citizens from the Citizens tab.'
                : `All citizens currently have a different status.`}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-surface-2)' }}>
            {filtered.map((c) => {
              const av = getAvatarStyle(c.name || '');
              return (
                <div
                  key={c.userId}
                  className="flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer"
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--color-accent-50)')
                  }
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => navigate('/panchayat/beneficiaries')}
                >
                  <div
                    className="size-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: av.bg, color: av.text }}
                  >
                    {getInitials(c.name || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                        {c.name || '—'}
                      </p>
                      {c.onboardingComplete ? (
                        <CheckCircle
                          className="size-3.5"
                          style={{ color: 'var(--color-success)' }}
                        />
                      ) : (
                        <Clock className="size-3.5" style={{ color: '#d97706' }} />
                      )}
                    </div>
                    <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                      {[c.district, c.state, c.employment].filter(Boolean).join(' · ') || c.email}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`p-badge ${c.onboardingComplete ? 'p-badge-success' : 'p-badge-warning'}`}
                    >
                      {c.onboardingComplete ? 'Onboarded' : 'Pending'}
                    </span>
                    {c.createdAt && (
                      <p className="text-[11px] mt-1" style={{ color: 'var(--color-muted-2)' }}>
                        {new Date(c.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

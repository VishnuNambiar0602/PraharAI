import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ClipboardList,
  Clock,
  CheckCircle,
  ArrowRight,
  PlusCircle,
  FileText,
  BarChart2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getPanchayatScopedStats, getPanchayatUser } from '../api';

interface RecentCitizen {
  userId: string;
  name: string;
  email: string;
  state?: string;
  district?: string;
  employment?: string;
  gender?: string;
  onboardingComplete: boolean;
  createdAt?: string;
}

interface PanchayatStats {
  total: number;
  onboarded: number;
  pending: number;
  state: string;
  district: string;
  recentRegistrations: RecentCitizen[];
}

function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function DashboardPage() {
  const [stats, setStats] = useState<PanchayatStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = getPanchayatUser();

  const loadData = useCallback(async () => {
    try {
      const data = await getPanchayatScopedStats().catch(() => null);
      setStats(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const onboardingPct =
    stats && stats.total > 0 ? Math.round((stats.onboarded / stats.total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background:
            'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary) 60%, var(--color-primary-700) 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              className="text-xl font-bold text-white tracking-tight"
              style={{ fontFamily: 'Lora, Georgia, serif' }}
            >
              {user?.panchayatName || 'Gram Panchayat'} — Citizen Service Desk
            </h1>
            <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {[user?.district, user?.state].filter(Boolean).join(', ') ||
                'Welfare scheme delivery'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <p
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-accent)' }}
            >
              Onboarding Rate
            </p>
            <p className="text-3xl font-bold text-white tabular-nums">{onboardingPct}%</p>
            <div
              className="w-32 h-1.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${onboardingPct}%`, background: 'var(--color-accent)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-stat-card blue">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Citizens in {stats?.state || 'State'}</p>
              <p className="p-stat-value">{(stats?.total ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <Users className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-stat-card green">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Onboarded</p>
              <p className="p-stat-value">{(stats?.onboarded ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <CheckCircle className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-stat-card amber">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Pending Onboarding</p>
              <p className="p-stat-value">{(stats?.pending ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <Clock className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-card p-5">
        <h2
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            {
              icon: PlusCircle,
              label: 'Register New Citizen',
              sub: 'Add a citizen to your panchayat',
              to: '/panchayat/beneficiaries',
              state: { openRegister: true },
              bg: 'var(--color-primary-50)',
              border: 'var(--color-primary-100)',
              color: 'var(--color-primary-600)',
            },
            {
              icon: ClipboardList,
              label: 'Citizen Service Desk',
              sub: 'Find and assist registered citizens',
              to: '/panchayat/beneficiaries',
              bg: 'var(--color-accent-50)',
              border: 'var(--color-accent-100)',
              color: 'var(--color-accent)',
            },
            {
              icon: FileText,
              label: 'Browse Schemes',
              sub: 'Explore available welfare schemes',
              to: '/panchayat/schemes',
              bg: 'var(--color-surface-2)',
              border: 'var(--color-border)',
              color: 'var(--color-ink-2)',
            },
          ].map(({ icon: Icon, label, sub, to, state: navState, bg, border, color }, idx) => (
            <button
              key={label}
              onClick={() => navigate(to, { state: navState })}
              className={`flex items-center justify-between p-4 rounded-xl transition-all duration-150 text-left group${idx === 2 ? ' col-span-2 sm:col-span-1' : ''}`}
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <div className="flex items-center gap-3">
                <Icon className="size-5 shrink-0" style={{ color }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    {label}
                  </p>
                  <p
                    className="text-xs mt-0.5 hidden sm:block"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {sub}
                  </p>
                </div>
              </div>
              <ArrowRight
                className="size-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color }}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Recent registrations */}
      {stats?.recentRegistrations && stats.recentRegistrations.length > 0 && (
        <div className="p-card overflow-hidden">
          <div
            className="flex items-center justify-between px-5 py-4 border-b"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <h2
              className="text-sm font-semibold"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Recently Registered Citizens
            </h2>
            <button
              onClick={() => navigate('/panchayat/beneficiaries')}
              className="text-xs font-semibold flex items-center gap-1"
              style={{ color: 'var(--color-accent)' }}
            >
              View all <ArrowRight className="size-3" />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--color-surface-2)' }}>
            {stats.recentRegistrations.map((c) => (
              <div key={c.userId} className="flex items-center gap-3 px-5 py-3">
                <div
                  className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{
                    background: 'var(--color-primary-50)',
                    color: 'var(--color-primary-600)',
                  }}
                >
                  {getInitials(c.name || '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--color-ink)' }}
                  >
                    {c.name || '—'}
                  </p>
                  <p className="text-xs truncate" style={{ color: 'var(--color-muted)' }}>
                    {[c.district, c.employment].filter(Boolean).join(' · ') || c.email}
                  </p>
                </div>
                <span
                  className={`p-badge shrink-0 ${c.onboardingComplete ? 'p-badge-success' : 'p-badge-warning'}`}
                >
                  {c.onboardingComplete ? 'Onboarded' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!stats || stats.total === 0 ? (
        <div className="p-card p-10 flex flex-col items-center text-center">
          <div
            className="size-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <BarChart2 className="size-8" style={{ color: 'var(--color-muted-2)' }} />
          </div>
          <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
            No citizens registered yet
          </p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--color-muted)' }}>
            Start by registering citizens from your panchayat.
          </p>
          <button
            onClick={() => navigate('/panchayat/beneficiaries', { state: { openRegister: true } })}
            className="p-btn p-btn-primary gap-2"
          >
            <PlusCircle className="size-3.5" />
            Register First Citizen
          </button>
        </div>
      ) : null}
    </div>
  );
}

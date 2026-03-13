import { useState, useEffect, useCallback } from 'react';
import { Users, Briefcase, UserCheck, RefreshCw, MapPin, LineChart } from 'lucide-react';
import { getAnalytics, getPanchayatUser } from '../api';
import type { AnalyticsData } from '../types';

type BreakdownEntry = {
  label: string;
  count: number;
};

function BarList({ items, color }: { items: BreakdownEntry[]; color: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="text-xs w-28 shrink-0 truncate" style={{ color: 'var(--color-ink-2)' }}>
            {item.label || 'Unknown'}
          </span>
          <div
            className="flex-1 rounded-full h-2 overflow-hidden"
            style={{ background: 'var(--color-border)' }}
          >
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${Math.round((item.count / max) * 100)}%`, background: color }}
            />
          </div>
          <span
            className="text-xs font-semibold w-8 text-right tabular-nums"
            style={{ color: 'var(--color-muted)' }}
          >
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const user = getPanchayatUser();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAnalytics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
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
          Loading analytics…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-card p-6" style={{ borderColor: '#fecaca' }}>
        <p className="text-sm" style={{ color: '#dc2626' }}>
          {error}
        </p>
        <button onClick={loadData} className="p-btn p-btn-secondary mt-3">
          Retry
        </button>
      </div>
    );
  }

  const total = data?.totalCitizens ?? 0;
  const onboarded = data?.onboardedCitizens ?? 0;
  const onboardingPct = total > 0 ? Math.round((onboarded / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
          >
            Citizen Analytics
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            {[data?.panchayatName, data?.district, data?.state].filter(Boolean).join(', ') ||
              user?.state ||
              'your panchayat'}
          </p>
        </div>
        <button onClick={loadData} className="p-btn p-btn-secondary gap-1.5 shrink-0">
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-stat-card blue">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Total Citizens</p>
              <p className="p-stat-value">{total.toLocaleString('en-IN')}</p>
            </div>
            <Users className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-stat-card green">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Onboarded</p>
              <p className="p-stat-value">{onboarded.toLocaleString('en-IN')}</p>
            </div>
            <UserCheck className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-stat-card amber">
          <div className="flex items-start justify-between">
            <div>
              <p className="p-stat-label">Schemes Indexed</p>
              <p className="p-stat-value">{(data?.totalSchemes ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <Briefcase className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
      </div>

      {/* Onboarding progress bar */}
      <div className="p-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2
            className="text-sm font-semibold"
            style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Onboarding Progress
          </h2>
          <span className="text-xs font-bold" style={{ color: 'var(--color-ink-2)' }}>
            {onboarded} / {total}
          </span>
        </div>
        <div
          className="w-full h-3 rounded-full overflow-hidden"
          style={{ background: 'var(--color-border)' }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${onboardingPct}%`, background: 'var(--color-primary-600)' }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs" style={{ color: 'var(--color-muted)' }}>
          <span>{onboardingPct}% complete</span>
          <span>{data?.pendingCitizens ?? 0} citizens pending</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="p-stat-label">Enriched Schemes</p>
              <p className="p-stat-value">{(data?.enrichedSchemes ?? 0).toLocaleString('en-IN')}</p>
            </div>
            <LineChart className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="p-stat-label">Scheme Enrichment Rate</p>
              <p className="p-stat-value">{data?.enrichmentRate ?? 0}%</p>
            </div>
            <UserCheck className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
        <div className="p-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="p-stat-label">Coverage</p>
              <p className="text-sm font-semibold mt-1" style={{ color: 'var(--color-ink)' }}>
                {[data?.panchayatName, data?.district, data?.state].filter(Boolean).join(', ') ||
                  'Local area'}
              </p>
            </div>
            <MapPin className="size-5 mt-0.5" style={{ color: 'var(--color-muted-2)' }} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Employment breakdown */}
        {data?.employmentDistribution && data.employmentDistribution.length > 0 && (
          <div className="p-card p-5">
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Citizens by Employment
            </h2>
            <BarList
              items={data.employmentDistribution.slice(0, 8)}
              color="var(--color-primary-600)"
            />
          </div>
        )}

        {/* Gender breakdown */}
        {data?.genderDistribution && data.genderDistribution.length > 0 && (
          <div className="p-card p-5">
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Citizens by Gender
            </h2>
            <BarList items={data.genderDistribution} color="var(--color-accent)" />
          </div>
        )}
      </div>

      {data?.registrationTrend && data.registrationTrend.length > 0 && (
        <div className="p-card p-5">
          <h2
            className="text-sm font-semibold mb-4"
            style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
          >
            Recent Registrations
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {data.registrationTrend.map((entry) => (
              <div
                key={entry.day}
                className="rounded-xl border px-3 py-4 text-center"
                style={{ borderColor: 'var(--color-border)', background: 'var(--color-parchment)' }}
              >
                <p className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>
                  {entry.day}
                </p>
                <p
                  className="text-2xl font-bold mt-1"
                  style={{ color: 'var(--color-primary-600)' }}
                >
                  {entry.count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {total === 0 && (
        <div className="p-card p-12 flex flex-col items-center text-center">
          <Users className="size-10 mb-3" style={{ color: 'var(--color-muted-2)' }} />
          <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
            No citizens registered yet
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
            Analytics will appear once citizens are registered in your panchayat.
          </p>
        </div>
      )}
    </div>
  );
}

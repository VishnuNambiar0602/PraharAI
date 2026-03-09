import { useState, useEffect } from 'react';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { getAnalytics } from '../api';
import type { AnalyticsData } from '../types';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await getAnalytics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-amber-500 animate-spin" />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Loading analytics…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-card p-6 border-red-200">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={loadData} className="p-btn p-btn-secondary mt-3">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
        >
          Analytics
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
          Beneficiary reach and scheme coverage insights
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-stat-card blue">
          <p className="p-stat-label">Beneficiaries</p>
          <p className="p-stat-value">{(data?.totalUsers ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="p-stat-card green">
          <p className="p-stat-label">Schemes Pulled</p>
          <p className="p-stat-value">{(data?.totalSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="p-stat-card purple">
          <p className="p-stat-label">Enriched</p>
          <p className="p-stat-value">{(data?.enrichedSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="p-stat-card amber">
          <p className="p-stat-label">Active</p>
          <p className="p-stat-value">{(data?.activeSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User growth trend */}
        {data?.userGrowthTrend && data.userGrowthTrend.length > 0 && (
          <div className="p-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4" style={{ color: 'var(--color-primary-600)' }} />
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Beneficiary Growth
              </h2>
            </div>
            <div className="space-y-2">
              {data.userGrowthTrend.map((item) => {
                const max = Math.max(...data.userGrowthTrend.map((x) => x.users), 1);
                const pct = Math.round((item.users / max) * 100);
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span
                      className="text-xs w-16 shrink-0 tabular-nums"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {item.month}
                    </span>
                    <div
                      className="flex-1 rounded-full h-2 overflow-hidden"
                      style={{ background: 'var(--color-border)' }}
                    >
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: 'var(--color-primary-600)' }}
                      />
                    </div>
                    <span
                      className="text-xs font-semibold w-8 text-right tabular-nums"
                      style={{ color: 'var(--color-ink-2)' }}
                    >
                      {item.users}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheme sync trend */}
        {data?.schemeSyncTrend && data.schemeSyncTrend.length > 0 && (
          <div className="p-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="size-4" style={{ color: 'var(--color-accent)' }} />
              <h2
                className="text-sm font-semibold"
                style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Scheme Sync Trend
              </h2>
            </div>
            <div className="space-y-2">
              {data.schemeSyncTrend.map((item) => {
                const max = Math.max(...data.schemeSyncTrend.map((x) => x.schemes), 1);
                const pct = Math.round((item.schemes / max) * 100);
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span
                      className="text-xs w-16 shrink-0 tabular-nums"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      {item.month}
                    </span>
                    <div
                      className="flex-1 rounded-full h-2 overflow-hidden"
                      style={{ background: 'var(--color-border)' }}
                    >
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: 'var(--color-accent)' }}
                      />
                    </div>
                    <span
                      className="text-xs font-semibold w-12 text-right tabular-nums"
                      style={{ color: 'var(--color-ink-2)' }}
                    >
                      {item.schemes.toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* State distribution */}
        {data?.stateDistribution && data.stateDistribution.length > 0 && (
          <div className="p-card p-5">
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Beneficiaries by State
            </h2>
            <div className="space-y-2.5">
              {data.stateDistribution.slice(0, 8).map((entry) => (
                <div key={entry.label} className="flex items-center gap-3">
                  <span
                    className="text-xs w-24 shrink-0 truncate"
                    style={{ color: 'var(--color-ink-2)' }}
                  >
                    {entry.label}
                  </span>
                  <div
                    className="flex-1 rounded-full h-1.5 overflow-hidden"
                    style={{ background: 'var(--color-border)' }}
                  >
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${entry.percentage}%`,
                        background: 'var(--color-primary-600)',
                      }}
                    />
                  </div>
                  <span
                    className="text-xs w-8 text-right tabular-nums"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {entry.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employment distribution */}
        {data?.employmentDistribution && data.employmentDistribution.length > 0 && (
          <div className="p-card p-5">
            <h2
              className="text-sm font-semibold mb-4"
              style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Beneficiaries by Employment
            </h2>
            <div className="space-y-2.5">
              {data.employmentDistribution.map((entry) => (
                <div key={entry.label} className="flex items-center gap-3">
                  <span
                    className="text-xs w-24 shrink-0 truncate"
                    style={{ color: 'var(--color-ink-2)' }}
                  >
                    {entry.label || 'Unknown'}
                  </span>
                  <div
                    className="flex-1 rounded-full h-1.5 overflow-hidden"
                    style={{ background: 'var(--color-border)' }}
                  >
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${entry.percentage}%`, background: 'var(--color-accent)' }}
                    />
                  </div>
                  <span
                    className="text-xs w-8 text-right tabular-nums"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {entry.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { TrendingUp, Users, FileText, CheckCircle, RefreshCw } from 'lucide-react';
import { getAnalytics } from './adminApi';

interface AnalyticsSummary {
  totalUsers: number;
  totalSchemes: number;
  onboardedUsers: number;
  enrichedSchemes: number;
  enrichmentRate: number;
}

interface DistributionItem {
  state?: string;
  employment?: string;
  count: number;
}

interface AnalyticsResult {
  summary: AnalyticsSummary;
  distribution: {
    byState: DistributionItem[];
    byEmployment: DistributionItem[];
  };
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<AnalyticsResult | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const result = await getAnalytics(Number(timeRange));
      setData(result);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (n?: number) => (n != null ? n.toLocaleString('en-IN') : '—');
  const pct = (n?: number) => (n != null ? `${n.toFixed(1)}%` : '—');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-accent)]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">Analytics</h1>
          <p className="text-[var(--color-muted)] mt-1">System usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7', '30', '90'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === days
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:bg-[var(--color-border)]'
              }`}
            >
              {days} Days
            </button>
          ))}
          <button onClick={loadAnalytics} className="btn btn-secondary ml-2">
            <RefreshCw className="size-4" />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
              <Users className="size-6 text-[var(--color-primary)]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            {fmt(data?.summary.totalUsers)}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Total Users</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-emerald-50 flex items-center justify-center">
              <FileText className="size-6 text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            {fmt(data?.summary.totalSchemes)}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Total Schemes</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
              <CheckCircle className="size-6 text-[var(--color-accent)]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            {fmt(data?.summary.onboardedUsers)}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Onboarded Users</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-purple-50 flex items-center justify-center">
              <TrendingUp className="size-6 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-[var(--color-ink)]">
            {pct(data?.summary.enrichmentRate)}
          </p>
          <p className="text-sm text-[var(--color-muted)] mt-1">Enrichment Rate</p>
        </div>
      </div>

      {/* Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">Users by State</h2>
          <div className="space-y-2">
            {(data?.distribution.byState ?? []).slice(0, 6).map((item) => {
              const total = data?.summary.totalUsers || 1;
              const pctVal = Math.round((item.count / total) * 100);
              return (
                <div key={item.state} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-ink)] w-36 truncate">
                    {item.state}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-primary)]"
                      style={{ width: `${pctVal}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-muted)] w-10 text-right">
                    {item.count}
                  </span>
                </div>
              );
            })}
            {!data?.distribution.byState?.length && (
              <p className="text-sm text-[var(--color-muted)]">No distribution data yet</p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-[var(--color-ink)] mb-4">
            Users by Employment
          </h2>
          <div className="space-y-2">
            {(data?.distribution.byEmployment ?? []).slice(0, 6).map((item) => {
              const total = data?.summary.totalUsers || 1;
              const pctVal = Math.round((item.count / total) * 100);
              return (
                <div key={item.employment} className="flex items-center gap-3">
                  <span className="text-sm text-[var(--color-ink)] w-36 truncate">
                    {item.employment}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-2)]">
                    <div
                      className="h-2 rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${pctVal}%` }}
                    />
                  </div>
                  <span className="text-xs text-[var(--color-muted)] w-10 text-right">
                    {item.count}
                  </span>
                </div>
              );
            })}
            {!data?.distribution.byEmployment?.length && (
              <p className="text-sm text-[var(--color-muted)]">No distribution data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

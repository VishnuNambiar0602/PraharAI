import { useState, useEffect } from 'react';
import { TrendingUp, BarChart2 } from 'lucide-react';
import { getAnalytics } from '../api';
import type { AnalyticsData } from '../types';

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

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
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading analytics…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-6 border-red-200">
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={loadData} className="btn btn-secondary mt-3">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Beneficiary reach and scheme coverage insights</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card blue">
          <p className="stat-label">Beneficiaries</p>
          <p className="stat-value">{(data?.totalUsers ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="stat-card green">
          <p className="stat-label">Schemes Pulled</p>
          <p className="stat-value">{(data?.totalSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="stat-card purple">
          <p className="stat-label">Enriched</p>
          <p className="stat-value">{(data?.enrichedSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
        <div className="stat-card amber">
          <p className="stat-label">Active</p>
          <p className="stat-value">{(data?.activeSchemes ?? 0).toLocaleString('en-IN')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User growth trend */}
        {data?.userGrowthTrend && data.userGrowthTrend.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="size-4 text-blue-500" />
              <h2 className="font-semibold text-gray-900">Beneficiary Growth</h2>
            </div>
            <div className="space-y-2">
              {data.userGrowthTrend.map((item) => {
                const max = Math.max(...data.userGrowthTrend.map((x) => x.users), 1);
                const pct = Math.round((item.users / max) * 100);
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 shrink-0 tabular-nums">{item.month}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-8 text-right tabular-nums">{item.users}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Scheme sync trend */}
        {data?.schemeSyncTrend && data.schemeSyncTrend.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="size-4 text-green-600" />
              <h2 className="font-semibold text-gray-900">Scheme Sync Trend</h2>
            </div>
            <div className="space-y-2">
              {data.schemeSyncTrend.map((item) => {
                const max = Math.max(...data.schemeSyncTrend.map((x) => x.schemes), 1);
                const pct = Math.round((item.schemes / max) * 100);
                return (
                  <div key={item.month} className="flex items-center gap-3">
                    <span className="text-xs text-gray-500 w-16 shrink-0 tabular-nums">{item.month}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="h-2 rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 w-12 text-right tabular-nums">{item.schemes.toLocaleString('en-IN')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* State distribution */}
        {data?.stateDistribution && data.stateDistribution.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Beneficiaries by State</h2>
            <div className="space-y-2.5">
              {data.stateDistribution.slice(0, 8).map((entry) => (
                <div key={entry.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 shrink-0 truncate">{entry.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${entry.percentage}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Employment distribution */}
        {data?.employmentDistribution && data.employmentDistribution.length > 0 && (
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">Beneficiaries by Employment</h2>
            <div className="space-y-2.5">
              {data.employmentDistribution.map((entry) => (
                <div key={entry.label} className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 w-24 shrink-0 truncate">{entry.label || 'Unknown'}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full bg-amber-400" style={{ width: `${entry.percentage}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right tabular-nums">{entry.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

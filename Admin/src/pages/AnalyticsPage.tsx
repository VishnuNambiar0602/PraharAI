import { useState, useEffect } from 'react';
import { TrendingUp, Users, FileText, Activity } from 'lucide-react';
import { getAnalytics } from '../api';

interface AnalyticsData {
  summary: {
    totalUsers: number;
    totalSchemes: number;
    onboardedUsers: number;
    enrichedSchemes: number;
    enrichmentRate: number;
  };
  trends: {
    users: Array<{ date: string; count: number }>;
    sync: Array<{ date: string; synced: number; enriched: number }>;
  };
  distribution: {
    byState: Array<{ state: string; count: number }>;
    byEmployment: Array<{ employment: string; count: number }>;
  };
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('30');
  const [data, setData] = useState<AnalyticsData | null>(null);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">System usage and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          {(['7', '30', '90'] as const).map((days) => (
            <button
              key={days}
              onClick={() => setTimeRange(days)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === days
                  ? 'bg-blue-700 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {days} Days
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="size-6 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.summary.totalUsers ?? '—'}</p>
          <p className="text-sm text-gray-600 mt-1">Total Users</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-green-50 flex items-center justify-center">
              <FileText className="size-6 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.summary.totalSchemes ?? '—'}</p>
          <p className="text-sm text-gray-600 mt-1">Total Schemes</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-purple-50 flex items-center justify-center">
              <Activity className="size-6 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{data?.summary.onboardedUsers ?? '—'}</p>
          <p className="text-sm text-gray-600 mt-1">Onboarded Users</p>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="size-12 rounded-lg bg-orange-50 flex items-center justify-center">
              <TrendingUp className="size-6 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {data ? `${Math.round((data.summary.enrichmentRate ?? 0) * 100)}%` : '—'}
          </p>
          <p className="text-sm text-gray-600 mt-1">Scheme Enrichment Rate</p>
        </div>
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">User Growth (Last 7 Days)</h2>
          {data?.trends.users && data.trends.users.length > 0 ? (
            <div className="space-y-2">
              {data.trends.users.map((point) => (
                <div key={point.date} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{point.date}</span>
                  <span className="font-medium text-gray-900">{point.count} new users</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No user growth data for this period</p>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Scheme Sync Trends (Last 7 Days)</h2>
          {data?.trends.sync && data.trends.sync.length > 0 ? (
            <div className="space-y-2">
              {data.trends.sync.map((point) => (
                <div key={point.date} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{point.date}</span>
                  <span className="font-medium text-gray-900">
                    {point.synced} synced / {point.enriched} enriched
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-40 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-gray-500">No sync data for this period</p>
            </div>
          )}
        </div>
      </div>

      {/* Scheme Enrichment Summary */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Scheme Enrichment Summary</h2>
        {data ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalSchemes}</p>
              <p className="text-sm text-gray-600 mt-1">Total Schemes</p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <p className="text-2xl font-bold text-green-700">{data.summary.enrichedSchemes}</p>
              <p className="text-sm text-gray-600 mt-1">Enriched</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-700">
                {Math.round((data.summary.enrichmentRate ?? 0) * 100)}%
              </p>
              <p className="text-sm text-gray-600 mt-1">Enrichment Rate</p>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-700">{data.summary.onboardedUsers}</p>
              <p className="text-sm text-gray-600 mt-1">Users Onboarded</p>
            </div>
          </div>
        ) : (
          <p className="text-gray-500">No data available</p>
        )}
      </div>

      {/* User Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Users by State</h2>
          {data?.distribution.byState && data.distribution.byState.length > 0 ? (
            <div className="space-y-3">
              {data.distribution.byState.map((item) => {
                const max = data.distribution.byState[0]?.count || 1;
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={item.state}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{item.state}</span>
                      <span className="text-sm text-gray-600">{item.count} users</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-blue-700 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No state data available yet</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Users by Employment</h2>
          {data?.distribution.byEmployment && data.distribution.byEmployment.length > 0 ? (
            <div className="space-y-3">
              {data.distribution.byEmployment.map((item) => {
                const max = data.distribution.byEmployment[0]?.count || 1;
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={item.employment}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{item.employment}</span>
                      <span className="text-sm text-gray-600">{item.count} users</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No employment data available yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

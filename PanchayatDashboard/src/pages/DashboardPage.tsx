import { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { getDashboardStats, getSyncStatus, getSystemHealth } from '../api';
import type { SyncStatus, SystemHealth } from '../types';

interface Stats {
  totalUsers: number;
  totalSchemes: number;
  activeSchemes: number;
  totalApplications: number;
  userGrowth: number;
  schemeGrowth: number;
  applicationGrowth: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, syncData, healthData] = await Promise.all([
        getDashboardStats().catch(() => null),
        getSyncStatus().catch(() => null),
        getSystemHealth().catch(() => null),
      ]);
      setStats(statsData);
      setSyncStatus(syncData);
      setHealth(healthData);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading overview…</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Beneficiaries', value: stats?.totalUsers ?? 0, change: stats?.userGrowth ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', accent: 'blue' },
    { label: 'Welfare Schemes', value: stats?.totalSchemes ?? 0, change: stats?.schemeGrowth ?? 0, icon: FileText, color: 'text-green-700', bg: 'bg-green-50', accent: 'green' },
    { label: 'Active Schemes', value: stats?.activeSchemes ?? 0, change: 0, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50', accent: 'purple' },
    { label: 'Enrolments', value: stats?.totalApplications ?? 0, change: stats?.applicationGrowth ?? 0, icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50', accent: 'amber' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Panchayat Overview</h1>
          <p className="text-sm text-gray-500 mt-0.5">Welfare scheme delivery &amp; beneficiary status</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary gap-1.5">
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Health banner */}
      {health && (
        <div className="card p-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className={`health-dot ${health.status === 'healthy' ? 'healthy' : health.status === 'degraded' ? 'degraded' : 'critical'}`} />
            <span className="text-sm font-semibold text-gray-800">
              System:{' '}
              <span className={health.status === 'healthy' ? 'text-emerald-600' : health.status === 'degraded' ? 'text-amber-500' : 'text-red-500'}>
                {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[{ label: 'Database', ok: health.neo4j }, { label: 'Cache', ok: health.redis }, { label: 'API', ok: health.api }].map(({ label, ok }) => (
              <span key={label} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                {ok ? '✓' : '✗'} {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`stat-card ${s.accent}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label">{s.label}</p>
                  <p className="stat-value">{s.value.toLocaleString('en-IN')}</p>
                  {s.change !== 0 && (
                    <p className={`stat-change ${s.change > 0 ? 'positive' : 'negative'}`}>
                      {s.change > 0 ? '+' : ''}{s.change}% this month
                    </p>
                  )}
                </div>
                <div className={`${s.bg} ${s.color} p-2.5 rounded-xl`}>
                  <Icon className="size-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Scheme sync status */}
      {syncStatus && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Scheme Sync Status</h2>
            {syncStatus.isSyncing && (
              <span className="badge badge-info flex items-center gap-1">
                <RefreshCw className="size-3 animate-spin" />
                Syncing…
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Total Schemes</p>
              <p className="text-2xl font-bold text-gray-900 tabular-nums">{syncStatus.totalSchemes.toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Last Pulled</p>
              <p className="text-base font-medium text-gray-800">
                {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString('en-IN') : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-0.5">Next Pull</p>
              <p className="text-base font-medium text-gray-800">
                {syncStatus.nextSync ? new Date(syncStatus.nextSync).toLocaleString('en-IN') : 'Not scheduled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button className="btn btn-primary justify-start gap-2">
            <Users className="size-4" />
            View Beneficiaries
          </button>
          <button className="btn btn-primary justify-start gap-2">
            <FileText className="size-4" />
            Browse Schemes
          </button>
          <button className="btn btn-secondary justify-start gap-2">
            <RefreshCw className="size-4" />
            Sync Schemes
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  Users,
  FileText,
  TrendingUp,
  Activity,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { getDashboardStats, getSyncStatus, getSystemHealth, getActivityLogs } from './adminApi';
import type { DashboardStats, SyncStatus, SystemHealth, ActivityLog } from './adminTypes';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, syncData, healthData, activityData] = await Promise.all([
        getDashboardStats().catch(() => ({
          totalUsers: 0,
          totalSchemes: 0,
          activeSchemes: 0,
          totalApplications: 0,
          userGrowth: 0,
          schemeGrowth: 0,
          applicationGrowth: 0,
        })),
        getSyncStatus().catch(() => null),
        getSystemHealth().catch(() => null),
        getActivityLogs(5).catch(() => []),
      ]);
      setStats(statsData);
      setSyncStatus(syncData);
      setHealth(healthData);
      setRecentActivity(activityData || []);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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

  const statCards = [
    {
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      change: stats?.userGrowth || 0,
      icon: Users,
      color: 'text-[var(--color-primary)]',
      bgColor: 'bg-[var(--color-primary)]/10',
    },
    {
      label: 'Total Schemes',
      value: stats?.totalSchemes || 0,
      change: stats?.schemeGrowth || 0,
      icon: FileText,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      label: 'Active Schemes',
      value: stats?.activeSchemes || 0,
      change: 0,
      icon: CheckCircle,
      color: 'text-[var(--color-accent)]',
      bgColor: 'bg-[var(--color-accent)]/10',
    },
    {
      label: 'Applications',
      value: stats?.totalApplications || 0,
      change: stats?.applicationGrowth || 0,
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Welcome to the admin portal</p>
        </div>
        <button onClick={loadData} className="btn btn-secondary gap-2">
          <RefreshCw className="size-4" />
          Refresh
        </button>
      </div>

      {/* System Health */}
      {health && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`size-3 rounded-full ${
                  health.status === 'healthy'
                    ? 'bg-green-600 animate-pulse'
                    : health.status === 'degraded'
                      ? 'bg-amber-600'
                      : 'bg-red-600'
                }`}
              ></div>
              <span className="font-medium text-gray-900">
                System Status:{' '}
                <span
                  className={
                    health.status === 'healthy'
                      ? 'text-green-600'
                      : health.status === 'degraded'
                        ? 'text-amber-600'
                        : 'text-red-600'
                  }
                >
                  {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={health.neo4j ? 'text-green-600' : 'text-red-600'}>
                Neo4j: {health.neo4j ? '✓' : '✗'}
              </span>
              <span className={health.redis ? 'text-green-600' : 'text-red-600'}>
                Redis: {health.redis ? '✓' : '✗'}
              </span>
              <span className={health.api ? 'text-green-600' : 'text-red-600'}>
                API: {health.api ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="stat-card">
              <div className="flex items-start justify-between">
                <div>
                  <p className="stat-label">{stat.label}</p>
                  <p className="stat-value">{stat.value.toLocaleString()}</p>
                  {stat.change !== 0 && (
                    <p className={`stat-change ${stat.change > 0 ? 'positive' : 'negative'}`}>
                      {stat.change > 0 ? '+' : ''}
                      {stat.change}% from last month
                    </p>
                  )}
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                  <Icon className="size-6" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Scheme Sync Status</h2>
            {syncStatus.isSyncing && (
              <span className="badge badge-info flex items-center gap-1">
                <RefreshCw className="size-3 animate-spin" />
                Syncing...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Schemes</p>
              <p className="text-2xl font-bold text-gray-900">
                {syncStatus.totalSchemes.toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Last Sync</p>
              <p className="text-lg font-medium text-gray-900">
                {syncStatus.lastSync ? new Date(syncStatus.lastSync).toLocaleString() : 'Never'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-1">Next Sync</p>
              <p className="text-lg font-medium text-gray-900">
                {syncStatus.nextSync
                  ? new Date(syncStatus.nextSync).toLocaleString()
                  : 'Not scheduled'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn btn-primary justify-start">
            <Users className="size-5" />
            View All Users
          </button>
          <button className="btn btn-primary justify-start">
            <FileText className="size-5" />
            Manage Schemes
          </button>
          <button className="btn btn-primary justify-start">
            <Activity className="size-5" />
            View Activity Logs
          </button>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        {recentActivity.length === 0 ? (
          <div className="text-center py-8">
            <Activity className="size-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentActivity.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 bg-[var(--color-surface)] rounded-lg"
              >
                <div
                  className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                    log.type === 'user'
                      ? 'bg-[var(--color-primary)]/10'
                      : log.type === 'scheme'
                        ? 'bg-emerald-100'
                        : 'bg-[var(--color-accent)]/10'
                  }`}
                >
                  <Activity
                    className={`size-4 ${
                      log.type === 'user'
                        ? 'text-[var(--color-primary)]'
                        : log.type === 'scheme'
                          ? 'text-emerald-700'
                          : 'text-[var(--color-accent)]'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{log.details}</p>
                  {log.userName && (
                    <p className="text-xs text-gray-400 mt-0.5">by {log.userName}</p>
                  )}
                </div>
                <span className="text-xs text-gray-500 shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

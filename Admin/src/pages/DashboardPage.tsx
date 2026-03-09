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
import { getDashboardStats, getSyncStatus, getSystemHealth } from '../api';
import type { DashboardStats, SyncStatus, SystemHealth } from '../types';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [statsData, syncData, healthData] = await Promise.all([
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
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Total Schemes',
      value: stats?.totalSchemes || 0,
      change: stats?.schemeGrowth || 0,
      icon: FileText,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Active Schemes',
      value: stats?.activeSchemes || 0,
      change: 0,
      icon: CheckCircle,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      label: 'Applications',
      value: stats?.totalApplications || 0,
      change: stats?.applicationGrowth || 0,
      icon: TrendingUp,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
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
        <button onClick={loadData} className="btn btn-secondary">
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
                    ? 'bg-success animate-pulse'
                    : health.status === 'degraded'
                    ? 'bg-warning'
                    : 'bg-danger'
                }`}
              ></div>
              <span className="font-medium text-gray-900">
                System Status:{' '}
                <span
                  className={
                    health.status === 'healthy'
                      ? 'text-success'
                      : health.status === 'degraded'
                      ? 'text-warning'
                      : 'text-danger'
                  }
                >
                  {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className={health.neo4j ? 'text-success' : 'text-danger'}>
                Neo4j: {health.neo4j ? '✓' : '✗'}
              </span>
              <span className={health.redis ? 'text-success' : 'text-danger'}>
                Redis: {health.redis ? '✓' : '✗'}
              </span>
              <span className={health.api ? 'text-success' : 'text-danger'}>
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
                {syncStatus.lastSync
                  ? new Date(syncStatus.lastSync).toLocaleString()
                  : 'Never'}
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
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="size-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <Activity className="size-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">System activity {i}</p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Activity description goes here
                </p>
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {i} min ago
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Activity, User, FileText, Settings, Filter, Download } from 'lucide-react';
import { getActivityLogs } from './adminApi';
import type { ActivityLog } from './adminTypes';

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'user' | 'scheme' | 'system'>('all');

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async () => {
    try {
      const data = await getActivityLogs(100);
      setLogs(data || []);
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = filter === 'all' ? logs : logs.filter((log) => log.type === filter);

  const getIcon = (type: string) => {
    switch (type) {
      case 'user':
        return User;
      case 'scheme':
        return FileText;
      case 'system':
        return Settings;
      default:
        return Activity;
    }
  };

  const getIconColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]';
      case 'scheme':
        return 'bg-emerald-50 text-emerald-600';
      case 'system':
        return 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]';
      default:
        return 'bg-[var(--color-surface-2)] text-[var(--color-muted)]';
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
          <h1 className="text-2xl font-bold text-gray-900">Activity Logs</h1>
          <p className="text-gray-600 mt-1">Monitor system activity and user actions</p>
        </div>
        <button className="btn btn-secondary">
          <Download className="size-4" />
          Export Logs
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600">Total Activities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{logs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">User Actions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {logs.filter((l) => l.type === 'user').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">Scheme Activities</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {logs.filter((l) => l.type === 'scheme').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">System Events</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {logs.filter((l) => l.type === 'system').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <Filter className="size-5 text-gray-400" />
          <div className="flex items-center gap-2">
            {(['all', 'user', 'scheme', 'system'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-ink)] hover:bg-[var(--color-border)]'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="card p-6">
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const Icon = getIcon(log.type);
            const iconColor = getIconColor(log.type);

            return (
              <div key={log.id} className="flex items-start gap-4">
                <div
                  className={`size-10 rounded-lg ${iconColor} flex items-center justify-center shrink-0`}
                >
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-gray-900">{log.action}</p>
                      <p className="text-sm text-gray-600 mt-0.5">{log.details}</p>
                      {log.userName && (
                        <p className="text-xs text-gray-500 mt-1">
                          by {log.userName} ({log.userId})
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-gray-500 shrink-0">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-12">
            <Activity className="size-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No activity logs found</p>
          </div>
        )}
      </div>
    </div>
  );
}

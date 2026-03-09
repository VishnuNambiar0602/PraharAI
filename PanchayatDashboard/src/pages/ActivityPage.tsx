import { useState, useEffect } from 'react';
import { Activity, Users, FileText, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { getActivityLogs } from '../api';
import type { ActivityLog } from '../types';

const typeConfig = {
  user: { icon: Users, color: 'text-blue-500', bg: 'bg-blue-50', badge: 'badge-info' },
  scheme: { icon: FileText, color: 'text-green-600', bg: 'bg-green-50', badge: 'badge-success' },
  system: { icon: SettingsIcon, color: 'text-purple-500', bg: 'bg-purple-50', badge: 'badge-info' },
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'user' | 'scheme' | 'system'>('all');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    try {
      const data = await getActivityLogs();
      setLogs(Array.isArray(data) ? data : data?.logs ?? []);
    } catch (err) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading activity…</p>
      </div>
    );
  }

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.type === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">System events, enrollments, and scheme updates</p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary gap-1.5">
          <RefreshCw className="size-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['all', 'user', 'scheme', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filter === t ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}{t !== 'all' && ` (${logs.filter((l) => l.type === t).length})`}
          </button>
        ))}
      </div>

      {/* Log list */}
      <div className="card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Activity className="size-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">No activity yet</p>
            <p className="text-sm text-gray-400 mt-1">Events will appear here as the system is used.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((log) => {
              const conf = typeConfig[log.type] ?? typeConfig.system;
              const Icon = conf.icon;
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                  <div className={`size-8 rounded-lg ${conf.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                    <Icon className={`size-4 ${conf.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{log.action}</p>
                      <span className={`badge ${conf.badge} text-[10px] py-0`}>{log.type}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{log.details}</p>
                    {log.userName && (
                      <p className="text-[11px] text-gray-400 mt-0.5">by {log.userName}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 tabular-nums shrink-0 mt-0.5">
                    {new Date(log.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

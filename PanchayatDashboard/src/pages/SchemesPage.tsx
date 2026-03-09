import { useState, useEffect } from 'react';
import { Search, RefreshCw, ExternalLink, FileText } from 'lucide-react';
import { getSchemes, getSyncStatus, triggerSync } from '../api';
import type { Scheme, SyncStatus } from '../types';

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [schemesData, syncData] = await Promise.all([
        getSchemes({ limit: 1000 }).catch(() => []),
        getSyncStatus().catch(() => null),
      ]);
      setSchemes(Array.isArray(schemesData) ? schemesData : schemesData?.schemes ?? []);
      setSyncStatus(syncData);
    } catch (err) {
      console.error('Failed to load schemes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('Fetch the latest schemes from India.gov.in? This may take a few minutes.')) return;
    setSyncing(true);
    try {
      await triggerSync();
      setTimeout(loadData, 5000);
    } catch {
      alert('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const filtered = schemes.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading schemes…</p>
      </div>
    );
  }

  const activeSchemes = schemes.filter((s) => s.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Scheme Catalog</h1>
          <p className="text-sm text-gray-500 mt-0.5">Government welfare schemes for beneficiary matching</p>
        </div>
        <button onClick={handleSync} disabled={syncing} className="btn btn-primary gap-1.5">
          <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card blue">
          <p className="stat-label">Total Schemes</p>
          <p className="stat-value">{schemes.length.toLocaleString('en-IN')}</p>
        </div>
        <div className="stat-card green">
          <p className="stat-label">Active</p>
          <p className="stat-value">{activeSchemes.length.toLocaleString('en-IN')}</p>
        </div>
        <div className="stat-card amber">
          <p className="stat-label">Last Synced</p>
          <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">
            {syncStatus?.lastSync ? new Date(syncStatus.lastSync).toLocaleDateString('en-IN') : 'Never'}
          </p>
        </div>
        <div className="stat-card purple">
          <p className="stat-label">Next Sync</p>
          <p className="text-sm font-bold text-gray-900 mt-1 leading-tight">
            {syncStatus?.nextSync ? new Date(syncStatus.nextSync).toLocaleDateString('en-IN') : '—'}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search schemes by name, description, or category…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Scheme Name</th>
                <th>Category</th>
                <th>Ministry</th>
                <th>State</th>
                <th>Status</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((scheme) => (
                <tr key={scheme.scheme_id}>
                  <td>
                    <p className="font-medium text-gray-900 text-sm max-w-xs truncate">{scheme.name}</p>
                  </td>
                  <td>
                    <span className="badge badge-info">{scheme.category || '—'}</span>
                  </td>
                  <td className="text-sm text-gray-600 max-w-[160px] truncate">{scheme.ministry || '—'}</td>
                  <td className="text-sm text-gray-600">{scheme.state || 'Central'}</td>
                  <td>
                    {scheme.is_active
                      ? <span className="badge badge-success">Active</span>
                      : <span className="badge badge-danger">Inactive</span>}
                  </td>
                  <td>
                    {scheme.scheme_url ? (
                      <a href={scheme.scheme_url} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 inline-flex rounded-md hover:bg-blue-50 transition-colors">
                        <ExternalLink className="size-3.5 text-blue-500" />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <FileText className="size-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">{searchTerm ? 'No matching schemes' : 'No schemes loaded'}</p>
            <p className="text-sm text-gray-400 mt-1">
              {searchTerm ? `Try a different search term.` : 'Click "Sync Now" to pull schemes from India.gov.in'}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Showing {Math.min(filtered.length, 200)} of {filtered.length} scheme{filtered.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

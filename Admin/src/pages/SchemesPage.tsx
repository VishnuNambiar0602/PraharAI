import { useState, useEffect } from 'react';
import { Search, Filter, Download, RefreshCw, Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { getAllSchemes, getSyncStatus, triggerSync } from '../api';
import type { Scheme, SyncStatus } from '../types';

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [schemesData, syncData] = await Promise.all([
        getAllSchemes(1000),
        getSyncStatus(),
      ]);
      setSchemes(schemesData);
      setSyncStatus(syncData);
    } catch (error) {
      console.error('Failed to load schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!confirm('This will fetch the latest schemes from India.gov.in. Continue?')) return;

    setSyncing(true);
    try {
      await triggerSync();
      alert('Sync started successfully. This may take a few minutes.');
      setTimeout(loadData, 5000); // Reload after 5 seconds
    } catch (error) {
      alert('Failed to trigger sync');
    } finally {
      setSyncing(false);
    }
  };

  const filteredSchemes = schemes.filter(
    (scheme) =>
      scheme.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scheme.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      scheme.scheme_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h1 className="text-2xl font-bold text-gray-900">Schemes</h1>
          <p className="text-gray-600 mt-1">Manage government schemes</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleSync} disabled={syncing} className="btn btn-secondary">
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button className="btn btn-primary">
            <Plus className="size-4" />
            Add Scheme
          </button>
        </div>
      </div>

      {/* Sync Status */}
      {syncStatus && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Schemes</p>
                <p className="text-xl font-bold text-gray-900">
                  {syncStatus.totalSchemes.toLocaleString()}
                </p>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div>
                <p className="text-sm text-gray-600">Last Sync</p>
                <p className="text-sm font-medium text-gray-900">
                  {syncStatus.lastSync
                    ? new Date(syncStatus.lastSync).toLocaleString()
                    : 'Never'}
                </p>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div>
                <p className="text-sm text-gray-600">Next Sync</p>
                <p className="text-sm font-medium text-gray-900">
                  {syncStatus.nextSync
                    ? new Date(syncStatus.nextSync).toLocaleString()
                    : 'Not scheduled'}
                </p>
              </div>
            </div>
            {syncStatus.isSyncing && (
              <span className="badge badge-info flex items-center gap-1">
                <RefreshCw className="size-3 animate-spin" />
                Syncing...
              </span>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-600">Total Schemes</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{schemes.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">Active</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {schemes.filter((s) => s.is_active).length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">National</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {schemes.filter((s) => !s.state || s.state === '').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-600">State-specific</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {schemes.filter((s) => s.state && s.state !== '').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search schemes by name, ID, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          <button className="btn btn-secondary">
            <Filter className="size-4" />
            Filters
          </button>
          <button className="btn btn-secondary">
            <Download className="size-4" />
            Export
          </button>
        </div>
      </div>

      {/* Schemes Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Scheme ID</th>
                <th>Name</th>
                <th>Category</th>
                <th>Ministry</th>
                <th>State</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchemes.slice(0, 100).map((scheme) => (
                <tr key={scheme.scheme_id}>
                  <td className="font-mono text-xs">{scheme.scheme_id.slice(0, 20)}...</td>
                  <td className="font-medium max-w-xs truncate">{scheme.name}</td>
                  <td>
                    <span className="badge badge-gray">
                      {JSON.parse(scheme.category || '[]')[0] || 'N/A'}
                    </span>
                  </td>
                  <td className="text-sm">{scheme.ministry || 'N/A'}</td>
                  <td className="text-sm">{scheme.state || 'National'}</td>
                  <td>
                    {scheme.is_active ? (
                      <span className="badge badge-success">Active</span>
                    ) : (
                      <span className="badge badge-gray">Inactive</span>
                    )}
                  </td>
                  <td className="text-sm text-gray-600">
                    {new Date(scheme.last_updated).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View details"
                      >
                        <Eye className="size-4 text-gray-600" />
                      </button>
                      <button
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Edit scheme"
                      >
                        <Edit className="size-4 text-gray-600" />
                      </button>
                      <button
                        className="p-1 hover:bg-red-50 rounded"
                        title="Delete scheme"
                      >
                        <Trash2 className="size-4 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredSchemes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No schemes found</p>
          </div>
        )}

        {filteredSchemes.length > 100 && (
          <div className="p-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              Showing 100 of {filteredSchemes.length} schemes
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

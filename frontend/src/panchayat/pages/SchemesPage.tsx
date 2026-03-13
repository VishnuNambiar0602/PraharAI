import { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ExternalLink, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Scheme } from '../types';

const API_BASE = '/api';
const PAGE_SIZE = 50;

async function fetchAllSchemes(): Promise<Scheme[]> {
  const pageSize = 100;
  const all: Scheme[] = [];

  const firstRes = await fetch(`${API_BASE}/schemes?limit=${pageSize}&page=1&paginated=true`);
  if (!firstRes.ok) throw new Error('Failed to fetch schemes');
  const firstData = await firstRes.json();
  const totalPages: number = firstData.totalPages ?? 1;
  all.push(...(firstData.items ?? []));

  if (totalPages > 1) {
    const remaining = Array.from({ length: Math.min(totalPages, 50) - 1 }, (_, i) => i + 2);
    const results = await Promise.all(
      remaining.map((p) =>
        fetch(`${API_BASE}/schemes?limit=${pageSize}&page=${p}&paginated=true`).then((r) =>
          r.ok ? r.json() : null
        )
      )
    );
    for (const result of results) {
      if (result?.items) all.push(...result.items);
    }
  }

  return all;
}

export default function SchemesPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const schemesData = await fetchAllSchemes().catch(() => []);
      setSchemes(schemesData);
    } catch (err) {
      console.error('Failed to load schemes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const filtered = schemes.filter(
    (s) =>
      s.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div
          className="size-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Loading all schemes…
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
          >
            Scheme Catalog
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            Government welfare schemes for beneficiary matching
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="p-btn p-btn-primary gap-1.5 shrink-0"
        >
          <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-stat-card blue">
          <p className="p-stat-label">Total Schemes</p>
          <p className="p-stat-value">{schemes.length.toLocaleString('en-IN')}</p>
        </div>
        <div className="p-stat-card green">
          <p className="p-stat-label">Matching Search</p>
          <p className="p-stat-value">{filtered.length.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Search */}
      <div className="p-card p-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
            style={{ color: 'var(--color-muted-2)' }}
          />
          <input
            type="text"
            placeholder="Search schemes by name, description, or category…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="p-input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="p-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="p-table">
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
              {pageItems.map((scheme) => (
                <tr key={scheme.id}>
                  <td>
                    <p
                      className="font-medium text-sm max-w-xs truncate"
                      style={{ color: 'var(--color-ink)' }}
                    >
                      {scheme.title}
                    </p>
                  </td>
                  <td>
                    <span className="p-badge p-badge-info">{scheme.category || '—'}</span>
                  </td>
                  <td className="text-sm max-w-40 truncate" style={{ color: 'var(--color-ink-2)' }}>
                    {scheme.ministry || '—'}
                  </td>
                  <td className="text-sm" style={{ color: 'var(--color-ink-2)' }}>
                    {scheme.state || 'Central'}
                  </td>
                  <td>
                    <span className="p-badge p-badge-success">Active</span>
                  </td>
                  <td>
                    {scheme.applicationUrl ? (
                      <a
                        href={scheme.applicationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 inline-flex rounded-md transition-colors"
                        style={{ color: 'var(--color-accent)' }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--color-accent-50)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div
              className="size-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'var(--color-surface-2)' }}
            >
              <FileText className="size-7" style={{ color: 'var(--color-muted-2)' }} />
            </div>
            <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
              {searchTerm ? 'No matching schemes' : 'No schemes loaded'}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
              {searchTerm
                ? 'Try a different search term.'
                : 'Click "Sync Now" to pull schemes from India.gov.in'}
            </p>
          </div>
        )}

        {/* Pagination footer */}
        {filtered.length > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              Showing {pageStart + 1}–{Math.min(pageStart + PAGE_SIZE, filtered.length)} of{' '}
              {filtered.length.toLocaleString('en-IN')} scheme{filtered.length !== 1 ? 's' : ''}
              {searchTerm && ` matching "${searchTerm}"`}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="p-btn p-btn-secondary px-2 py-1.5 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-4" />
              </button>
              {/* Page number pills — show window of 5 around current */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                .reduce<(number | '…')[]>((acc, p, i, arr) => {
                  if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push('…');
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === '…' ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-xs"
                      style={{ color: 'var(--color-muted)' }}
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className="size-8 rounded-lg text-xs font-semibold transition-all"
                      style={
                        safePage === item
                          ? { background: 'var(--color-primary)', color: '#fff' }
                          : { color: 'var(--color-ink-2)' }
                      }
                    >
                      {item}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="p-btn p-btn-secondary px-2 py-1.5 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

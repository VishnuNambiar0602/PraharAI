import { useState, useEffect } from 'react';
import { Search, RefreshCw, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAllSchemes, getSyncStatus, triggerSync } from './adminApi';
import type { Scheme, SyncStatus } from './adminTypes';
import { useDialog } from '../DialogProvider';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

// Stable color per category string (deterministic, not random)
const CATEGORY_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-emerald-100 text-emerald-800',
  'bg-violet-100 text-violet-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-cyan-100 text-cyan-800',
  'bg-orange-100 text-orange-800',
  'bg-teal-100 text-teal-800',
];

const categoryCache = new Map<string, string>();
function categoryColor(cat: string) {
  if (!categoryCache.has(cat)) {
    let h = 0;
    for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
    categoryCache.set(cat, CATEGORY_COLORS[h % CATEGORY_COLORS.length]);
  }
  return categoryCache.get(cat)!;
}

function parseCategory(raw: string): string {
  if (!raw) return 'General';
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : 'General';
  } catch {
    return raw;
  }
}

function schemeHref(scheme: Scheme) {
  return scheme.scheme_url ?? `https://www.myscheme.gov.in/schemes/${scheme.scheme_id}`;
}

function safeDate(iso: string) {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SchemesPage() {
  const { confirm, toast } = useDialog();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedCount, setLoadedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(50);

  useEffect(() => {
    loadData();
  }, []);
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pageSize]);

  const loadData = async () => {
    setLoading(true);
    setLoadedCount(0);
    try {
      const [schemesData, syncData] = await Promise.all([getAllSchemes(), getSyncStatus()]);
      setSchemes(schemesData);
      setLoadedCount(schemesData.length);
      setSyncStatus(syncData);
    } catch (error) {
      console.error('Failed to load schemes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    const ok = await confirm({
      title: 'Sync Schemes',
      message: 'This will fetch the latest schemes from India.gov.in. Continue?',
      confirmLabel: 'Sync',
      variant: 'primary',
    });
    if (!ok) return;
    setSyncing(true);
    try {
      await triggerSync();
      toast({
        message: 'Sync started successfully. This may take a few minutes.',
        variant: 'success',
        duration: 5000,
      });
      setTimeout(loadData, 5000);
    } catch {
      toast({ message: 'Failed to trigger sync', variant: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const filteredSchemes = schemes.filter(
    (s) =>
      s.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.scheme_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filteredSchemes.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSchemes = filteredSchemes.slice((safePage - 1) * pageSize, safePage * pageSize);

  const pageWindow = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++)
        pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--color-primary)]" />
        <p className="text-sm text-[var(--color-muted)]">
          {loadedCount > 0 ? `Loading schemes…  ${loadedCount} fetched` : 'Fetching schemes…'}
        </p>
      </div>
    );
  }

  const activeCount = schemes.filter((s) => s.is_active).length;
  const stateCount = schemes.filter((s) => s.state && s.state !== 'National').length;

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">Schemes</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {syncStatus
              ? `${syncStatus.totalSchemes.toLocaleString()} schemes in database`
              : 'Manage government schemes'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn btn-secondary">
            <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* ── Sync strip ─────────────────────────────────────────── */}
      {syncStatus && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white px-5 py-3 flex items-center gap-6 flex-wrap text-sm">
          {syncStatus.isSyncing && (
            <span className="flex items-center gap-1.5 text-[var(--color-accent)] font-medium">
              <RefreshCw className="size-3.5 animate-spin" /> Sync in progress…
            </span>
          )}
          <span className="text-[var(--color-muted)]">
            Last sync:{' '}
            <span className="font-medium text-[var(--color-ink)]">
              {syncStatus.lastSync ? safeDate(syncStatus.lastSync) : 'Never'}
            </span>
          </span>
          {syncStatus.nextSync && (
            <span className="text-[var(--color-muted)]">
              Next:{' '}
              <span className="font-medium text-[var(--color-ink)]">
                {safeDate(syncStatus.nextSync)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* ── Stats row ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Loaded', value: schemes.length },
          { label: 'Active', value: activeCount },
          { label: 'National', value: schemes.length - stateCount },
          { label: 'State-specific', value: stateCount },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <p className="text-xs text-[var(--color-muted)] uppercase tracking-wide font-medium">
              {label}
            </p>
            <p className="text-2xl font-bold text-[var(--color-ink)] mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Search + page-size toolbar ─────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[var(--color-muted)]" />
          <input
            type="text"
            placeholder="Search by name, ID, or description…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-base pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-[var(--color-muted)]">Show</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            className="input-base w-18 text-sm py-1.5"
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-sm text-[var(--color-muted)]">per page</span>
        </div>
        {searchTerm && (
          <span className="text-xs text-[var(--color-muted)] bg-[var(--color-surface-2)] px-2 py-1 rounded-md">
            {filteredSchemes.length} result{filteredSchemes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[var(--color-border)] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]">
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide w-[38%]">
                  Name
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide">
                  Category
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide hidden lg:table-cell">
                  Ministry
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide hidden md:table-cell">
                  State
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-semibold text-[var(--color-muted)] text-xs uppercase tracking-wide hidden xl:table-cell">
                  Updated
                </th>
                <th className="w-12" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {paginatedSchemes.map((scheme) => {
                const cat = parseCategory(scheme.category);
                const href = schemeHref(scheme);
                return (
                  <tr
                    key={scheme.scheme_id}
                    className="hover:bg-[var(--color-surface-2)]/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[var(--color-ink)] hover:text-[var(--color-primary)] hover:underline line-clamp-2 leading-snug"
                        title={scheme.name}
                      >
                        {scheme.name || '—'}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${categoryColor(cat)}`}
                      >
                        {cat}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 text-[var(--color-muted)] text-xs hidden lg:table-cell max-w-[180px] truncate"
                      title={scheme.ministry ?? undefined}
                    >
                      {scheme.ministry || '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span
                        className={`text-xs font-medium ${scheme.state && scheme.state !== 'National' ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}
                      >
                        {scheme.state || 'National'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                          scheme.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${scheme.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`}
                        />
                        {scheme.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--color-muted)] hidden xl:table-cell">
                      {safeDate(scheme.last_updated)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center size-7 rounded-lg text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/8 transition-colors"
                        title="Open on myscheme.gov.in"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredSchemes.length === 0 && (
          <div className="text-center py-16">
            <p className="text-[var(--color-muted)] font-medium">No schemes found</p>
            {searchTerm && (
              <p className="text-xs text-[var(--color-muted)] mt-1">Try a different search term</p>
            )}
          </div>
        )}

        {/* ── Pagination footer ─────────────────────────── */}
        {filteredSchemes.length > 0 && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/40 flex items-center justify-between gap-4 flex-wrap">
            <p className="text-xs text-[var(--color-muted)]">
              Showing{' '}
              <span className="font-medium text-[var(--color-ink)]">
                {(safePage - 1) * pageSize + 1}–
                {Math.min(safePage * pageSize, filteredSchemes.length)}
              </span>{' '}
              of{' '}
              <span className="font-medium text-[var(--color-ink)]">{filteredSchemes.length}</span>{' '}
              schemes
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="size-7 flex items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="size-3.5" />
              </button>
              {pageWindow().map((p, i) =>
                p === '...' ? (
                  <span
                    key={`el-${i}`}
                    className="px-1.5 text-[var(--color-muted)] text-sm select-none"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p as number)}
                    className={`min-w-[1.75rem] h-7 px-1 rounded-lg border text-xs font-medium transition-colors ${
                      safePage === p
                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                        : 'border-[var(--color-border)] hover:bg-white text-[var(--color-ink)]'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="size-7 flex items-center justify-center rounded-lg border border-[var(--color-border)] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users,
  Database,
  Sparkles,
  RefreshCw,
  Clock3,
  Activity,
  Server,
  HardDrive,
  Cpu,
} from 'lucide-react';
import { AdminMetricsResponse, fetchAdminMetrics } from '../api';

function toShortDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(5);
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function buildPolylinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const maxValue = Math.max(...values, 1);
  const stepX = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, idx) => {
      const x = idx * stepX;
      const y = height - (value / maxValue) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoading(true);
      setError('');
      const data = await fetchAdminMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admin metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const topCards = useMemo(() => {
    if (!metrics) return [];
    return [
      {
        label: 'Registered Users',
        value: metrics.users.total,
        icon: Users,
        hint: `${metrics.users.onboarded} onboarded`,
      },
      {
        label: 'Schemes Pulled',
        value: metrics.schemes.pulled,
        icon: Database,
        hint: `${metrics.schemes.inGraph} currently in graph`,
      },
      {
        label: 'Schemes Enriched',
        value: metrics.schemes.enriched,
        icon: Sparkles,
        hint: `${metrics.schemes.enrichmentRate}% enrichment rate`,
      },
      {
        label: 'Profiles Updated',
        value: metrics.users.updatedProfiles,
        icon: Activity,
        hint: 'Users with profile changes saved',
      },
    ];
  }, [metrics]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="overline mb-2">Administration</p>
            <h1
              className="text-3xl"
              style={{ fontFamily: 'Lora, Georgia, serif', color: 'var(--color-ink)' }}
            >
              Admin Dashboard
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-muted)', fontFamily: 'Inter, sans-serif' }}>
              Monitor users, scheme ingestion, enrichment quality, and system health.
            </p>
          </div>

          <button
            onClick={() => loadMetrics(true)}
            disabled={refreshing}
            className="btn btn-primary"
          >
            <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh Metrics
          </button>
        </div>

        {loading && (
          <div className="card p-6">Loading admin metrics...</div>
        )}

        {!loading && error && (
          <div className="card p-6 border-red-200" style={{ color: '#B91C1C' }}>
            {error}
          </div>
        )}

        {!loading && !error && metrics && (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {topCards.map((card, idx) => (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.06 }}
                  className="card-elevated p-5"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-muted)' }}>
                      {card.label}
                    </span>
                    <card.icon className="size-4" style={{ color: 'var(--color-accent)' }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {card.value.toLocaleString()}
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--color-muted-2)' }}>
                    {card.hint}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <div className="card p-5 lg:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="size-4" style={{ color: 'var(--color-accent)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Sync & Enrichment Status
                  </h2>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div style={{ color: 'var(--color-muted)' }}>Sync Running</div>
                    <div className="font-semibold mt-1" style={{ color: metrics.sync.isSyncing ? '#166534' : 'var(--color-ink)' }}>
                      {metrics.sync.isSyncing ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div style={{ color: 'var(--color-muted)' }}>Next Sync</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--color-ink)' }}>
                      {formatDateTime(metrics.sync.nextSync)}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div style={{ color: 'var(--color-muted)' }}>With Eligibility Data</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--color-ink)' }}>
                      {metrics.schemes.withEligibility.toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'var(--color-surface-2)' }}>
                    <div style={{ color: 'var(--color-muted)' }}>With Benefits Data</div>
                    <div className="font-semibold mt-1" style={{ color: 'var(--color-ink)' }}>
                      {metrics.schemes.withBenefits.toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock3 className="size-4" style={{ color: 'var(--color-accent)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Last Update
                  </h2>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Last Scheme Sync</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {formatDateTime(metrics.sync.lastSync)}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Metrics Generated</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {formatDateTime(metrics.generatedAt)}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid xl:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    User Growth (Last 7 Days)
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    New registrations per day
                  </span>
                </div>

                <svg viewBox="0 0 300 120" className="w-full h-32" role="img" aria-label="User growth chart">
                  <polyline
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="3"
                    points={buildPolylinePoints(metrics.trends.users.map((d) => d.count), 300, 100)}
                  />
                </svg>

                <div className="grid grid-cols-7 gap-1 mt-2 text-[10px]">
                  {metrics.trends.users.map((point) => (
                    <div key={point.date} className="text-center" style={{ color: 'var(--color-muted)' }}>
                      <div>{toShortDateLabel(point.date)}</div>
                      <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                        {point.count}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Sync Activity (Last 7 Days)
                  </h2>
                  <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                    Synced vs enriched schemes
                  </span>
                </div>

                <svg viewBox="0 0 300 120" className="w-full h-32" role="img" aria-label="Sync activity chart">
                  <polyline
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth="2.5"
                    points={buildPolylinePoints(metrics.trends.sync.map((d) => d.synced), 300, 100)}
                  />
                  <polyline
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2.5"
                    points={buildPolylinePoints(metrics.trends.sync.map((d) => d.enriched), 300, 100)}
                  />
                </svg>

                <div className="flex items-center gap-4 text-xs mb-2" style={{ color: 'var(--color-muted)' }}>
                  <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full" style={{ background: 'var(--color-primary)' }} /> Synced</span>
                  <span className="flex items-center gap-1"><span className="inline-block size-2 rounded-full" style={{ background: 'var(--color-accent)' }} /> Enriched</span>
                </div>

                <div className="grid grid-cols-7 gap-1 text-[10px]">
                  {metrics.trends.sync.map((point) => (
                    <div key={point.date} className="text-center" style={{ color: 'var(--color-muted)' }}>
                      <div>{toShortDateLabel(point.date)}</div>
                      <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                        {point.synced}/{point.enriched}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <HardDrive className="size-4" style={{ color: 'var(--color-accent)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    Cache Health
                  </h2>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Available</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.cache.available ? 'Yes' : 'No'}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Hit Rate</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.cache.hitRate}%
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Hits / Misses</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.cache.hits} / {metrics.cache.misses}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--color-muted)' }}>Uptime</div>
                    <div className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {formatUptime(metrics.cache.uptime)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="size-4" style={{ color: 'var(--color-accent)' }} />
                  <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                    ML Service Health
                  </h2>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Available: </span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.mlService.available ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Endpoint: </span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.mlService.baseUrl}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Timeout: </span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {metrics.mlService.timeoutMs} ms
                    </span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--color-muted)' }}>Last Health Check: </span>
                    <span className="font-semibold" style={{ color: 'var(--color-ink)' }}>
                      {formatDateTime(metrics.mlService.lastCheckAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  X,
  Sparkles,
  ExternalLink,
  User,
  MapPin,
  Briefcase,
  GraduationCap,
  ChevronRight,
  PlusCircle,
  ChevronLeft,
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import {
  getPanchayatCitizens,
  registerCitizen,
  getPanchayatUser,
  getRecommendationsForBeneficiary,
} from '../api';
import type { Beneficiary } from '../types';

const AVATAR_PALETTE = [
  { bg: 'rgba(16,40,69,0.1)', text: '#24537d' },
  { bg: 'rgba(217,122,16,0.12)', text: '#a95a0a' },
  { bg: 'rgba(197,95,54,0.12)', text: '#c55f36' },
  { bg: 'rgba(139,92,246,0.12)', text: '#7c3aed' },
  { bg: 'rgba(6,182,212,0.12)', text: '#0891b2' },
  { bg: 'rgba(24,122,66,0.12)', text: '#187a42' },
];

function getAvatarStyle(name: string) {
  let h = 0;
  for (const c of name || 'U') h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function getLocationLabel(
  beneficiary: Pick<Beneficiary, 'panchayatName' | 'village' | 'district' | 'state'>
) {
  return [beneficiary.panchayatName || beneficiary.village, beneficiary.district, beneficiary.state]
    .filter(Boolean)
    .join(', ');
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  benefits: string;
  eligibilityScore: number;
  applicationUrl: string;
}

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onboardingFilter, setOnboardingFilter] = useState<'all' | 'complete' | 'pending'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<Beneficiary | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [recsError, setRecsError] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [form, setForm] = useState({
    name: '',
    email: '',
    age: '',
    gender: '',
    employment: '',
    income: '',
    education: '',
  });
  const locationState = useLocation().state as { openRegister?: boolean } | null;
  const panchayatUser = getPanchayatUser();
  const pageSize = 20;

  const loadCitizens = async (options?: {
    search?: string;
    page?: number;
    onboarding?: 'all' | 'complete' | 'pending';
    preserveSelection?: boolean;
  }) => {
    const nextPage = options?.page ?? page;
    const nextSearch = options?.search ?? debouncedSearch;
    const nextOnboarding = options?.onboarding ?? onboardingFilter;

    const data = await getPanchayatCitizens({
      q: nextSearch || undefined,
      page: nextPage,
      limit: pageSize,
      onboarding: nextOnboarding,
    });

    setBeneficiaries(Array.isArray(data.items) ? data.items : []);
    setTotal(data.total || 0);
    setHasMore(Boolean(data.hasMore));
    setPage(data.page || nextPage);

    if (!options?.preserveSelection && selected) {
      const updatedSelection = (data.items || []).find((item) => item.userId === selected.userId);
      if (!updatedSelection) {
        setSelected(null);
        setRecs([]);
      } else {
        setSelected(updatedSelection);
      }
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setLoading(true);
    loadCitizens({ search: debouncedSearch, page, onboarding: onboardingFilter })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch, onboardingFilter, page]);

  // Open register panel if navigated here with openRegister state
  useEffect(() => {
    if (locationState?.openRegister) setShowRegister(true);
  }, [locationState]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      setRegisterError('Name and email are required.');
      return;
    }
    setRegistering(true);
    setRegisterError('');
    setRegisterSuccess('');
    try {
      await registerCitizen({
        name: form.name.trim(),
        email: form.email.trim(),
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        employment: form.employment || undefined,
        income: form.income || undefined,
        education: form.education || undefined,
      });
      setRegisterSuccess(
        `${form.name} registered successfully. They can complete onboarding later.`
      );
      setForm({
        name: '',
        email: '',
        age: '',
        gender: '',
        employment: '',
        income: '',
        education: '',
      });
      setPage(1);
      await loadCitizens({ search: debouncedSearch, page: 1, onboarding: onboardingFilter });
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setRegistering(false);
    }
  };

  const selectCitizen = (b: Beneficiary) => {
    setSelected(b);
    setRecs([]);
    setRecsError('');
  };

  const handleMatchSchemes = async () => {
    if (!selected) return;
    setLoadingRecs(true);
    setRecsError('');
    try {
      const data = await getRecommendationsForBeneficiary(selected.userId);
      setRecs(Array.isArray(data) ? data : []);
    } catch {
      setRecsError('Could not load recommendations. Please try again.');
    } finally {
      setLoadingRecs(false);
    }
  };

  const onboarded = useMemo(
    () => beneficiaries.filter((u) => u.onboardingComplete).length,
    [beneficiaries]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-amber-500 animate-spin" />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Loading citizens…
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="md:flex md:gap-5" style={{ minHeight: 'calc(100vh - 7rem)' }}>
        {/* ── Left: citizen list ──────────────────────────────── */}
        <div
          className={`flex flex-col gap-4 transition-all duration-300 ${selected ? 'hidden md:flex md:w-3/5 md:min-w-0' : 'flex w-full'}`}
        >
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1
                className="text-xl font-bold tracking-tight"
                style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
              >
                Citizen Service Desk
              </h1>
              <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
                {panchayatUser?.panchayatName
                  ? `${panchayatUser.panchayatName} — ${panchayatUser.district || panchayatUser.state || ''}`
                  : 'Select a citizen to match them with welfare schemes'}
              </p>
            </div>
            <button
              onClick={() => {
                setShowRegister(true);
                setRegisterError('');
                setRegisterSuccess('');
              }}
              className="p-btn p-btn-primary gap-1.5 shrink-0"
            >
              <PlusCircle className="size-3.5" />
              Register Citizen
            </button>
          </div>

          {/* Stats strip */}
          <div
            className="grid grid-cols-3 gap-px rounded-xl overflow-hidden"
            style={{ background: 'var(--color-border)', border: '1px solid var(--color-border)' }}
          >
            {[
              {
                label: 'Total Citizens',
                value: total,
                color: 'var(--color-primary-600)',
              },
              { label: 'Onboarded', value: onboarded, color: '#059669' },
              {
                label: 'Visible on page',
                value: beneficiaries.length,
                color: 'var(--color-accent-700)',
              },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="px-5 py-3.5 flex items-center gap-3"
                style={{ background: 'var(--color-parchment)' }}
              >
                <p className="text-2xl font-bold tabular-nums leading-none" style={{ color }}>
                  {value}
                </p>
                <p
                  className="text-xs font-medium leading-tight"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Table + integrated search */}
          <div className="p-card overflow-hidden flex-1 flex flex-col">
            {/* Search header */}
            <div
              className="px-4 py-3 flex items-center gap-3"
              style={{ borderBottom: '1px solid var(--color-border)' }}
            >
              <Search className="size-4 shrink-0" style={{ color: 'var(--color-muted-2)' }} />
              <input
                type="text"
                placeholder="Search by name, email, district, or panchayat…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm"
                style={{ color: 'var(--color-ink)' }}
              />
              <select
                value={onboardingFilter}
                onChange={(e) => {
                  setOnboardingFilter(e.target.value as 'all' | 'complete' | 'pending');
                  setPage(1);
                }}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-medium"
                style={{
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-ink)',
                  background: 'var(--color-parchment)',
                }}
              >
                <option value="all">All statuses</option>
                <option value="complete">Onboarded only</option>
                <option value="pending">Registered only</option>
              </select>
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setPage(1);
                  }}
                  className="shrink-0"
                  style={{ color: 'var(--color-muted-2)' }}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="overflow-y-auto thin-scroll flex-1">
              <table className="p-table">
                <thead
                  className="sticky top-0 z-10"
                  style={{ background: 'var(--color-parchment)' }}
                >
                  <tr>
                    <th>Citizen</th>
                    <th className={selected ? 'hidden xl:table-cell' : ''}>Location</th>
                    <th className={selected ? 'hidden xl:table-cell' : ''}>Employment</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {beneficiaries.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10">
                        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                          No citizens found
                        </p>
                      </td>
                    </tr>
                  )}
                  {beneficiaries.map((u) => {
                    const av = getAvatarStyle(u.name || '');
                    const isSelected = selected?.userId === u.userId;
                    return (
                      <tr
                        key={u.userId}
                        onClick={() => selectCitizen(u)}
                        className="cursor-pointer"
                        style={
                          isSelected
                            ? {
                                background: 'var(--color-accent-50)',
                                borderLeft: '3px solid var(--color-accent)',
                              }
                            : {}
                        }
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <div
                              className="p-user-avatar"
                              style={{ background: av.bg, color: av.text }}
                            >
                              {getInitials(u.name || '')}
                            </div>
                            <div>
                              <p
                                className="font-semibold text-xs"
                                style={{ color: 'var(--color-ink)' }}
                              >
                                {u.name || '—'}
                              </p>
                              <p className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className={selected ? 'hidden xl:table-cell' : ''}>
                          <span className="text-xs" style={{ color: 'var(--color-ink-2)' }}>
                            {getLocationLabel(u) || '—'}
                          </span>
                        </td>
                        <td className={selected ? 'hidden xl:table-cell' : ''}>
                          <span className="text-xs" style={{ color: 'var(--color-ink-2)' }}>
                            {u.employment || '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`p-badge ${u.onboardingComplete ? 'p-badge-success' : 'p-badge-info'}`}
                          >
                            {u.onboardingComplete ? 'Onboarded' : 'Registered'}
                          </span>
                        </td>
                        <td>
                          <ChevronRight
                            className="size-3.5"
                            style={{
                              color: isSelected ? 'var(--color-accent)' : 'var(--color-muted-2)',
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div
              className="px-4 py-3 flex items-center justify-between gap-3 border-t"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Showing{' '}
                {(beneficiaries.length === 0 ? 0 : (page - 1) * pageSize + 1).toLocaleString(
                  'en-IN'
                )}{' '}
                to {Math.min(page * pageSize, total).toLocaleString('en-IN')} of{' '}
                {total.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="p-btn p-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  <ChevronLeft className="size-3.5" /> Prev
                </button>
                <span className="text-xs font-semibold" style={{ color: 'var(--color-ink-2)' }}>
                  Page {page}
                </span>
                <button
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!hasMore}
                  className="p-btn p-btn-secondary px-3 py-1.5 text-xs disabled:opacity-50"
                >
                  Next <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: AI matching panel ────────────────────────── */}
        {selected && (
          <div className="w-full flex flex-col gap-4 overflow-y-auto thin-scroll md:w-2/5 md:min-w-70">
            {/* Mobile back button */}
            <button
              onClick={() => {
                setSelected(null);
                setRecs([]);
              }}
              className="md:hidden p-btn p-btn-secondary gap-2 self-start"
            >
              <ChevronLeft className="size-4" />
              Back to Citizens
            </button>
            {/* Citizen profile card */}
            <div className="p-card p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const av = getAvatarStyle(selected.name || '');
                    return (
                      <div
                        className="size-12 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
                        style={{ background: av.bg, color: av.text }}
                      >
                        {getInitials(selected.name || '')}
                      </div>
                    );
                  })()}
                  <div>
                    <h2
                      className="text-base font-bold"
                      style={{
                        color: 'var(--color-ink)',
                        fontFamily: 'Space Grotesk, sans-serif',
                      }}
                    >
                      {selected.name || '—'}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                      {selected.email}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelected(null);
                    setRecs([]);
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  style={{ color: 'var(--color-muted-2)' }}
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Profile attributes */}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  {
                    icon: MapPin,
                    label: 'Location',
                    value: getLocationLabel(selected) || '—',
                  },
                  {
                    icon: Briefcase,
                    label: 'Employment',
                    value: selected.employment || '—',
                  },
                  {
                    icon: GraduationCap,
                    label: 'Education',
                    value: selected.education || '—',
                  },
                  {
                    icon: User,
                    label: 'Gender / Age',
                    value:
                      [selected.gender, selected.age ? `${selected.age} yrs` : undefined]
                        .filter(Boolean)
                        .join(', ') || '—',
                  },
                ].map(({ icon: Icon, label, value }) => (
                  <div
                    key={label}
                    className="p-2.5 rounded-lg"
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Icon className="size-3" style={{ color: 'var(--color-muted)' }} />
                      <p
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-muted)' }}
                      >
                        {label}
                      </p>
                    </div>
                    <p className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {/* AI match button */}
              <button
                onClick={handleMatchSchemes}
                disabled={loadingRecs}
                className="p-btn p-btn-primary w-full justify-center mt-4 gap-2"
              >
                {loadingRecs ? (
                  <>
                    <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Matching with AI…
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" />
                    Match Schemes with AI
                  </>
                )}
              </button>
            </div>

            {/* Error */}
            {recsError && (
              <div className="p-card p-4" style={{ borderColor: '#fecaca' }}>
                <p className="text-sm text-red-600">{recsError}</p>
              </div>
            )}

            {/* Scheme recommendations */}
            {recs.length > 0 && (
              <div className="p-card overflow-hidden">
                <div className="p-4" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <p
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--color-muted)' }}
                  >
                    {recs.length} scheme{recs.length !== 1 ? 's' : ''} matched
                  </p>
                </div>
                <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {recs.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 transition-colors"
                      style={{ background: 'transparent' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-accent-50)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-semibold"
                            style={{ color: 'var(--color-ink)' }}
                          >
                            {rec.title}
                          </p>
                          <p
                            className="text-xs mt-0.5 line-clamp-2"
                            style={{ color: 'var(--color-muted)' }}
                          >
                            {rec.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                background: 'var(--color-accent-50)',
                                color: 'var(--color-accent-800)',
                                border: '1px solid var(--color-accent-100)',
                              }}
                            >
                              {rec.category}
                            </span>
                            {rec.eligibilityScore > 0 && (
                              <span className="text-[10px]" style={{ color: 'var(--color-muted)' }}>
                                {Math.round(rec.eligibilityScore * 100)}% match
                              </span>
                            )}
                          </div>
                          {rec.eligibilityScore > 0 && (
                            <div className="p-score-bar mt-2">
                              <div
                                className="p-score-bar-fill"
                                style={{
                                  width: `${Math.round(rec.eligibilityScore * 100)}%`,
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <a
                          href={rec.applicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-btn p-btn-secondary px-3 py-1.5 text-xs shrink-0 gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Apply
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loadingRecs && recs.length === 0 && !recsError && (
              <div className="p-card p-8 text-center">
                <Sparkles
                  className="size-8 mx-auto mb-3"
                  style={{ color: 'var(--color-muted-2)' }}
                />
                <p className="text-sm font-medium" style={{ color: 'var(--color-ink-2)' }}>
                  Match this citizen with welfare schemes
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                  Click "Match Schemes with AI" to get personalised recommendations
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Register Citizen panel ───────────────────────── */}
      {showRegister && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-end"
          style={{ background: 'rgba(0,0,0,0.35)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowRegister(false);
          }}
        >
          <div
            className="h-full w-full max-w-md flex flex-col overflow-y-auto"
            style={{
              background: 'var(--color-parchment)',
              borderLeft: '1px solid var(--color-border)',
            }}
          >
            <div
              className="sticky top-0 flex items-center justify-between px-6 py-4 border-b"
              style={{
                background: 'var(--color-parchment)',
                borderColor: 'var(--color-border)',
                zIndex: 1,
              }}
            >
              <div>
                <h2
                  className="text-base font-bold"
                  style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  Register New Citizen
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  {panchayatUser?.state
                    ? `Will be registered in ${panchayatUser.district || panchayatUser.state}`
                    : 'New citizen registration'}
                </p>
              </div>
              <button
                onClick={() => setShowRegister(false)}
                className="p-1.5 rounded-lg"
                style={{ color: 'var(--color-muted-2)' }}
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleRegister} className="flex flex-col gap-4 p-6">
              {registerSuccess && (
                <div
                  className="p-3 rounded-xl text-sm font-medium"
                  style={{
                    background: 'var(--color-success-50)',
                    color: 'var(--color-success)',
                    border: '1px solid var(--color-success-100)',
                  }}
                >
                  {registerSuccess}
                </div>
              )}
              {registerError && (
                <div
                  className="p-3 rounded-xl text-sm"
                  style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}
                >
                  {registerError}
                </div>
              )}

              {[
                {
                  field: 'name',
                  label: 'Full Name *',
                  type: 'text',
                  placeholder: 'e.g. Ramesh Kumar',
                },
                {
                  field: 'email',
                  label: 'Email Address *',
                  type: 'email',
                  placeholder: 'e.g. ramesh@example.com',
                },
                { field: 'age', label: 'Age', type: 'number', placeholder: 'e.g. 35' },
                {
                  field: 'income',
                  label: 'Annual Income (₹)',
                  type: 'text',
                  placeholder: 'e.g. 120000',
                },
              ].map(({ field, label, type, placeholder }) => (
                <div key={field}>
                  <label
                    className="block text-xs font-semibold mb-1.5"
                    style={{ color: 'var(--color-ink-2)' }}
                  >
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[field]}
                    onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                    className="p-input text-sm"
                  />
                </div>
              ))}

              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  Gender
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  className="p-input text-sm"
                >
                  <option value="">Select gender</option>
                  {['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  Employment
                </label>
                <select
                  value={form.employment}
                  onChange={(e) => setForm((f) => ({ ...f, employment: e.target.value }))}
                  className="p-input text-sm"
                >
                  <option value="">Select employment</option>
                  {[
                    'Farmer',
                    'Agricultural Labourer',
                    'Daily Wage Worker',
                    'Self-Employed',
                    'Salaried',
                    'Unemployed',
                    'Student',
                    'Homemaker',
                    'Other',
                  ].map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="block text-xs font-semibold mb-1.5"
                  style={{ color: 'var(--color-ink-2)' }}
                >
                  Education
                </label>
                <select
                  value={form.education}
                  onChange={(e) => setForm((f) => ({ ...f, education: e.target.value }))}
                  className="p-input text-sm"
                >
                  <option value="">Select education</option>
                  {[
                    'No Formal Education',
                    'Primary',
                    'Middle School',
                    'Secondary (10th)',
                    'Higher Secondary (12th)',
                    'Graduate',
                    'Post-Graduate',
                  ].map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRegister(false)}
                  className="p-btn p-btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={registering}
                  className="p-btn p-btn-primary flex-1 gap-2"
                >
                  {registering ? (
                    <>
                      <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Registering…
                    </>
                  ) : (
                    <>
                      <PlusCircle className="size-4" />
                      Register
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

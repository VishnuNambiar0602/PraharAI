import { motion } from 'motion/react';
import {
  Search,
  ExternalLink,
  School,
  Tractor as Agriculture,
  Baby,
  HeartPulse,
  Map,
  User,
  Zap,
  Filter,
  AlertCircle,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  MapPin,
} from 'lucide-react';
import { useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Scheme } from '../types';
import { fetchSchemesPage } from '../api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Skeleton } from './ui';

const CATEGORIES = [
  { icon: Agriculture, label: 'Farmer', labelKey: 'schemes.category_farmer' },
  { icon: School, label: 'Student', labelKey: 'schemes.category_student' },
  { icon: Baby, label: 'Women', labelKey: 'schemes.category_women' },
  { icon: HeartPulse, label: 'Health', labelKey: 'schemes.category_health' },
  { icon: Map, label: 'State', labelKey: 'schemes.category_state' },
  { icon: Zap, label: 'Employment', labelKey: 'schemes.category_employment' },
  { icon: BookOpen, label: 'Education', labelKey: 'schemes.category_education' },
  { icon: User, label: 'Social welfare', labelKey: 'schemes.category_social' },
];

const ITEMS_PER_PAGE = 12;

interface SchemeExplorerProps {
  onSchemeSelect?: (scheme: Scheme) => void;
}

export default function SchemeExplorer({ onSchemeSelect }: SchemeExplorerProps = {}) {
  const { t } = useTranslation();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSchemes, setTotalSchemes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    loadSchemes('', '', 1);
  }, []);

  const loadSchemes = async (searchQuery = '', category = '', page = 1) => {
    setLoading(true);
    setError('');
    try {
      const combined = [searchQuery, category].filter(Boolean).join(' ');
      const data = await fetchSchemesPage(combined || undefined, page, ITEMS_PER_PAGE);
      const list: Scheme[] = Array.isArray(data?.items) ? (data.items as Scheme[]) : [];
      setSchemes(list);
      setTotalSchemes(Number(data?.total) || 0);
      setTotalPages(Math.max(1, Number(data?.totalPages) || 1));
      setCurrentPage(Math.max(1, Number(data?.page) || page));
    } catch {
      setError(t('chat.error'));
      setSchemes([]);
      setTotalSchemes(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const activeCategoryLabel = CATEGORIES.find((cat) => cat.label === activeCategory)?.labelKey;

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    loadSchemes(query, activeCategory, 1);
  };

  const handleCategory = (label: string) => {
    const next = activeCategory === label ? '' : label;
    setActiveCategory(next);
    loadSchemes(query, next, 1);
  };

  const shownCount = Math.min(currentPage * ITEMS_PER_PAGE, totalSchemes);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    loadSchemes(query, activeCategory, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getBenefitsPreview = (scheme: Scheme): string | undefined => {
    return scheme.pageDetails?.benefits?.[0] || scheme.benefits || scheme.benefit;
  };

  const getEligibilityPreview = (scheme: Scheme): string | undefined => {
    return scheme.pageDetails?.eligibility?.[0] || scheme.eligibility;
  };

  return (
    <div className="schemes-page min-h-screen" style={{ background: 'var(--color-surface)' }}>
      {/* ── Page Header ── */}
      <div style={{ background: 'var(--color-parchment)', borderBottom: '1px solid var(--color-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 pb-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            <div className="flex-1">
              <span className="overline">{t('schemes.subtitle')}</span>
              <h1
                className="font-display text-2xl sm:text-3xl font-bold mt-1"
                style={{ color: 'var(--color-ink)' }}
              >
                {t('schemes.title')}
              </h1>
            </div>
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg w-full">
              <div className="relative flex items-center">
                <Search
                  className="absolute left-4 size-4.5 pointer-events-none"
                  style={{ color: 'var(--color-muted)' }}
                />
                <input
                  className="input-base pl-12! pr-28!"
                  placeholder={t('schemes.search_placeholder')}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="btn btn-navy absolute right-2 py-1.5! px-4! text-xs!">
                  {t('common.search')}
                </button>
              </div>
            </form>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar pb-1">
            <button
              onClick={() => {
                setActiveCategory('');
                loadSchemes(query, '', 1);
              }}
              className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold border transition-all"
              style={
                !activeCategory
                  ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
                  : { background: 'var(--color-parchment)', color: 'var(--color-muted)', border: '1.5px solid var(--color-border)' }
              }
            >
              <Filter className="size-3.5" /> {t('schemes.all_categories')}
            </button>
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategory(cat.label)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-bold border transition-all"
                style={
                  activeCategory === cat.label
                    ? { background: 'var(--color-primary)', color: '#fff', border: '1.5px solid var(--color-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }
                    : { background: 'var(--color-parchment)', color: 'var(--color-muted)', border: '1.5px solid var(--color-border)' }
                }
              >
                <cat.icon className="size-3.5" />
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-medium text-muted">
            {loading
              ? t('schemes.loading')
              : `${t('schemes.showing', {
                  count: shownCount,
                  total: totalSchemes,
                })}${activeCategoryLabel ? ` (${t(activeCategoryLabel)})` : ''}`}
          </p>
        </div>

        {loading && (
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5 pb-8">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="card overflow-hidden">
                <div style={{ height: '3px', background: 'var(--color-border)' }} />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="shimmer h-5 w-3/4 rounded-md" />
                    <div className="shimmer h-5 w-16 rounded-full" />
                  </div>
                  <div className="shimmer h-3.5 w-full rounded mb-2" />
                  <div className="shimmer h-3.5 w-5/6 rounded mb-4" />
                  <div className="shimmer h-14 w-full rounded-xl mb-4" />
                  <div className="flex gap-2">
                    <div className="shimmer h-9 flex-1 rounded-lg" />
                    <div className="shimmer h-9 flex-1 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="card p-5 flex items-center gap-3 text-red-700 border-red-200 bg-red-50">
            <AlertCircle className="size-5 shrink-0" />
            <p className="text-sm flex-1">{error}</p>
            <button
              onClick={() => loadSchemes(query, activeCategory, currentPage)}
              className="text-xs font-bold underline"
            >
              {t('schemes.retry')}
            </button>
          </div>
        )}

        {!loading && !error && totalSchemes === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
            <BookOpen className="size-12 opacity-30" />
            <p className="text-sm font-medium">
              {t('schemes.no_results')}. {t('schemes.try_different')}.
            </p>
          </div>
        )}

        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-5 pb-8">
          {!loading &&
            schemes.map((scheme, idx) => (
              <motion.div
                key={scheme.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4), duration: 0.3 }}
                className="h-full"
              >
                <div
                  className="card h-full flex flex-col cursor-pointer overflow-hidden"
                  style={{ transition: 'box-shadow 0.2s ease, transform 0.2s ease' }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('a, button')) return;
                    if (onSchemeSelect) onSchemeSelect(scheme);
                  }}
                  onMouseEnter={(e) => {
                    const dark = document.documentElement.classList.contains('dark');
                    (e.currentTarget as HTMLElement).style.boxShadow = dark
                      ? '0 1px 0 rgba(255,255,255,0.04), 0 18px 30px rgba(0,0,0,0.42)'
                      : '0 8px 24px rgba(26,18,8,0.12), 0 2px 6px rgba(26,18,8,0.06)';
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '';
                    (e.currentTarget as HTMLElement).style.transform = '';
                  }}
                >
                  {/* Accent top stripe */}
                  <div
                    style={{
                      height: '3px',
                      background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-accent) 100%)',
                      flexShrink: 0,
                    }}
                  />

                  <div className="p-5 flex-1 flex flex-col gap-3">
                    {/* Title */}
                    <h3
                      className="font-semibold text-sm leading-snug"
                      style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}
                    >
                      {scheme.title}
                    </h3>

                    {/* Category tag — sits below the title */}
                    <div className="flex items-center gap-1.5">
                      <span
                        className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-primary-50), var(--color-accent-50))',
                          color: 'var(--color-primary-600)',
                          border: '1px solid var(--color-primary-100)',
                        }}
                      >
                        <span
                          className="size-1.5 rounded-full shrink-0"
                          style={{ background: 'var(--color-accent)' }}
                        />
                        {scheme.category || t('schemes.general')}
                      </span>
                    </div>

                    {scheme.description && (
                      <p className="text-xs line-clamp-2" style={{ color: 'var(--color-muted)' }}>
                        {scheme.description}
                      </p>
                    )}

                    {/* Benefits highlight */}
                    {getBenefitsPreview(scheme) && (
                      <div
                        className="flex items-start gap-2 p-3 rounded-xl"
                        style={{
                          background: 'var(--color-accent-50)',
                          borderLeft: '3px solid var(--color-accent)',
                        }}
                      >
                        <Zap
                          className="size-3.5 shrink-0 mt-0.5"
                          style={{ color: 'var(--color-accent)' }}
                        />
                        <p
                          className="text-xs font-semibold line-clamp-2 break-words"
                          style={{ color: 'var(--color-ink)' }}
                        >
                          {getBenefitsPreview(scheme)}
                        </p>
                      </div>
                    )}

                    {/* Eligibility */}
                    <div className="flex items-start gap-2">
                      <User
                        className="size-3.5 shrink-0 mt-0.5"
                        style={{ color: 'var(--color-muted)' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[9px] font-bold uppercase tracking-wider mb-0.5"
                          style={{ color: 'var(--color-muted)' }}
                        >
                          {t('schemes.eligibility')}
                        </p>
                        <p className="text-xs line-clamp-2 break-words" style={{ color: 'var(--color-ink)' }}>
                          {getEligibilityPreview(scheme) || t('schemes.view_details')}
                        </p>
                      </div>
                    </div>

                    {/* State tag */}
                    {scheme.state && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full w-fit flex items-center gap-1"
                        style={{
                          background: 'var(--color-surface-2)',
                          color: 'var(--color-muted)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        <MapPin className="size-2.5" />
                        {scheme.state}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="mt-auto pt-2 flex gap-2">
                      <button
                        className="btn btn-ghost flex-1 py-2! text-xs!"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSchemeSelect) onSchemeSelect(scheme);
                        }}
                      >
                        {t('schemes.view_details')}
                      </button>
                      <a
                        href={
                          scheme.applicationUrl ||
                          `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.id)}`
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="btn btn-navy flex-1 py-2! text-xs!"
                      >
                        {t('schemes.apply_now')} <ExternalLink className="size-3" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-center gap-2 mt-8 mb-4">
            <button
              className="btn btn-ghost py-2! px-4! text-xs! flex items-center gap-1.5"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-3.5" />
              <span className="hidden sm:inline">{t('schemes.previous')}</span>
            </button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) {
                  pageNum = i + 1;
                } else if (currentPage <= 4) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i;
                } else {
                  pageNum = currentPage - 3 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className="size-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all"
                    style={
                      currentPage === pageNum
                        ? { background: 'var(--color-primary)', color: '#fff' }
                        : { background: 'transparent', color: 'var(--color-muted)' }
                    }
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              className="btn btn-ghost py-2! px-4! text-xs! flex items-center gap-1.5"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <span className="hidden sm:inline">{t('schemes.next')}</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

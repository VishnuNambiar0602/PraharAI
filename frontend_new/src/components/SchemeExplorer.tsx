import { motion } from 'motion/react';
import {
  Search,
  Filter,
  ExternalLink,
  School,
  Tractor as Agriculture,
  Baby,
  HeartPulse,
  Map,
  User,
  Zap,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';

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

  return (
    <div className="min-h-screen bg-surface">
      {/* ── Page Header ── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row lg:items-center gap-6">
            <div className="flex-1">
              <h1 className="font-display text-3xl font-bold text-ink">{t('schemes.title')}</h1>
              <p className="text-muted text-sm mt-1">{t('schemes.subtitle')}</p>
            </div>
            {/* Search */}
            <form onSubmit={handleSearch} className="flex-1 max-w-lg">
              <div className="relative flex items-center">
                <Search className="absolute left-4 text-muted size-5 pointer-events-none" />
                <input
                  className="input-base pl-12! pr-28!"
                  placeholder={t('schemes.search_placeholder')}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <button type="submit" className="absolute right-2 btn-navy py-1.5! px-4! text-xs!">
                  {t('common.search')}
                </button>
              </div>
            </form>
          </div>

          {/* Category pills */}
          <div className="flex gap-2 mt-5 overflow-x-auto no-scrollbar">
            <button
              onClick={() => {
                setActiveCategory('');
                loadSchemes(query, '', 1);
              }}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                !activeCategory
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-muted border-border hover:border-primary/40 hover:text-primary'
              }`}
            >
              <Filter className="size-3.5" /> {t('schemes.all_categories')}
            </button>
            {CATEGORIES.map((cat, i) => (
              <button
                key={i}
                onClick={() => handleCategory(cat.label)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors ${
                  activeCategory === cat.label
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-muted border-border hover:border-primary/40 hover:text-primary'
                }`}
              >
                <cat.icon className="size-3.5" />
                {t(cat.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="max-w-7xl mx-auto px-6 py-8">
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
              <Card key={idx} className="p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-5/6 mb-4" />
                <Skeleton className="h-16 w-full rounded-lg mb-4" />
                <Skeleton className="h-10 w-full" />
              </Card>
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
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
              >
                <Card
                  className="h-full flex flex-col hover:shadow-lg transition-all duration-200 cursor-pointer"
                  onClick={(e) => {
                    // Don't trigger if clicking on buttons or links
                    if ((e.target as HTMLElement).closest('a, button')) return;
                    if (onSchemeSelect) onSchemeSelect(scheme);
                  }}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <CardTitle className="text-base leading-snug flex-1">
                        {scheme.title}
                      </CardTitle>
                      <Badge variant="secondary" className="shrink-0">
                        {scheme.category || t('schemes.general')}
                      </Badge>
                    </div>
                    {scheme.description && (
                      <CardDescription className="line-clamp-2">
                        {scheme.description}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col gap-4">
                    {(scheme.benefits || scheme.benefit) && (
                      <div className="flex items-start gap-2 p-3 bg-accent-50 rounded-lg border-l-4 border-accent">
                        <Zap className="size-4 text-accent shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-ink line-clamp-2">
                          {scheme.benefits || scheme.benefit}
                        </p>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <User className="size-4 text-muted shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-muted uppercase tracking-wider">
                          {t('schemes.eligibility')}
                        </p>
                        <p className="text-xs text-ink mt-0.5 line-clamp-2">
                          {scheme.eligibility || t('schemes.view_details')}
                        </p>
                      </div>
                    </div>

                    {scheme.state && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-3.5 text-muted" />
                        <Badge variant="outline" className="text-xs">
                          {scheme.state}
                        </Badge>
                      </div>
                    )}

                    <div className="mt-auto pt-2 flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSchemeSelect) onSchemeSelect(scheme);
                        }}
                      >
                        {t('schemes.view_details')}
                      </Button>
                      <Button asChild variant="default" className="flex-1" size="sm">
                        <a
                          href={
                            scheme.applicationUrl ||
                            `https://www.myscheme.gov.in/search?q=${encodeURIComponent(scheme.id)}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {t('schemes.apply_now')} <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="size-4" />
              {t('schemes.previous')}
            </Button>

            <div className="flex gap-1">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum;
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
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                    className="w-9"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              {t('schemes.next')}
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

import { motion } from 'motion/react';
import {
  ArrowLeft,
  ExternalLink,
  Share2,
  Bookmark,
  BookmarkCheck,
  Calendar,
  FileText,
  CheckCircle2,
  MapPin,
  Building,
  BadgeCheck,
  Check,
  Link2,
  ClipboardList,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Scheme } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface SchemeDetailProps {
  scheme: Scheme;
  onBack: () => void;
}

function normalizeList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMarkdown(value?: string | null): string {
  if (!value) return '';

  const withLineBreaks = value.replace(/<br\s*\/?>/gi, '\n');
  if (typeof window === 'undefined' || typeof DOMParser === 'undefined') {
    return withLineBreaks;
  }

  const parsed = new DOMParser().parseFromString(withLineBreaks, 'text/html');
  const decoded = parsed.documentElement.textContent || '';
  return decoded.trim();
}

export default function SchemeDetail({ scheme, onBack }: SchemeDetailProps) {
  const { t } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  const pageDetails = scheme.pageDetails;

  const eligibilityItems = useMemo(() => {
    if (scheme.eligibilityCriteria?.length) return scheme.eligibilityCriteria;
    if (pageDetails?.eligibility?.length) return pageDetails.eligibility;
    return normalizeList(scheme.eligibility);
  }, [scheme.eligibilityCriteria, scheme.eligibility, pageDetails?.eligibility]);

  const benefitsItems = useMemo(() => {
    if (scheme.benefitsList?.length) return scheme.benefitsList;
    if (pageDetails?.benefits?.length) return pageDetails.benefits;
    const fallback = scheme.benefits || scheme.benefit;
    return normalizeList(fallback);
  }, [scheme.benefitsList, scheme.benefits, scheme.benefit, pageDetails?.benefits]);

  const references = pageDetails?.references ?? [];
  const processSteps = pageDetails?.applicationProcess ?? [];

  const eligibilityMarkdown = useMemo(
    () => normalizeMarkdown(pageDetails?.eligibilityMarkdown),
    [pageDetails?.eligibilityMarkdown]
  );
  const benefitsMarkdown = useMemo(
    () => normalizeMarkdown(pageDetails?.benefitsMarkdown),
    [pageDetails?.benefitsMarkdown]
  );
  const descriptionMarkdown = useMemo(
    () => normalizeMarkdown(pageDetails?.descriptionMarkdown),
    [pageDetails?.descriptionMarkdown]
  );
  const exclusionsMarkdown = useMemo(
    () => normalizeMarkdown(pageDetails?.exclusionsMarkdown),
    [pageDetails?.exclusionsMarkdown]
  );

  const hasEligibilityContent = Boolean(eligibilityMarkdown) || eligibilityItems.length > 0;
  const hasBenefitsContent = Boolean(benefitsMarkdown) || benefitsItems.length > 0;
  const hasApplicationContent =
    processSteps.length > 0 ||
    Boolean(scheme.applicationProcess) ||
    Boolean(scheme.applicationUrl) ||
    Boolean(scheme.requiredDocuments && scheme.requiredDocuments.length > 0);

  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarkedSchemes') || '[]');
    setIsBookmarked(bookmarks.includes(scheme.id));
  }, [scheme.id]);

  const toggleBookmark = () => {
    const bookmarks = JSON.parse(localStorage.getItem('bookmarkedSchemes') || '[]');
    if (isBookmarked) {
      const updated = bookmarks.filter((id: string) => id !== scheme.id);
      localStorage.setItem('bookmarkedSchemes', JSON.stringify(updated));
      setIsBookmarked(false);
    } else {
      bookmarks.push(scheme.id);
      localStorage.setItem('bookmarkedSchemes', JSON.stringify(bookmarks));
      setIsBookmarked(true);
    }
  };

  const handleShare = async () => {
    const url = scheme.applicationUrl || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: scheme.title,
          text: scheme.description || t('scheme_detail.help_text'),
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      }
    } catch {
      await navigator.clipboard.writeText(url);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="size-4" />
          {t('scheme_detail.back')}
        </Button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">{scheme.category}</Badge>
                    {scheme.status && (
                      <Badge variant="outline">
                        <span className="capitalize">{scheme.status}</span>
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl mb-3 break-words">{scheme.title}</CardTitle>
                  {(descriptionMarkdown || scheme.description || pageDetails?.description) && (
                    <div className="markdown-content text-muted text-sm leading-relaxed break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {descriptionMarkdown || scheme.description || pageDetails?.description || ''}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 shrink-0 w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleBookmark}
                    className="relative flex-1 sm:flex-none"
                  >
                    {isBookmarked ? (
                      <BookmarkCheck className="size-4 text-accent" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare} className="relative flex-1 sm:flex-none">
                    {showCopySuccess ? (
                      <Check className="size-4 text-green-600" />
                    ) : (
                      <Share2 className="size-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {hasEligibilityContent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <CheckCircle2 className="size-5 text-primary" />
                      {t('scheme_detail.eligibility')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {eligibilityMarkdown ? (
                      <div className="markdown-content text-ink text-sm leading-relaxed break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {eligibilityMarkdown}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {eligibilityItems.map((item, idx) => (
                          <li key={`${idx}-${item.slice(0, 15)}`} className="text-ink text-sm leading-relaxed break-words">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {hasBenefitsContent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BadgeCheck className="size-5 text-accent" />
                      {t('scheme_detail.benefits')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {benefitsMarkdown ? (
                      <div className="markdown-content text-ink text-sm leading-relaxed break-words">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {benefitsMarkdown}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <ul className="space-y-2">
                        {benefitsItems.map((item, idx) => (
                          <li key={`${idx}-${item.slice(0, 15)}`} className="text-ink text-sm leading-relaxed break-words">
                            • {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              {exclusionsMarkdown && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <ShieldAlert className="size-5 text-terra" />
                      Exclusions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="markdown-content text-ink text-sm leading-relaxed break-words">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {exclusionsMarkdown}
                      </ReactMarkdown>
                    </div>
                  </CardContent>
                </Card>
              )}

              {hasApplicationContent && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="size-5 text-primary" />
                      {t('scheme_detail.how_to_apply')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted text-sm">{t('scheme_detail.help_text')}</p>
                    {processSteps.length > 0 && (
                      <div className="space-y-4">
                        {processSteps.map((process, processIndex) => (
                          <div key={`${process.mode}-${processIndex}`} className="space-y-2">
                            <p className="text-sm font-semibold text-ink break-words">{process.mode}</p>
                            {process.steps.length > 0 ? (
                              <ul className="space-y-2 list-disc pl-5">
                                {process.steps.map((step, idx) => (
                                  <li key={`${idx}-${step.slice(0, 15)}`} className="text-sm text-muted leading-relaxed break-words">
                                    <div className="markdown-content text-sm text-muted leading-relaxed break-words">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {step}
                                      </ReactMarkdown>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-muted leading-relaxed break-words">
                                {normalizeMarkdown(process.markdown)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!processSteps.length && scheme.applicationProcess && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                          Application Process
                        </p>
                        <p className="text-sm text-ink break-words leading-relaxed">
                          {scheme.applicationProcess}
                        </p>
                      </div>
                    )}
                    {scheme.requiredDocuments && scheme.requiredDocuments.length > 0 && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
                          Required Documents
                        </p>
                        <ul className="space-y-1.5">
                          {scheme.requiredDocuments.map((doc, idx) => (
                            <li key={`${doc}-${idx}`} className="text-sm text-ink break-words">
                              • {doc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {scheme.applicationUrl && (
                      <Button asChild className="w-full sm:w-auto">
                        <a href={scheme.applicationUrl} className="flex gap-2 items-center" target="_blank" rel="noopener noreferrer">
                          {t('scheme_detail.apply_button')}
                          <ExternalLink className="size-4" />
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>
              )}

              {references.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Link2 className="size-5 text-primary" />
                      Official References
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {references.map((reference, idx) => (
                      <a
                        key={`${reference.url}-${idx}`}
                        href={reference.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm text-primary hover:bg-surface-2 min-w-0 gap-2"
                      >
                        <span className="min-w-0 break-words">{reference.title}</span>
                        <ExternalLink className="size-3.5 shrink-0" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('scheme_detail.quick_info')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted font-medium uppercase tracking-wider">
                        {t('scheme_detail.category_label')}
                      </p>
                        <p className="text-sm font-semibold text-ink mt-0.5 capitalize break-words">
                        {scheme.category}
                      </p>
                    </div>
                  </div>

                  {(scheme.ministry || pageDetails?.ministry) && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          Ministry
                        </p>
                        <p className="text-sm font-semibold text-ink mt-0.5 break-words">
                          {scheme.ministry || pageDetails?.ministry}
                        </p>
                      </div>
                    </div>
                  )}

                  {scheme.state && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <MapPin className="size-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          State / UT
                        </p>
                        <p className="text-sm font-semibold text-ink mt-0.5 break-words">{scheme.state}</p>
                      </div>
                    </div>
                  )}

                  {scheme.deadline && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <Calendar className="size-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          {t('scheme_detail.deadline_label')}
                        </p>
                        <p className="text-sm font-semibold text-ink mt-0.5">{scheme.deadline}</p>
                      </div>
                    </div>
                  )}

                  {scheme.status && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="size-5 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          {t('scheme_detail.status_label')}
                        </p>
                        <p className="text-sm font-semibold text-ink mt-0.5 capitalize">
                          {scheme.status}
                        </p>
                      </div>
                    </div>
                  )}

                  {scheme.tags && scheme.tags.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <BadgeCheck className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          Tags
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {scheme.tags.map((tag) => (
                            <span key={tag} className="pill pill-primary text-[10px]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {scheme.matchedCategories && scheme.matchedCategories.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="size-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                        <ClipboardList className="size-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-medium uppercase tracking-wider">
                          Matched Categories
                        </p>
                        <div className="space-y-1 mt-1">
                          {scheme.matchedCategories.map((cat, idx) => (
                            <p key={`${cat.type}-${cat.value}-${idx}`} className="text-sm text-ink break-words">
                              {cat.type}: {cat.value}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="text-base">{t('scheme_detail.need_help')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted leading-relaxed">
                    {t('scheme_detail.help_text')}
                  </p>
                  <Button variant="outline" className="w-full" size="sm">
                    {t('scheme_detail.ask_assistant')}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

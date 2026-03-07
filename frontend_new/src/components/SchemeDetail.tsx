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
  Copy,
  Check,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Scheme } from '../types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface SchemeDetailProps {
  scheme: Scheme;
  onBack: () => void;
}

export default function SchemeDetail({ scheme, onBack }: SchemeDetailProps) {
  const { t } = useTranslation();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showCopySuccess, setShowCopySuccess] = useState(false);

  // Check if scheme is bookmarked on mount
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
          url: url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setShowCopySuccess(true);
        setTimeout(() => setShowCopySuccess(false), 2000);
      }
    } catch (error) {
      // Fallback to clipboard
      await navigator.clipboard.writeText(url);
      setShowCopySuccess(true);
      setTimeout(() => setShowCopySuccess(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={onBack} className="mb-6">
          <ArrowLeft className="size-4" />
          {t('scheme_detail.back')}
        </Button>

        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="default">{scheme.category}</Badge>
                    {scheme.status && (
                      <Badge variant="outline">
                        <span className="capitalize">{scheme.status}</span>
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-3xl mb-3">{scheme.title}</CardTitle>
                  {scheme.description && (
                    <p className="text-muted leading-relaxed">{scheme.description}</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleBookmark}
                    className="relative"
                  >
                    {isBookmarked ? (
                      <BookmarkCheck className="size-4 text-accent" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleShare} className="relative">
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

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-6">
              {/* Eligibility */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <CheckCircle2 className="size-5 text-primary" />
                    {t('scheme_detail.eligibility')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-ink leading-relaxed whitespace-pre-line">
                      {scheme.eligibility}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Benefits */}
              {(scheme.benefits || scheme.benefit) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BadgeCheck className="size-5 text-accent" />
                      {t('scheme_detail.benefits')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-ink leading-relaxed whitespace-pre-line">
                        {scheme.benefits || scheme.benefit}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Application Process */}
              {scheme.applicationUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <FileText className="size-5 text-primary" />
                      {t('scheme_detail.how_to_apply')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted text-sm">{t('scheme_detail.help_text')}</p>
                    <Button asChild className="w-full sm:w-auto">
                      <a href={scheme.applicationUrl} className="flex gap-2 items-center" target="_blank" rel="noopener noreferrer">
                        {t('scheme_detail.apply_button')}
                        <ExternalLink className="size-4" />
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Quick Info */}
            <div className="space-y-6">
              {/* Quick Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('scheme_detail.quick_info')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Category */}
                  <div className="flex items-start gap-3">
                    <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted font-medium uppercase tracking-wider">
                        {t('scheme_detail.category_label')}
                      </p>
                      <p className="text-sm font-semibold text-ink mt-0.5 capitalize">
                        {scheme.category}
                      </p>
                    </div>
                  </div>

                  {/* Deadline */}
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

                  {/* Status */}
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
                </CardContent>
              </Card>

              {/* Help Card */}
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

import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import {
  Sparkles,
  TrendingUp,
  FileText,
  MessageSquare,
  ArrowRight,
  Clock,
  Target,
  ArrowUpRight,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Skeleton } from './ui/skeleton';
import { Scheme } from '../types';
import { fetchRecommendations } from '../api';

interface DashboardProps {
  user: any;
  onNavigate: (view: string) => void;
}

export default function Dashboard({ user, onNavigate }: DashboardProps) {
  const [recommendations, setRecommendations] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, []);

  const loadRecommendations = async () => {
    try {
      const data = await fetchRecommendations(user.userId);
      setRecommendations(data.slice(0, 5) as any);
    } catch (error) {
      console.error('Failed to load recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate profile completeness
  const profileFields = [
    user.name,
    user.email,
    user.age,
    user.state,
    user.employment,
    user.income,
    user.education,
    user.gender,
    (user as any)?.socialCategory,
    (user as any)?.interests,
    (user as any)?.maritalStatus,
    (user as any)?.residenceType,
    (user as any)?.occupation,
  ];
  const filledFields = profileFields.filter(Boolean).length;
  const completeness = Math.round((filledFields / profileFields.length) * 100);

  const stats = [
    {
      label: 'Profile Complete',
      value: `${completeness}%`,
      icon: Target,
      color: 'text-accent',
      bgColor: 'bg-accent-50',
    },
    {
      label: 'Schemes Viewed',
      value: '0',
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary-50',
    },
    {
      label: 'Applications',
      value: '0',
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success-50',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* ── Welcome bar ── */}
      <div className="relative overflow-hidden" style={{ background: 'var(--color-primary)' }}>
        {/* Subtle warm glow */}
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(200,112,13,0.15), transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 relative">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="overline mb-3" style={{ color: '#E8A855' }}>Welcome back</p>
            <h1
              className="text-white leading-tight mb-2"
              style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
                fontWeight: 400,
              }}
            >
              {user.name ? `Good to see you, ${user.name.split(' ')[0]}.` : 'Good to see you.'}
            </h1>
            <p
              className="max-w-lg"
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.9rem',
                lineHeight: '1.6',
              }}
            >
              Here are your personalised government scheme recommendations based on your profile.
            </p>
          </motion.div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-3 mt-7">
            {[
              { label: 'Profile complete', value: `${completeness}%` },
              { label: 'Schemes viewed', value: '0' },
              { label: 'Saved schemes', value: '0' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
                className="px-5 py-3 rounded-xl flex items-center gap-3"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
              >
                <span
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: 'Lora, Georgia, serif' }}
                >
                  {s.value}
                </span>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter, sans-serif', fontSize: '0.72rem' }}>
                  {s.label}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-20 md:pb-8">
        <div className="grid lg:grid-cols-[1fr_300px] gap-6">

          {/* Left: Recommendations */}
          <div className="space-y-5">

            {/* Profile completeness nudge */}
            {completeness < 100 && (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 cursor-pointer group"
                style={{ borderLeft: '3px solid var(--color-accent)' }}
                onClick={() => onNavigate('profile')}
              >
                <div className="size-10 rounded-lg shrink-0 flex items-center justify-center" style={{ background: 'var(--color-accent-50)' }}>
                  <Target className="size-5" style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}>
                    Complete your profile for better matches
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-2)' }}>
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'var(--color-accent)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${completeness}%` }}
                        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.3 }}
                      />
                    </div>
                    <span className="text-xs font-bold" style={{ color: 'var(--color-accent)', fontFamily: 'Space Grotesk, sans-serif' }}>
                      {completeness}%
                    </span>
                  </div>
                </div>
                <ArrowRight className="size-4 shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--color-accent)' }} />
              </motion.div>
            )}

            {/* Recommended schemes */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="size-4" style={{ color: 'var(--color-accent)' }} />
                  <h2
                    className="font-semibold"
                    style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.95rem', color: 'var(--color-ink)' }}
                  >
                    Recommended for You
                  </h2>
                </div>
                <button
                  onClick={() => onNavigate('schemes')}
                  className="flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: 'var(--color-accent)', fontFamily: 'Inter, sans-serif' }}
                >
                  View all <ChevronRight className="size-3" />
                </button>
              </div>

              <div className="space-y-2.5">
                {loading && Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="card p-4 space-y-2">
                    <Skeleton className="h-4 w-3/4 shimmer rounded" />
                    <Skeleton className="h-3 w-full shimmer rounded" />
                  </div>
                ))}

                {!loading && recommendations.map((scheme, idx) => (
                  <motion.div
                    key={scheme.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.07 + 0.2 }}
                    className="card p-4 cursor-pointer group hover:border-accent/40 transition-all"
                    onClick={() => onNavigate('schemes')}
                  >
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <h4
                        className="font-semibold text-sm leading-snug flex-1 group-hover:text-accent transition-colors"
                        style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}
                      >
                        {scheme.title}
                      </h4>
                      {scheme.category && (
                        <span className="pill pill-primary text-[10px] shrink-0">{scheme.category}</span>
                      )}
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--color-muted)', fontFamily: 'Inter, sans-serif' }}>
                      {scheme.description || 'Government benefit scheme'}
                    </p>
                    <div className="flex items-center justify-end mt-2">
                      <span
                        className="text-[11px] font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ color: 'var(--color-accent)', fontFamily: 'Space Grotesk, sans-serif' }}
                      >
                        View details <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </motion.div>
                ))}

                {!loading && recommendations.length === 0 && (
                  <div className="card p-10 text-center">
                    <FileText className="size-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--color-muted)' }} />
                    <p className="text-sm" style={{ color: 'var(--color-muted)', fontFamily: 'Inter, sans-serif' }}>
                      No recommendations yet — browse all schemes to get started
                    </p>
                    <button onClick={() => onNavigate('schemes')} className="btn btn-primary mt-4 text-xs">
                      Browse Schemes <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

          {/* Right: Actions sidebar */}
          <div className="space-y-4">
            {/* Quick actions */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <p className="overline mb-3 px-1">Quick access</p>
              <div className="space-y-2">
                {[
                  { icon: FileText, label: 'Browse All Schemes', view: 'schemes' },
                  { icon: MessageSquare, label: 'AI Assistant', view: 'assistant' },
                  { icon: Target, label: 'Update Profile', view: 'profile' },
                ].map((action) => (
                  <button
                    key={action.view}
                    onClick={() => onNavigate(action.view)}
                    className="w-full card px-4 py-3 flex items-center gap-3 text-left group hover:border-accent/40 transition-all"
                  >
                    <div className="size-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-2)' }}>
                      <action.icon className="size-4 group-hover:text-accent transition-colors" style={{ color: 'var(--color-muted)' }} />
                    </div>
                    <span
                      className="text-sm font-medium flex-1"
                      style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}
                    >
                      {action.label}
                    </span>
                    <ChevronRight className="size-3.5 opacity-30 group-hover:opacity-60 transition-opacity" style={{ color: 'var(--color-muted)' }} />
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Recent activity placeholder */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-elevated p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="size-4" style={{ color: 'var(--color-muted)' }} />
                <p
                  className="font-semibold text-sm"
                  style={{ color: 'var(--color-ink)', fontFamily: 'Inter, sans-serif' }}
                >
                  Recent Activity
                </p>
              </div>
              <div className="py-6 text-center">
                <p className="text-xs" style={{ color: 'var(--color-muted-2)', fontFamily: 'Inter, sans-serif' }}>
                  Your activity will appear here as you explore schemes.
                </p>
              </div>
            </motion.div>

            {/* AI suggest card */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              className="rounded-xl p-5 cursor-pointer group"
              style={{ background: 'var(--color-primary)', border: '1px solid rgba(255,255,255,0.08)' }}
              onClick={() => onNavigate('assistant')}
            >
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="size-4" style={{ color: '#E8A855' }} />
                <p className="text-white text-sm font-semibold" style={{ fontFamily: 'Inter, sans-serif' }}>
                  Ask Prahar AI
                </p>
              </div>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Inter, sans-serif' }}>
                Chat with our AI to instantly find schemes you qualify for.
              </p>
              <span
                className="flex items-center gap-1 text-xs font-bold"
                style={{ color: '#E8A855', fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Start a conversation <ArrowUpRight className="size-3" />
              </span>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
}

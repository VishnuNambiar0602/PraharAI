import { motion, useScroll, useTransform } from 'motion/react';
import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Languages,
  Zap,
  ShieldCheck,
  Mic,
  LayoutGrid,
  MessageSquare,
  Users,
  BookOpen,
  Tractor,
  Heart,
  TrendingUp,
  Clock,
  Globe2,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { View } from '../types';

interface LandingPageProps {
  onNavigate: (view: View) => void;
}

/* Floating stat card used in hero */
function StatFloat({
  value,
  label,
  delay = 0,
}: {
  value: string;
  label: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-white/[0.07] border border-white/[0.13] rounded-xl px-4 py-3 backdrop-blur-sm"
    >
      <p
        className="text-2xl font-bold text-white leading-none"
        style={{ fontFamily: 'Lora, Georgia, serif' }}
      >
        {value}
      </p>
      <p className="text-white/50 text-[11px] mt-1 font-medium">{label}</p>
    </motion.div>
  );
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const { t } = useTranslation();
  const [schemeCount, setSchemeCount] = useState<number | null>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0.3]);
  const heroY = useTransform(scrollY, [0, 400], [0, 60]);

  useEffect(() => {
    fetch('/api/schemes/stats')
      .then((r) => r.json())
      .then((d) => {
        if (d.totalSchemes) setSchemeCount(d.totalSchemes);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col">

      {/* ─── HERO ──────────────────────────────────────────── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden min-h-[92vh] flex flex-col justify-center hero-mesh grain"
      >
        {/* Dot matrix texture */}
        <div
          className="absolute inset-0 opacity-[0.06] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Warm glow patch bottom-right */}
        <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[80px] pointer-events-none" />

        <motion.div
          style={{ opacity: heroOpacity, y: heroY }}
          className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 w-full"
        >
          <div className="grid lg:grid-cols-[1fr_400px] gap-16 items-start">

            {/* Left */}
            <div>
              {/* Overline */}
              <motion.div
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45 }}
                className="flex items-center gap-3 mb-7"
              >
                <span className="overline" style={{ color: '#E8A855' }}>
                  {t('landing.gov_badge')}
                </span>
                <span className="text-white/25 text-xs">·</span>
                <span className="overline" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {t('landing.official_data')}
                </span>
              </motion.div>

              {/* Headline — large editorial serif */}
              <motion.h1
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="text-white leading-[1.07]"
                style={{
                  fontFamily: 'Lora, Georgia, serif',
                  fontSize: 'clamp(3rem, 6.5vw, 5.5rem)',
                  fontWeight: 400,
                }}
              >
                {t('landing.hero_line_1')}{' '}
                {t('landing.hero_line_2')}
                <br />
                <em className="not-italic" style={{ color: '#E8A855' }}>
                  {t('landing.hero_line_3')}
                </em>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.18 }}
                className="text-white/55 text-base md:text-lg max-w-[34rem] leading-relaxed mt-6 mb-9"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {t('landing.hero_subtitle', {
                  count: schemeCount
                    ? schemeCount.toLocaleString('en-IN')
                    : t('landing.hero_subtitle_fallback'),
                })}
              </motion.p>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.27 }}
                className="flex flex-col sm:flex-row gap-3 mb-10"
              >
                <button
                  onClick={() => onNavigate('schemes')}
                  className="btn btn-primary text-sm h-12 px-7"
                >
                  {t('landing.cta_check_eligibility')}
                  <ArrowRight className="size-4" />
                </button>
                <button
                  onClick={() => onNavigate('assistant')}
                  className="btn btn-outline-white text-sm h-12 px-7"
                >
                  <MessageSquare className="size-4" />
                  {t('landing.cta_talk_to_ai')}
                </button>
              </motion.div>

              {/* Trust row */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.36 }}
                className="flex flex-wrap gap-5"
              >
                {[
                  t('landing.trust_badge_1'),
                  t('landing.trust_badge_2'),
                  t('landing.trust_badge_3'),
                ].map((b) => (
                  <span
                    key={b}
                    className="flex items-center gap-1.5 text-white/45 text-xs"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    <CheckCircle2 className="size-3 text-emerald-400 shrink-0" />
                    {b}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Right: floating stats + scheme preview card */}
            <div className="hidden lg:flex flex-col gap-4 pt-2">
              {/* Floating stat badges */}
              <div className="flex gap-3">
                <StatFloat
                  value={schemeCount ? schemeCount.toLocaleString('en-IN') + '+' : '1,200+'}
                  label={t('landing.stat_schemes')}
                  delay={0.4}
                />
                <StatFloat value="22+" label={t('landing.stat_languages')} delay={0.5} />
              </div>

              {/* Scheme match card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, delay: 0.32 }}
                className="rounded-2xl overflow-hidden shadow-2xl shadow-black/40"
                style={{ background: 'var(--color-parchment)' }}
              >
                {/* Card header */}
                <div className="bg-primary-800 px-5 py-4 flex items-center gap-3 border-b border-white/10">
                  <div className="size-8 rounded-lg bg-accent/20 flex items-center justify-center">
                    <Sparkles className="size-4 text-accent-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-white text-sm font-semibold"
                      style={{ fontFamily: 'Inter, sans-serif' }}
                    >
                      {t('landing.match_engine_title')}
                    </p>
                    <p className="text-white/40 text-[11px]">{t('landing.match_engine_subtitle')}</p>
                  </div>
                  <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.4)]" />
                </div>

                <div className="p-4 space-y-2.5">
                  {[
                    { scheme: 'PM-KISAN Samman Nidhi', match: 98, cat: 'Agriculture', hue: '142' },
                    { scheme: 'Pradhan Mantri Fasal Bima', match: 94, cat: 'Insurance', hue: '210' },
                    { scheme: 'Kisan Credit Card', match: 89, cat: 'Finance', hue: '250' },
                    { scheme: 'PM Krishi Sinchai Yojana', match: 82, cat: 'Irrigation', hue: '175' },
                  ].map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.55 + i * 0.1 }}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors cursor-default"
                    >
                      {/* Match ring */}
                      <div className="relative size-9 shrink-0">
                        <svg viewBox="0 0 36 36" className="size-9 -rotate-90" fill="none">
                          <circle cx="18" cy="18" r="15" stroke="var(--color-surface-2)" strokeWidth="3" />
                          <circle
                            cx="18" cy="18" r="15"
                            stroke={`hsl(${s.hue}, 65%, 50%)`}
                            strokeWidth="3"
                            strokeDasharray={`${(s.match / 100) * 94} 94`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <span
                          className="absolute inset-0 flex items-center justify-center text-[9px] font-black"
                          style={{
                            color: `hsl(${s.hue}, 55%, 40%)`,
                            fontFamily: 'Inter, sans-serif',
                          }}
                        >
                          {s.match}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-ink truncate">{s.scheme}</p>
                        <p className="text-[11px] text-muted">{s.cat}</p>
                      </div>
                      <ChevronRight className="size-3.5 text-muted shrink-0" />
                    </motion.div>
                  ))}
                  <button
                    onClick={() => onNavigate('schemes')}
                    className="btn btn-primary w-full mt-1 text-xs h-10"
                  >
                    {t('landing.view_all_matched')}
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Bottom fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-surface to-transparent pointer-events-none" />
      </section>

      {/* ─── MARQUEE STATS STRIP ─────────────────────────── */}
      <section className="overflow-hidden border-y border-border bg-parchment py-4">
        <div className="flex whitespace-nowrap marquee-inner gap-0">
          {Array.from({ length: 2 }).map((_, pass) => (
            <div key={pass} className="flex items-center gap-8 pr-8">
              {[
                { value: '1,200+', label: t('landing.stat_schemes') },
                { value: '1.4B', label: t('landing.stat_citizens') },
                { value: '22+', label: t('landing.stat_languages') },
                { value: '< 30s', label: t('landing.stat_search_time') },
                { value: '36', label: 'States & UTs covered' },
                { value: '8', label: 'Beneficiary categories' },
                { value: '100%', label: 'Free to use' },
                { value: 'AI-powered', label: 'Scheme matching' },
              ].map((item, i) => (
                <span key={i} className="flex items-center gap-3 shrink-0">
                  <span
                    className="text-sm font-bold text-primary"
                    style={{ fontFamily: 'Lora, Georgia, serif' }}
                  >
                    {item.value}
                  </span>
                  <span className="text-xs text-muted" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {item.label}
                  </span>
                  <span className="text-border text-xl leading-none select-none border-r border-border-dark h-4" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Heading row */}
          <div className="text-center mb-16">
            <p className="overline mb-3">{t('landing.simple_process')}</p>
            <h2 className="section-title" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>
              {t('landing.how_it_works_title')}
            </h2>
            <p className="text-muted text-base max-w-md mx-auto mt-4 leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
              {t('landing.how_it_works_subtitle')}
            </p>
          </div>

          {/* Steps — clean numbered card layout */}
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                n: '01',
                title: t('landing.step_1_title'),
                desc: t('landing.step_1_desc'),
              },
              {
                n: '02',
                title: t('landing.step_2_title'),
                desc: t('landing.step_2_desc'),
              },
              {
                n: '03',
                title: t('landing.step_3_title'),
                desc: t('landing.step_3_desc'),
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative flex flex-col"
              >
                {/* Connector line between steps */}
                {i < 2 && (
                  <div className="hidden md:block absolute top-7 left-[calc(100%_+_16px)] w-[calc(100%_-_48px)] h-[2px] bg-gradient-to-r from-border to-transparent" />
                )}

                {/* Number badge */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="size-14 rounded-2xl bg-accent/10 border-2 border-accent/20 flex items-center justify-center shrink-0">
                    <span
                      className="text-xl font-bold text-accent"
                      style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                    >
                      {step.n}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-border md:hidden" />
                </div>

                {/* Content */}
                <div className="bg-surface rounded-2xl border border-border p-7 flex-1 hover:border-accent/30 hover:shadow-md transition-all duration-300">
                  <h3
                    className="text-lg font-semibold text-ink mb-3"
                    style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {step.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES — Asymmetric two-column ──────────────── */}
      <section className="bg-primary-900 py-24 overflow-hidden relative">
        {/* Warm radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-accent/8 blur-[100px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="mb-16">
            <p className="overline mb-3" style={{ color: '#E8A855' }}>
              {t('landing.features_badge')}
            </p>
            <h2
              className="text-white leading-[1.1]"
              style={{
                fontFamily: 'Lora, Georgia, serif',
                fontSize: 'clamp(2rem, 4.5vw, 3.2rem)',
              }}
            >
              {t('landing.features_title')}
            </h2>
          </div>

          {/* 2+4 asymmetric grid */}
          <div className="grid lg:grid-cols-[1.2fr_1fr_1fr] gap-4">
            {/* Large hero feature */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="lg:row-span-2 bg-primary-800 border border-white/10 rounded-2xl p-8 flex flex-col justify-between"
            >
              <div>
                <div className="size-12 rounded-xl bg-accent/15 flex items-center justify-center mb-6">
                  <Zap className="size-6 text-accent-300" />
                </div>
                <h3
                  className="text-xl font-bold text-white mb-3"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {t('landing.feature_1_title')}
                </h3>
                <p className="text-white/55 text-sm leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {t('landing.feature_1_desc')}
                </p>
              </div>
              <div className="mt-8">
                <button
                  onClick={() => onNavigate('schemes')}
                  className="flex items-center gap-2 text-accent-300 text-sm font-semibold hover:gap-3 transition-all"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {t('landing.cta_check_eligibility')} <ArrowUpRight className="size-4" />
                </button>
              </div>
            </motion.div>

            {/* Smaller features */}
            {[
              { icon: ShieldCheck, titleKey: 'landing.feature_2_title', descKey: 'landing.feature_2_desc', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
              { icon: Mic, titleKey: 'landing.feature_3_title', descKey: 'landing.feature_3_desc', color: 'text-sky-400', bg: 'bg-sky-400/10' },
              { icon: TrendingUp, titleKey: 'landing.feature_4_title', descKey: 'landing.feature_4_desc', color: 'text-violet-400', bg: 'bg-violet-400/10' },
              { icon: Globe2, titleKey: 'landing.feature_5_title', descKey: 'landing.feature_5_desc', color: 'text-teal-400', bg: 'bg-teal-400/10' },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.05 + i * 0.08 }}
                className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-6 hover:bg-white/[0.07] transition-colors"
              >
                <div className={`size-9 rounded-lg ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`size-5 ${f.color}`} />
                </div>
                <h3
                  className="text-white font-semibold text-sm mb-2"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {t(f.titleKey)}
                </h3>
                <p className="text-white/40 text-xs leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {t(f.descKey)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOR EVERY INDIAN ──────────────────────────────── */}
      <section className="py-24 bg-surface-2">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <p className="overline mb-3">{t('landing.inclusive_badge')}</p>
            <h2
              className="section-title"
              style={{ fontSize: 'clamp(1.8rem, 3.5vw, 2.6rem)' }}
            >
              {t('landing.for_every_indian_title')}
            </h2>
          </div>

          {/* Stacked horizontal cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: Tractor,
                labelKey: 'landing.category_farmers',
                descKey: 'landing.category_farmers_desc',
                accent: 'from-amber-400/10',
              },
              {
                icon: BookOpen,
                labelKey: 'landing.category_students',
                descKey: 'landing.category_students_desc',
                accent: 'from-sky-400/10',
              },
              {
                icon: Heart,
                labelKey: 'landing.category_women',
                descKey: 'landing.category_women_desc',
                accent: 'from-rose-400/10',
              },
              {
                icon: Users,
                labelKey: 'landing.category_seniors',
                descKey: 'landing.category_seniors_desc',
                accent: 'from-emerald-400/10',
              },
            ].map((w, i) => (
              <motion.button
                key={i}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09 }}
                onClick={() => onNavigate('schemes')}
                className={`card-elevated p-7 text-left group hover:border-accent/40 transition-all bg-gradient-to-br ${w.accent} to-transparent`}
              >
                <w.icon className="size-7 text-primary mb-5 group-hover:text-accent transition-colors" />
                <h3
                  className="font-bold text-ink text-base mb-2"
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {t(w.labelKey)}
                </h3>
                <p className="text-muted text-xs leading-relaxed mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {t(w.descKey)}
                </p>
                <span className="text-xs font-semibold text-accent flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                  Explore <ArrowRight className="size-3" />
                </span>
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA STRIP ─────────────────────────────────────── */}
      <section className="py-20 bg-primary relative overflow-hidden">
        {/* Warm accent mesh */}
        <div className="absolute -top-20 -right-20 w-[400px] h-[400px] rounded-full bg-accent/15 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-[300px] h-[300px] rounded-full bg-primary-400/10 blur-[80px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <p className="overline mb-4" style={{ color: '#E8A855' }}>
            Ready to start?
          </p>
          <h2
            className="text-white leading-tight mb-6"
            style={{
              fontFamily: 'Lora, Georgia, serif',
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            }}
          >
            {t('landing.cta_title')}
          </h2>
          <p
            className="text-white/55 text-base md:text-lg mb-10 leading-relaxed max-w-2xl mx-auto"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            {t('landing.cta_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNavigate('login')}
              className="btn h-13 px-10 bg-accent text-white shadow-lg shadow-accent/30 hover:bg-accent-800 text-sm"
            >
              {t('landing.cta_get_started')}
              <ArrowRight className="size-4" />
            </button>
            <button
              onClick={() => onNavigate('about')}
              className="btn btn-outline-white h-13 px-10 text-sm"
            >
              {t('landing.cta_learn_more')}
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ────────────────────────────────────────── */}
      <footer className="bg-ink text-white/40 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 pb-8 border-b border-white/8">

            {/* Brand */}
            <div>
              <p
                className="text-xl text-white/90 font-semibold mb-1"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Prahar AI
              </p>
              <p className="text-xs max-w-[200px] leading-relaxed" style={{ fontFamily: 'Inter, sans-serif' }}>
                {t('landing.footer_data_source')}
              </p>
            </div>

            {/* Nav columns */}
            <div className="flex gap-12">
              <div className="space-y-2">
                {(['about', 'schemes', 'assistant'] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => onNavigate(v)}
                    className="block text-xs hover:text-white transition-colors capitalize"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {v === 'assistant' ? 'AI Assistant' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                {(['contact', 'partner'] as View[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => onNavigate(v)}
                    className="block text-xs hover:text-white transition-colors capitalize"
                    style={{ fontFamily: 'Inter, sans-serif' }}
                  >
                    {v === 'partner' ? 'Partner Portal' : v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="mt-6 text-xs text-center" style={{ fontFamily: 'Inter, sans-serif' }}>
            {t('landing.footer_copyright', { year: new Date().getFullYear() })}
          </p>
        </div>
      </footer>
    </div>
  );
}

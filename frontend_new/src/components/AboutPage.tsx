import {
  ArrowRight,
  ShieldCheck,
  Languages,
  MessageSquareText,
  Search,
  FileText,
  Sparkles,
} from 'lucide-react';
import { View } from '../types';

interface AboutPageProps {
  onNavigate: (view: View) => void;
}

const PRINCIPLES = [
  {
    icon: Languages,
    title: 'Language Accessibility',
    description:
      'Information should be understandable. The assistant is designed to support plain-language guidance across multiple Indian languages.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy by Default',
    description:
      'Only profile details required for recommendations are used. Users can update or delete their profile from the profile page at any time.',
  },
  {
    icon: Search,
    title: 'Structured Discovery',
    description:
      'Schemes are organized with normalized details so citizens can quickly understand eligibility, benefits, and application steps.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: MessageSquareText,
    title: '1. Tell Us About Yourself',
    description: 'Share only the profile fields you are comfortable providing, such as age, income, and location.',
  },
  {
    icon: Sparkles,
    title: '2. Get Personalized Matches',
    description: 'The system maps your profile to relevant scheme categories and returns a focused list of options.',
  },
  {
    icon: FileText,
    title: '3. Review and Apply',
    description: 'Open scheme details to review requirements and process notes before applying on official portals.',
  },
];

export default function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'linear-gradient(155deg, var(--color-primary-900) 0%, var(--color-primary) 45%, var(--color-primary-600) 100%)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 10% 20%, rgba(255,255,255,0.08), transparent 34%), radial-gradient(circle at 90% 70%, rgba(200,112,13,0.18), transparent 28%)',
          }}
        />

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 relative z-10">
          <p
            className="inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase"
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.2)',
            }}
          >
            About Prahar AI
          </p>

          <h1
            className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight max-w-3xl"
            style={{ color: 'white', fontFamily: 'Lora, serif' }}
          >
            Helping citizens understand and access government schemes without guesswork.
          </h1>

          <p className="mt-5 text-base sm:text-lg max-w-2xl" style={{ color: 'rgba(255,255,255,0.8)' }}>
            Prahar AI is a citizen-support platform focused on practical scheme discovery. It combines profile-based recommendations,
            conversational guidance, and structured scheme detail pages in one place.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('schemes')} className="btn btn-primary">
              Explore Schemes <ArrowRight className="size-4" />
            </button>
            <button onClick={() => onNavigate('assistant')} className="btn btn-outline-white">
              Open Assistant
            </button>
          </div>
        </div>
      </section>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 space-y-10">
        <section className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {PRINCIPLES.map(({ icon: Icon, title, description }) => (
            <article key={title} className="card p-6">
              <div
                className="size-10 rounded-xl flex items-center justify-center mb-4"
                style={{ background: 'var(--color-primary-50)' }}
              >
                <Icon className="size-5" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}>
                {title}
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                {description}
              </p>
            </article>
          ))}
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-ink)', fontFamily: 'Lora, serif' }}>
            How It Works
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
            The workflow is simple and transparent.
          </p>

          <div className="grid md:grid-cols-3 gap-4">
            {HOW_IT_WORKS.map(({ icon: Icon, title, description }) => (
              <article key={title} className="rounded-xl p-5" style={{ background: 'var(--color-surface)' }}>
                <Icon className="size-5 mb-3" style={{ color: 'var(--color-accent)' }} />
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--color-ink)', fontFamily: 'Space Grotesk, sans-serif' }}>
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--color-muted)' }}>
                  {description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="rounded-2xl p-6 sm:p-8"
          style={{
            background: 'linear-gradient(140deg, var(--color-accent-50) 0%, var(--color-parchment) 100%)',
            border: '1px solid var(--color-border)',
          }}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--color-ink)', fontFamily: 'Lora, serif' }}>
            Built for practical outcomes
          </h2>
          <p className="text-sm sm:text-base max-w-3xl" style={{ color: 'var(--color-ink-2)' }}>
            The goal is not to overwhelm citizens with jargon. The goal is to make each step clear: who is eligible, what documents are needed,
            and where to apply.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={() => onNavigate('profile')} className="btn btn-navy">
              Manage Profile
            </button>
            <button onClick={() => onNavigate('login')} className="btn btn-ghost">
              Sign In
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

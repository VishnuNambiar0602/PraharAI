import { ShieldCheck, Eye, Languages, Users, Zap, Mic, Globe, Tractor, Building2, ArrowRight } from 'lucide-react';
import { View } from '../types';

interface AboutPageProps {
  onNavigate: (view: View) => void;
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-surface">

      {/* -- Hero -- */}
      <div className="bg-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-5 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '28px 28px' }} />
        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10">
          <span className="inline-block text-accent text-xs font-bold uppercase tracking-widest mb-4 bg-accent/10 border border-accent/30 px-3 py-1 rounded-full">Our Mission</span>
          <h1 className="font-display text-4xl lg:text-5xl font-bold text-white leading-tight max-w-2xl">
            Every Citizen Deserves Their Entitlements
          </h1>
          <p className="text-white/60 mt-4 text-lg max-w-xl leading-relaxed">
            Prahar AI bridges the gap between complex government protocols and the common man —
            making governance accessible to everyone, everywhere.
          </p>
          <button
            onClick={() => onNavigate('schemes')}
            className="mt-8 btn-primary inline-flex items-center gap-2"
          >
            Explore Schemes <ArrowRight className="size-4" />
          </button>
        </div>
      </div>

      {/* -- Stats Strip -- */}
      <div className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-6 grid grid-cols-3 gap-6 text-center">
          {[
            { icon: Globe, label: '22+ Languages', sub: 'All official Indian languages' },
            { icon: Users, label: '1.4B Indians', sub: 'Built for every citizen' },
            { icon: Zap, label: 'Real-time AI', sub: 'Instant scheme matching' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="size-10 rounded-lg bg-primary-50 flex items-center justify-center">
                <Icon className="size-5 text-primary" />
              </div>
              <p className="font-display font-bold text-ink text-lg">{label}</p>
              <p className="text-xs text-muted">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-10">

        {/* -- Vision -- */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-lg bg-primary-50 flex items-center justify-center">
              <Eye className="size-5 text-primary" />
            </div>
            <h2 className="font-display text-2xl font-bold text-ink">Our Vision</h2>
          </div>
          <p className="text-muted text-lg leading-relaxed">
            To create a <span className="text-primary font-semibold">secure and resilient digital ecosystem</span> for
            India — where every citizen can discover, apply for, and benefit from government schemes without
            barriers of language, literacy, or geography.
          </p>
        </div>

        {/* -- Inclusive by Design -- */}
        <div>
          <h2 className="font-display text-2xl font-bold text-ink mb-6">Inclusive by Design</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Mic, title: 'Voice-First', desc: 'Speak naturally in your mother tongue — no typing required.' },
              { icon: Languages, title: 'Multi-lingual', desc: 'Support for 22+ official Indian languages.' },
              { icon: ShieldCheck, title: 'Privacy-First', desc: 'Enterprise-grade encryption protects your data.' },
              { icon: Zap, title: 'AI-Powered', desc: 'Real-time matching across 500+ central and state schemes.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-6">
                <div className="size-10 rounded-lg bg-primary-50 flex items-center justify-center mb-4">
                  <Icon className="size-5 text-primary" />
                </div>
                <h4 className="font-semibold text-ink mb-2">{title}</h4>
                <p className="text-sm text-muted leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* -- Empowerment -- */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="card overflow-hidden flex items-stretch">
            <div className="bg-primary-50 w-32 shrink-0 flex items-center justify-center">
              <Tractor className="size-12 text-primary/30" />
            </div>
            <div className="p-6">
              <h4 className="font-display font-bold text-ink text-lg">Rural Empowerment</h4>
              <p className="text-sm text-muted mt-2 leading-relaxed">Helping farmers access subsidies, crop insurance, and weather alerts via voice in regional languages.</p>
            </div>
          </div>
          <div className="card overflow-hidden flex items-stretch">
            <div className="bg-accent-50 w-32 shrink-0 flex items-center justify-center">
              <Building2 className="size-12 text-accent/40" />
            </div>
            <div className="p-6">
              <h4 className="font-display font-bold text-ink text-lg">Urban Governance</h4>
              <p className="text-sm text-muted mt-2 leading-relaxed">Streamlining municipal services, business registrations, and urban welfare for modern city living.</p>
            </div>
          </div>
        </div>

        {/* -- Quote -- */}
        <div className="bg-primary rounded-2xl p-10 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
          <p className="font-display text-2xl text-white font-bold max-w-2xl mx-auto leading-relaxed relative z-10">
            "Governance should reach the citizen — not the other way around."
          </p>
          <p className="text-white/50 text-sm mt-4 relative z-10">— Prahar AI Team</p>
        </div>

        {/* -- CTA -- */}
        <div className="text-center pb-8">
          <h3 className="font-display text-2xl font-bold text-ink mb-3">Join the Movement</h3>
          <p className="text-muted mb-6">Millions of Indians are already discovering their rightful benefits.</p>
          <button
            onClick={() => onNavigate('login')}
            className="btn-primary inline-flex items-center gap-2"
          >
            Get Started Free <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

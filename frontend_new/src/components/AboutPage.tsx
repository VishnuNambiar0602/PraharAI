import { motion } from 'motion/react';
import { ShieldCheck, Eye, Languages, Users, Zap, Mic, Globe, Tractor, Building2, ArrowRight, Home, LayoutGrid, Info, User } from 'lucide-react';
import { View } from '../types';

interface AboutPageProps {
  onNavigate: (view: View) => void;
}

export default function AboutPage({ onNavigate }: AboutPageProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background-light">
      {/* Header */}
      <header className="bg-white p-4 border-b border-primary/10 flex items-center sticky top-0 z-50">
        <button 
          onClick={() => onNavigate('home')}
          className="text-primary size-10 flex items-center justify-center rounded-full hover:bg-primary/10"
        >
          <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="text-primary text-lg font-bold flex-1 text-center pr-10">About Prahar AI</h2>
      </header>

      <main className="flex-1 pb-24">
        {/* Hero */}
        <div className="p-4">
          <div className="bg-primary rounded-2xl overflow-hidden min-h-[240px] flex flex-col justify-end relative shadow-lg">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
            <div className="relative p-6 bg-gradient-to-t from-black/60 to-transparent">
              <span className="text-white/80 text-xs font-bold uppercase tracking-widest mb-2 block">Our Mission</span>
              <h1 className="text-white text-3xl font-bold leading-tight">Protecting every citizen with proactive digital safety</h1>
            </div>
          </div>
        </div>

        {/* Vision */}
        <div className="px-4 py-6">
          <div className="bg-white border border-primary/10 p-6 rounded-2xl shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <Eye className="size-6" />
              </div>
              <h3 className="text-primary text-xl font-bold">Our Vision</h3>
            </div>
            <p className="text-slate-600 text-lg leading-relaxed">
              To create a <span className="text-primary font-semibold">secure and resilient digital ecosystem</span> for India through cutting-edge AI-driven security and response.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar pb-2">
          {[
            { icon: Globe, label: '22+ Languages' },
            { icon: Users, label: '1.4B Indians' },
            { icon: Zap, label: 'Real-time AI' }
          ].map((stat, i) => (
            <div key={i} className="flex items-center gap-2 bg-primary/5 border border-primary/10 px-4 py-2 rounded-full whitespace-nowrap">
              <stat.icon className="size-4 text-primary" />
              <span className="text-primary font-bold text-sm">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* Inclusion Grid */}
        <div className="px-4 py-8">
          <h3 className="text-primary text-xl font-bold mb-6 px-1">Inclusive by Design</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-primary/5 shadow-sm">
              <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                <Mic className="size-8" />
              </div>
              <h4 className="font-bold text-primary mb-2">Voice-First</h4>
              <p className="text-sm text-slate-500 leading-snug">Speak naturally in your mother tongue.</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-primary/5 shadow-sm">
              <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4 text-primary">
                <Languages className="size-8" />
              </div>
              <h4 className="font-bold text-primary mb-2">Multi-lingual</h4>
              <p className="text-sm text-slate-500 leading-snug">Support for 22+ official Indian languages.</p>
            </div>
          </div>
        </div>

        {/* Empowerment */}
        <div className="px-4 py-4 space-y-4">
          <div className="bg-white rounded-2xl overflow-hidden border border-primary/10 flex items-center">
            <div className="w-1/3 bg-primary/5 h-32 flex items-center justify-center">
              <Tractor className="size-12 text-primary/40" />
            </div>
            <div className="w-2/3 p-4">
              <h4 className="font-bold text-primary">Rural Empowerment</h4>
              <p className="text-xs text-slate-500 mt-1">Helping farmers access subsidies and weather alerts via voice.</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl overflow-hidden border border-primary/10 flex flex-row-reverse items-center">
            <div className="w-1/3 bg-primary/5 h-32 flex items-center justify-center">
              <Building2 className="size-12 text-primary/40" />
            </div>
            <div className="w-2/3 p-4 text-right">
              <h4 className="font-bold text-primary">Urban Governance</h4>
              <p className="text-xs text-slate-500 mt-1">Streamlining municipal services for modern city living.</p>
            </div>
          </div>
        </div>

        {/* Quote */}
        <div className="p-8 text-center">
          <p className="text-slate-500 text-sm italic leading-relaxed">
            "Prahar AI bridges the gap between complex government protocols and the common man, making governance accessible to everyone, everywhere."
          </p>
        </div>

        {/* CTA */}
        <div className="p-6">
          <button className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
            Join the Movement
            <ArrowRight className="size-5" />
          </button>
        </div>
      </main>
    </div>
  );
}

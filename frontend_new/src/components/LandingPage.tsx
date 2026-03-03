import { motion } from 'motion/react';
import { useState, useEffect } from 'react';
import { 
  Home, 
  Search, 
  MessageSquare, 
  User, 
  Info, 
  Handshake, 
  PhoneCall,
  ArrowRight,
  CheckCircle2,
  Languages,
  Zap,
  ShieldCheck,
  Mic,
  LayoutGrid
} from 'lucide-react';
import { View } from '../types';

interface LandingPageProps {
  onNavigate: (view: View) => void;
}

export default function LandingPage({ onNavigate }: LandingPageProps) {
  const [schemeCount, setSchemeCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/schemes/stats')
      .then((r) => r.json())
      .then((d) => { if (d.totalSchemes) setSchemeCount(d.totalSchemes); })
      .catch(() => {/* silent */});
  }, []);
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-4 py-12 md:py-20 bg-white">
        <div className="absolute top-0 right-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-3xl -z-10 translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl -z-10 -translate-x-1/4 translate-y-1/4" />
        
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center gap-12">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1 text-left space-y-8"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="size-4" />
                Official Citizen Support
              </div>
              
              <h1 className="text-4xl md:text-6xl font-black leading-[1.1] tracking-tight text-slate-900">
                Right Scheme.<br />
                <span className="text-primary">Right Person.</span><br />
                Right Time.
              </h1>
              
              <p className="text-lg md:text-xl text-slate-500 max-w-xl">
                Unlock government benefits tailored for you. Our AI scans{' '}
                <span className="font-bold text-primary">
                  {schemeCount ? `${schemeCount.toLocaleString('en-IN')}+` : 'thousands of'}
                </span>{' '}
                schemes to find exactly what you qualify for in seconds.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <button 
                  onClick={() => onNavigate('schemes')}
                  className="h-14 px-8 bg-primary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2"
                >
                  Check My Eligibility
                  <ArrowRight className="size-5" />
                </button>
                <button 
                  onClick={() => onNavigate('assistant')}
                  className="h-14 px-8 border-2 border-primary/20 bg-white text-primary rounded-xl font-bold text-lg hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="size-5" />
                  Talk to AI
                </button>
              </div>
              
              <div className="flex items-center gap-4 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                      <img 
                        src={`https://picsum.photos/seed/person${i}/100/100`} 
                        alt="User" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm font-medium text-slate-500">Joined by 2M+ Indian Citizens</p>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex-1 w-full max-w-lg lg:max-w-none"
            >
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3] shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-transparent" />
                <img 
                  src="https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=800" 
                  alt="Happy Indian people" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-6 left-6 right-6 bg-white/90 backdrop-blur p-4 rounded-2xl flex items-center gap-4 shadow-xl">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Latest Success</p>
                    <p className="text-sm font-bold text-slate-900">Arjun just qualified for PM-Kisan Scheme</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-black text-primary mb-4">How It Works</h2>
            <p className="text-slate-500 max-w-2xl mx-auto">Discovering your benefits is simple, secure, and fast. Follow these three steps to get started.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            <div className="hidden md:block absolute top-1/3 left-[20%] right-[20%] h-0.5 bg-primary/10 -z-0" />
            
            {[
              { icon: Search, title: "Tell us about yourself", desc: "Share basic details securely like age, location, and occupation." },
              { icon: Zap, title: "AI matches you", desc: `Our engine scans ${schemeCount ? schemeCount.toLocaleString('en-IN') + '+' : '10,000+'} schemes to find your perfect matches.` },
              { icon: CheckCircle2, title: "Apply with ease", desc: "Get step-by-step guidance and document support for every application." }
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center group relative z-10">
                <div className="w-20 h-20 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <step.icon className="size-10" />
                </div>
                <div className="bg-white px-4">
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-slate-500">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 bg-background-light">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-black text-slate-900 mb-12 text-center">Key Features</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Languages, title: "12+ Languages", desc: "Access information in Hindi, Tamil, Bengali, and more local scripts." },
              { icon: Zap, title: "Instant Eligibility", desc: "No more waiting. Get your results in under 30 seconds." },
              { icon: ShieldCheck, title: "Privacy First", desc: "Your data is encrypted and never shared without permission." },
              { icon: MessageSquare, title: "24/7 AI Chat", desc: "Talk to our AI assistant anytime for help with your application." }
            ].map((feature, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-primary/5 hover:border-primary/20 transition-all">
                <feature.icon className="size-8 text-primary mb-4" />
                <h4 className="font-bold text-lg mb-2">{feature.title}</h4>
                <p className="text-sm text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-white py-12 mt-auto">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-10">
            <div className="col-span-1 md:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <Home className="size-8" />
                <span className="text-2xl font-bold">Prahar AI</span>
              </div>
              <p className="text-white/70 max-w-sm">
                Empowering Indian citizens with technology to access government benefits seamlessly. Bridging the gap between policy and people.
              </p>
            </div>
            <div>
              <h5 className="font-bold mb-4">Quick Links</h5>
              <ul className="space-y-2 text-white/70">
                <li><button onClick={() => onNavigate('home')} className="hover:text-white transition-colors">How it works</button></li>
                <li><button onClick={() => onNavigate('schemes')} className="hover:text-white transition-colors">Eligibility Tool</button></li>
                <li><button onClick={() => onNavigate('partner')} className="hover:text-white transition-colors">Partner Portal</button></li>
                <li><button onClick={() => onNavigate('contact')} className="hover:text-white transition-colors">Support</button></li>
              </ul>
            </div>
            <div>
              <h5 className="font-bold mb-4">Connect</h5>
              <ul className="space-y-2 text-white/70">
                <li><a href="#" className="hover:text-white transition-colors">Facebook</a></li>
                <li><a href="#" className="hover:text-white transition-colors">WhatsApp</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="hover:text-white transition-colors">LinkedIn</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/50">
            <p>© 2024 Prahar AI. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white">Privacy Policy</a>
              <a href="#" className="hover:text-white">Terms of Service</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Home,
  LayoutGrid,
  MessageSquare,
  User,
  PhoneCall,
  LogIn,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Bot,
} from 'lucide-react';
import { View, Scheme } from './types';
import { AuthProvider, useAuth } from './AuthContext';

// Components
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import SchemeExplorer from './components/SchemeExplorer';
import SchemeDetail from './components/SchemeDetail';
import ChatAssistant from './components/ChatAssistant';
import UserProfile from './components/UserProfile';
import AboutPage from './components/AboutPage';
import PartnerPortal from './components/PartnerPortal';
import ContactPage from './components/ContactPage';
import LoginPage from './components/LoginPage';
import OnboardingWizard from './components/OnboardingWizard';
import LanguageSelector from './components/LanguageSelector';

/* ─────────────────────────────────────────────
   Ashoka Chakra SVG decorative
───────────────────────────────────────────── */
function AshokaChakra({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="3" />
      <circle cx="50" cy="50" r="8" stroke="currentColor" strokeWidth="3" />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const x1 = 50 + 10 * Math.cos(rad);
        const y1 = 50 + 10 * Math.sin(rad);
        const x2 = 50 + 44 * Math.cos(rad);
        const y2 = 50 + 44 * Math.sin(rad);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" />
        );
      })}
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Global Navigation Bar
───────────────────────────────────────────── */
interface NavBarProps {
  current: View;
  onNavigate: (v: View) => void;
}

function NavBar({ current, onNavigate }: NavBarProps) {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links: { id: View; labelKey: string }[] = [
    { id: 'home', labelKey: 'nav.home' },
    { id: 'schemes', labelKey: 'nav.schemes' },
    { id: 'assistant', labelKey: 'nav.assistant' },
    { id: 'about', labelKey: 'nav.about' },
    { id: 'contact', labelKey: 'nav.contact' },
  ];

  const go = (v: View) => {
    onNavigate(v);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Tricolor strip */}
      <div className="tricolor-bar w-full" />

      <header className="sticky top-0 z-50 glass border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <button onClick={() => go('home')} className="flex items-center gap-2.5 shrink-0">
            <div className="size-9 bg-primary rounded-lg flex items-center justify-center">
              <AshokaChakra className="size-6 text-white/90" />
            </div>
            <div className="leading-none">
              <span className="font-display font-bold text-lg text-primary tracking-tight block">
                Prahar AI
              </span>
              <span className="text-[10px] font-medium text-muted tracking-widest uppercase block -mt-0.5">
                {t('nav.citizen_welfare')}
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map((l) => (
              <button
                key={l.id}
                onClick={() => go(l.id)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  current === l.id
                    ? 'bg-primary text-white'
                    : 'text-ink hover:bg-primary-50 hover:text-primary'
                }`}
              >
                {t(l.labelKey)}
              </button>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <LanguageSelector />
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => go('profile')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    current === 'profile' ? 'bg-primary text-white' : 'hover:bg-primary-50 text-ink'
                  }`}
                >
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">
                      {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{user?.name?.split(' ')[0] || 'Profile'}</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <LogOut className="size-4" />
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <button onClick={() => go('login')} className="btn-primary text-sm py-2! px-5!">
                <LogIn className="size-4" />
                {t('nav.login')}
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden size-9 flex items-center justify-center rounded-lg hover:bg-primary-50 text-ink"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-border bg-white overflow-hidden"
            >
              <div className="px-4 py-3 space-y-1">
                {links.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => go(l.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      current === l.id ? 'bg-primary text-white' : 'text-ink hover:bg-primary-50'
                    }`}
                  >
                    {t(l.labelKey)}
                  </button>
                ))}
                <div className="pt-2 border-t border-border mt-2 flex items-center gap-2">
                  <LanguageSelector />
                  {isAuthenticated ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => go('profile')}
                        className="flex-1 btn-navy text-xs py-2!"
                      >
                        <User className="size-4" /> {t('nav.profile')}
                      </button>
                      <button
                        onClick={logout}
                        className="flex items-center gap-1 text-sm text-red-600 px-3 py-2 rounded-lg hover:bg-red-50"
                      >
                        <LogOut className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => go('login')} className="w-full btn-primary py-2.5!">
                      <LogIn className="size-4" /> {t('nav.login')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

/* ─────────────────────────────────────────────
   Mobile Bottom Nav
───────────────────────────────────────────── */
function MobileBottomNav({
  current,
  onNavigate,
}: {
  current: View;
  onNavigate: (v: View) => void;
}) {
  const items = [
    { id: 'home' as View, label: 'Home', icon: Home },
    { id: 'schemes' as View, label: 'Schemes', icon: LayoutGrid },
    { id: 'assistant' as View, label: 'Chat', icon: MessageSquare },
    { id: 'contact' as View, label: 'Support', icon: PhoneCall },
    { id: 'profile' as View, label: 'Profile', icon: User },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-border safe-area-pb">
      <div className="flex">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onNavigate(id)}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              current === id ? 'text-accent' : 'text-muted hover:text-primary'
            }`}
          >
            <Icon className="size-5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   Main App
───────────────────────────────────────────── */
function AppContent() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [intendedView, setIntendedView] = useState<View | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<Scheme | null>(null);
  const { isAuthenticated, user } = useAuth();

  const PROTECTED: View[] = ['schemes', 'assistant', 'profile', 'partner'];

  const navigate = (view: View) => {
    if (PROTECTED.includes(view) && !isAuthenticated) {
      setIntendedView(view);
      setCurrentView('login');
      return;
    }
    setIntendedView(null);
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSchemeSelect = (scheme: Scheme) => {
    setSelectedScheme(scheme);
    setCurrentView('schemeDetail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToSchemes = () => {
    setSelectedScheme(null);
    setCurrentView('schemes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePostLogin = () => {
    const dest = intendedView || 'home';
    setIntendedView(null);
    setCurrentView(dest);
    if (!user?.onboardingComplete) setShowOnboarding(true);
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return isAuthenticated && user ? (
          <Dashboard user={user} onNavigate={navigate} />
        ) : (
          <LandingPage onNavigate={navigate} />
        );
      case 'schemes':
        return <SchemeExplorer onSchemeSelect={handleSchemeSelect} />;
      case 'schemeDetail':
        return selectedScheme ? (
          <SchemeDetail scheme={selectedScheme} onBack={handleBackToSchemes} />
        ) : (
          <SchemeExplorer onSchemeSelect={handleSchemeSelect} />
        );
      case 'assistant':
        return <ChatAssistant />;
      case 'profile':
        return <UserProfile onNavigate={navigate} />;
      case 'about':
        return <AboutPage onNavigate={navigate} />;
      case 'partner':
        return <PartnerPortal />;
      case 'contact':
        return <ContactPage onNavigate={navigate} />;
      case 'login':
        return <LoginPage onNavigate={navigate} onLoginSuccess={handlePostLogin} />;
      default:
        return isAuthenticated && user ? (
          <Dashboard user={user} onNavigate={navigate} />
        ) : (
          <LandingPage onNavigate={navigate} />
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Global Nav */}
      <NavBar current={currentView} onNavigate={navigate} />

      {/* Onboarding Wizard Overlay */}
      <AnimatePresence>
        {showOnboarding && isAuthenticated && (
          <OnboardingWizard
            onComplete={() => setShowOnboarding(false)}
            onSkip={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>

      {/* Page content */}
      <main className="flex-1 pb-16 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="min-h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Nav */}
      <MobileBottomNav current={currentView} onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

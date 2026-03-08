import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
  useParams,
} from 'react-router-dom';
import {
  Home,
  LayoutGrid,
  MessageSquare,
  User,
  LogIn,
  LogOut,
  Menu,
  X,
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
import LoginPage from './components/LoginPage';
import OnboardingWizard from './components/OnboardingWizard';
import LanguageSelector from './components/LanguageSelector';
import { fetchSchemeById } from './api';

/* ─────────────────────────────────────────────
   Prahar Logo Mark
───────────────────────────────────────────── */
function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Stylised 'P' letterform with chakra dots */}
      <rect width="36" height="36" rx="8" fill="currentColor" />
      <path d="M10 26V10h9a5.5 5.5 0 0 1 0 11H10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="26" r="2" fill="#C8700D" />
      <circle cx="26" cy="20" r="1.2" fill="rgba(255,255,255,0.5)" />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   Global Navigation Bar
───────────────────────────────────────────── */
function NavBar() {
  const { t } = useTranslation();
  const { isAuthenticated, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const routerNavigate = useNavigate();
  const location = useLocation();

  const links: { path: string; id: View; labelKey: string }[] = [
    { path: '/',          id: 'home',      labelKey: 'nav.home' },
    { path: '/schemes',   id: 'schemes',   labelKey: 'nav.schemes' },
    { path: '/assistant', id: 'assistant', labelKey: 'nav.assistant' },
    { path: '/about',     id: 'about',     labelKey: 'nav.about' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const go = (path: string) => {
    routerNavigate(path);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[3.75rem] flex items-center justify-between gap-4">
          {/* Logo */}
          <button onClick={() => go('/')} className="flex items-center gap-2.5 shrink-0">
            <LogoMark className="size-9 text-primary" />
            <div className="leading-none">
              <span className="block text-[1.1rem] font-bold text-primary tracking-[-0.02em]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
                Prahar AI
              </span>
              <span className="text-[9px] font-semibold text-muted tracking-[0.15em] uppercase block" style={{ fontFamily: 'Inter, sans-serif' }}>
                {t('nav.citizen_welfare')}
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {links.map((l) => (
              <button
                key={l.path}
                onClick={() => go(l.path)}
                className={`relative px-3.5 py-2 text-[0.82rem] font-semibold transition-colors ${
                  isActive(l.path) ? 'text-accent' : 'text-ink/70 hover:text-ink'
                }`}
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {t(l.labelKey)}
                {isActive(l.path) && (
                  <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] rounded-full bg-accent" />
                )}
              </button>
            ))}
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <LanguageSelector />
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => go('/profile')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[0.8rem] font-semibold transition-colors ${
                    location.pathname === '/profile'
                      ? 'bg-primary text-white'
                      : 'bg-surface-2 text-ink hover:bg-border'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  <div className="size-6 rounded-full bg-accent/15 flex items-center justify-center">
                    <span className="text-[0.65rem] font-bold text-accent">
                      {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span>{user?.name?.split(' ')[0] || 'Profile'}</span>
                </button>
                <button
                  onClick={logout}
                  className="flex items-center gap-1 text-[0.78rem] text-muted hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50/70 transition-colors"
                >
                  <LogOut className="size-3.5" />
                  {t('nav.logout')}
                </button>
              </div>
            ) : (
              <button onClick={() => go('/login')} className="btn btn-primary">
                <LogIn className="size-3.5" />
                {t('nav.login')}
              </button>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden size-9 flex items-center justify-center rounded-lg hover:bg-surface-2 text-ink transition-colors"
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
              className="md:hidden border-t border-border bg-parchment overflow-hidden"
            >
              <div className="px-4 py-4 space-y-1">
                {links.map((l) => (
                  <button
                    key={l.path}
                    onClick={() => go(l.path)}
                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      isActive(l.path) ? 'bg-primary text-white' : 'text-ink/70 hover:bg-surface-2 hover:text-ink'
                    }`}
                  >
                    {t(l.labelKey)}
                  </button>
                ))}
                <div className="pt-3 border-t border-border mt-2 flex items-center gap-2">
                  <LanguageSelector />
                  {isAuthenticated ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => go('/profile')}
                        className="flex-1 btn btn-navy text-xs"
                      >
                        <User className="size-3.5" /> {t('nav.profile')}
                      </button>
                      <button
                        onClick={logout}
                        className="flex items-center gap-1 text-sm text-red-600 px-3 py-2 rounded-lg hover:bg-red-50"
                      >
                        <LogOut className="size-4" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => go('/login')} className="w-full btn btn-primary">
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
   Protected Route Wrapper
───────────────────────────────────────────── */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="shimmer h-8 w-36 rounded-md" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

/* ─────────────────────────────────────────────
   Mobile Bottom Nav
───────────────────────────────────────────── */
function MobileBottomNav() {
  const routerNavigate = useNavigate();
  const location = useLocation();

  const items = [
    { path: '/',          label: 'Home',    icon: Home },
    { path: '/schemes',   label: 'Schemes', icon: LayoutGrid },
    { path: '/assistant', label: 'Chat',    icon: MessageSquare },
    { path: '/profile',   label: 'Profile', icon: User },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-parchment border-t border-border safe-area-pb shadow-[0_-1px_8px_rgba(26,18,8,0.06)]">
      <div className="flex">
        {items.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => { routerNavigate(path); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${
              isActive(path) ? 'text-accent' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon className={`size-5 ${isActive(path) ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            <span className="text-[9px] font-bold tracking-wide" style={{ fontFamily: 'Inter, sans-serif' }}>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────
   Scheme Detail Wrapper (reads router state)
───────────────────────────────────────────── */
function SchemeDetailPage() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const { id } = useParams();
  const [scheme, setScheme] = useState<Scheme | null>((location.state?.scheme as Scheme) || null);
  const [loading, setLoading] = useState(!location.state?.scheme);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) {
      setError('Scheme not found');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    fetchSchemeById(id)
      .then((data) => {
        if (!cancelled) setScheme(data);
      })
      .catch(() => {
        if (!cancelled && !location.state?.scheme) {
          setError('Failed to load scheme details');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, location.state]);

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="shimmer h-8 w-44 rounded-md" />
      </div>
    );
  }

  if (error && !scheme) {
    return <Navigate to="/schemes" replace />;
  }

  if (!scheme) {
    return <Navigate to="/schemes" replace />;
  }

  return (
    <SchemeDetail
      scheme={scheme}
      onBack={() => { routerNavigate('/schemes'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
    />
  );
}

/* ─────────────────────────────────────────────
   Main App
───────────────────────────────────────────── */
function AppContent() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const routerNavigate = useNavigate();
  const location = useLocation();

  // Universal navigate helper — child components still call onNavigate(view)
  const viewToPath: Record<View, string> = {
    home:        '/',
    schemes:     '/schemes',
    schemeDetail: '/schemes',
    assistant:   '/assistant',
    profile:     '/profile',
    about:       '/about',
    partner:     '/partner',
    login:       '/login',
  };

  const navigate = (view: View) => {
    routerNavigate(viewToPath[view]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSchemeSelect = (scheme: Scheme) => {
    routerNavigate(`/schemes/${scheme.id}`, { state: { scheme } });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePostLogin = () => {
    const from = (location.state as { from?: string })?.from || '/';
    routerNavigate(from, { replace: true });
    if (!user?.onboardingComplete) setShowOnboarding(true);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <NavBar />

      {/* Onboarding Wizard Overlay */}
      <AnimatePresence>
        {showOnboarding && isAuthenticated && (
          <OnboardingWizard
            onComplete={() => setShowOnboarding(false)}
            onSkip={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>

      {/* Route-based page content */}
      <main className="flex-1 pb-16 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="min-h-full"
          >
            <Routes>
              {/* Public routes */}
              <Route
                path="/"
                element={
                  isAuthenticated && user ? (
                    <Dashboard user={user} onNavigate={navigate} />
                  ) : (
                    <LandingPage onNavigate={navigate} />
                  )
                }
              />
              <Route path="/about" element={<AboutPage onNavigate={navigate} />} />
              <Route path="/login" element={<LoginPage onNavigate={navigate} onLoginSuccess={handlePostLogin} />} />

              {/* Protected routes */}
              <Route path="/schemes" element={<ProtectedRoute><SchemeExplorer onSchemeSelect={handleSchemeSelect} /></ProtectedRoute>} />
              <Route path="/schemes/:id" element={<ProtectedRoute><SchemeDetailPage /></ProtectedRoute>} />
              <Route path="/assistant" element={<ProtectedRoute><ChatAssistant /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><UserProfile onNavigate={navigate} /></ProtectedRoute>} />
              <Route path="/partner" element={<ProtectedRoute><PartnerPortal /></ProtectedRoute>} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileBottomNav />
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


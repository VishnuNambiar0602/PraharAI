import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Search, MessageSquare, User, Info, Handshake, PhoneCall, LayoutGrid } from 'lucide-react';
import { View } from './types';
import { AuthProvider, useAuth } from './AuthContext';

// Components
import LandingPage from './components/LandingPage';
import SchemeExplorer from './components/SchemeExplorer';
import ChatAssistant from './components/ChatAssistant';
import UserProfile from './components/UserProfile';
import AboutPage from './components/AboutPage';
import PartnerPortal from './components/PartnerPortal';
import ContactPage from './components/ContactPage';
import LoginPage from './components/LoginPage';
import OnboardingWizard from './components/OnboardingWizard';

function AppContent() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [intendedView, setIntendedView] = useState<View | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // Protected views — require login
  const PROTECTED: View[] = ['assistant', 'profile', 'schemes', 'partner'];

  // Redirect to login for protected views
  const navigate = (view: View) => {
    if (PROTECTED.includes(view) && !isAuthenticated) {
      setIntendedView(view);  // remember where user wanted to go
      setCurrentView('login');
      return;
    }
    setIntendedView(null);
    setCurrentView(view);
  };

  // After login, redirect to intended view — show onboarding if profile not completed
  const handlePostLogin = () => {
    const dest = intendedView || 'home';
    setIntendedView(null);
    setCurrentView(dest);
    // Show onboarding wizard for new users who haven't completed it
    if (!user?.onboardingComplete) {
      setShowOnboarding(true);
    }
  };

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <LandingPage onNavigate={navigate} />;
      case 'schemes':
        return <SchemeExplorer />;
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
        return <LandingPage onNavigate={navigate} />;
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'schemes', label: 'Schemes', icon: LayoutGrid },
    { id: 'assistant', label: 'AI Chat', icon: MessageSquare },
    { id: 'contact', label: 'Support', icon: PhoneCall },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-background-light flex flex-col">
      {/* Onboarding Wizard Overlay */}
      <AnimatePresence>
        {showOnboarding && isAuthenticated && (
          <OnboardingWizard
            onComplete={() => setShowOnboarding(false)}
            onSkip={() => setShowOnboarding(false)}
          />
        )}
      </AnimatePresence>

      <main className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-full"
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-primary/10 px-4 pb-6 pt-3 z-50 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <div className="max-w-2xl mx-auto flex justify-between items-center">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id as View)}
              className={`flex flex-col items-center gap-1 transition-all ${
                currentView === item.id ? 'text-primary scale-110' : 'text-slate-400 hover:text-primary/60'
              }`}
            >
              <item.icon className={`size-6 ${currentView === item.id ? 'fill-primary/10' : ''}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                currentView === item.id ? 'opacity-100' : 'opacity-60'
              }`}>
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
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

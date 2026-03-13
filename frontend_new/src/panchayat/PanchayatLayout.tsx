import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart2,
  Activity,
  Settings,
  LogOut,
  Leaf,
} from 'lucide-react';
import {
  clearSession,
  isAuthenticated,
  getPanchayatUser,
  getCurrentPanchayatUser,
  PanchayatSessionError,
  PanchayatUser,
} from './api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import BeneficiariesPage from './pages/BeneficiariesPage';
import SchemesPage from './pages/SchemesPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ActivityPage from './pages/ActivityPage';
import SettingsPage from './pages/SettingsPage';

const navigation = [
  { path: '', label: 'Overview', icon: LayoutDashboard },
  { path: 'beneficiaries', label: 'Citizens', icon: Users },
  { path: 'schemes', label: 'Schemes', icon: FileText },
  { path: 'analytics', label: 'Analytics', icon: BarChart2 },
  { path: 'activity', label: 'Activity', icon: Activity },
  { path: 'settings', label: 'Settings', icon: Settings },
];

export default function PanchayatLayout() {
  const [authenticated, setAuthenticated] = useState(isAuthenticated());
  const [checkingSession, setCheckingSession] = useState(isAuthenticated());
  const [panchayatUser, setPanchayatUser] = useState<PanchayatUser | null>(getPanchayatUser());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated()) {
      setAuthenticated(false);
      setPanchayatUser(null);
      setCheckingSession(false);
      return;
    }

    let active = true;
    setCheckingSession(true);

    getCurrentPanchayatUser()
      .then((user) => {
        if (!active) return;
        setPanchayatUser(user);
        setAuthenticated(true);
      })
      .catch((error) => {
        if (!active) return;
        if (!(error instanceof PanchayatSessionError)) {
          console.error('Failed to validate panchayat session:', error);
        }
        clearSession();
        setPanchayatUser(null);
        setAuthenticated(false);
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    clearSession();
    setAuthenticated(false);
    setPanchayatUser(null);
  };

  const handleLogin = (user: PanchayatUser) => {
    setPanchayatUser(user);
    setAuthenticated(true);
    setCheckingSession(false);
  };

  if (checkingSession) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--color-surface)' }}
      >
        <div
          className="size-10 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-accent)' }}
        />
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          Restoring panchayat session…
        </p>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const subPath = location.pathname.replace(/^\/panchayat\/?/, '').split('/')[0] || '';
  const isActive = (navPath: string) => subPath === navPath;
  const goTo = (navPath: string) => navigate(`/panchayat/${navPath}`);

  return (
    <div className="panchayat-portal">
      {/* ── Top bar — logo + user only (tabs moved to dock) ────── */}
      <header className="p-topnav">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => goTo('')} className="flex items-center gap-2.5">
            <div
              className="size-8 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: 'rgba(217,122,16,0.18)',
                border: '1px solid rgba(217,122,16,0.3)',
              }}
            >
              <Leaf className="size-4" style={{ color: 'var(--color-accent)' }} />
            </div>
            <div className="leading-none">
              <p
                className="text-white font-bold text-sm tracking-tight"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Gram Sabha
              </p>
              <p
                className="text-[9px] font-semibold tracking-widest uppercase"
                style={{ color: 'rgba(217,122,16,0.6)' }}
              >
                PANCHAYAT PORTAL
              </p>
            </div>
          </button>

          {/* Right: user info + logout */}
          <div className="flex items-center gap-3">
            <div className="text-right leading-none">
              <p className="text-xs font-semibold text-white truncate max-w-40">
                {panchayatUser?.name || 'Panchayat'}
              </p>
              <p
                className="text-[10px] truncate max-w-40 mt-0.5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                {panchayatUser?.panchayatName || 'Portal'}
              </p>
            </div>
            <div
              className="size-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{
                background: 'linear-gradient(135deg, var(--color-accent-700), var(--color-accent))',
              }}
            >
              {panchayatUser?.name?.[0]?.toUpperCase() ?? 'P'}
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg transition-all"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f85149';
                e.currentTarget.style.background = 'rgba(248,81,73,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.4)';
                e.currentTarget.style.background = 'transparent';
              }}
              title="Sign out"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ──────────────────────────────────────── */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 pt-6 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={subPath}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Routes>
              <Route index element={<DashboardPage />} />
              <Route path="beneficiaries" element={<BeneficiariesPage />} />
              <Route path="schemes" element={<SchemesPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="activity" element={<ActivityPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/panchayat" replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── Bottom dock ───────────────────────────────────────── */}
      <nav className="p-dock">
        <div className="p-dock-inner">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => goTo(item.path)}
                className={`p-dock-item${active ? ' active' : ''}`}
                title={item.label}
              >
                <Icon className="size-5" />
                <span className="p-dock-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
} from 'lucide-react';
import LogoMark from './LogoMark';
import { useAuth } from '../AuthContext';
import DashboardPage from './admin/DashboardPage';
import UsersPage from './admin/UsersPage';
import SchemesPage from './admin/SchemesPage';
import AnalyticsPage from './admin/AnalyticsPage';
import ActivityPage from './admin/ActivityPage';
import SettingsPage from './admin/SettingsPage';
import PanchayatUsersPage from './admin/PanchayatUsersPage';

type AdminView =
  | 'dashboard'
  | 'users'
  | 'schemes'
  | 'analytics'
  | 'activity'
  | 'settings'
  | 'panchayats';

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { logout, user } = useAuth();

  const menuItems: { id: AdminView; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'panchayats', label: 'Panchayat Users', icon: Building2 },
    { id: 'schemes', label: 'Schemes', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardPage />;
      case 'users':
        return <UsersPage />;
      case 'panchayats':
        return <PanchayatUsersPage />;
      case 'schemes':
        return <SchemesPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'activity':
        return <ActivityPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface)] flex">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <LogoMark className="size-8 text-primary" />
              <div>
                <h1 className="font-bold text-lg text-gray-900">Prahar AI</h1>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Admin Portal</p>
              </div>
            </div>
          ) : (
            <LogoMark className="size-8 text-primary mx-auto" />
          )}
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'text-[var(--color-ink)] hover:bg-[var(--color-surface-2)]'
                }`}
                title={!sidebarOpen ? item.label : undefined}
              >
                <Icon className="size-5 shrink-0" />
                {sidebarOpen && <span className="text-sm font-medium">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <div className="size-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
                <span className="text-sm font-bold text-[var(--color-primary)]">A</span>
              </div>
            </div>
          ) : (
            <div className="size-10 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center mx-auto mb-3">
              <span className="text-sm font-bold text-[var(--color-primary)]">A</span>
            </div>
          )}
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="size-4" />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="size-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </button>

          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">Admin Dashboard</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{renderView()}</main>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Save, RefreshCw, Database, Key, Bell, Shield } from 'lucide-react';
import { useDialog } from '../DialogProvider';

export default function SettingsPage() {
  const { toast } = useDialog();
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    syncInterval: '24',
    cacheExpiry: '300',
    maxUsers: '10000',
    enableNotifications: true,
    enableAnalytics: true,
    maintenanceMode: false,
  });

  const handleSave = async () => {
    setSaving(true);
    // Simulate save
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
    toast({ message: 'Settings saved successfully', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure system settings and preferences</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary">
          <Save className="size-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Sync Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <RefreshCw className="size-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Sync Settings</h2>
            <p className="text-sm text-gray-600">Configure scheme synchronization</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sync Interval (hours)
            </label>
            <input
              type="number"
              value={settings.syncInterval}
              onChange={(e) => setSettings({ ...settings, syncInterval: e.target.value })}
              className="input-base max-w-xs"
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              How often to sync schemes from India.gov.in
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Cache Expiry (seconds)
            </label>
            <input
              type="number"
              value={settings.cacheExpiry}
              onChange={(e) => setSettings({ ...settings, cacheExpiry: e.target.value })}
              className="input-base max-w-xs"
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              How long to cache scheme data in Redis
            </p>
          </div>
        </div>
      </div>

      {/* Database Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center">
            <Database className="size-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Database Settings</h2>
            <p className="text-sm text-gray-600">Configure database connections</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Users</label>
            <input
              type="number"
              value={settings.maxUsers}
              onChange={(e) => setSettings({ ...settings, maxUsers: e.target.value })}
              className="input-base max-w-xs"
            />
            <p className="text-xs text-[var(--color-muted)] mt-1">
              Maximum number of users allowed in the system
            </p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="maintenanceMode"
              checked={settings.maintenanceMode}
              onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
              className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-accent)]/30"
            />
            <label htmlFor="maintenanceMode" className="text-sm font-medium text-gray-700">
              Enable Maintenance Mode
            </label>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-[var(--color-accent)]/10 flex items-center justify-center">
            <Shield className="size-5 text-[var(--color-accent)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Security Settings</h2>
            <p className="text-sm text-gray-600">Configure security and access control</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Admin Key</label>
            <div className="flex items-center gap-3">
              <input
                type="password"
                value="••••••••••••••••"
                readOnly
                className="input-base max-w-xs"
              />
              <button className="btn btn-secondary gap-2">
                <Key className="size-4" />
                Regenerate
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Admin key for API authentication</p>
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="size-10 rounded-lg bg-[var(--color-primary)]/10 flex items-center justify-center">
            <Bell className="size-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Notification Settings</h2>
            <p className="text-sm text-gray-600">Configure system notifications</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enableNotifications"
              checked={settings.enableNotifications}
              onChange={(e) => setSettings({ ...settings, enableNotifications: e.target.checked })}
              className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-accent)]/30"
            />
            <label htmlFor="enableNotifications" className="text-sm font-medium text-gray-700">
              Enable Email Notifications
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enableAnalytics"
              checked={settings.enableAnalytics}
              onChange={(e) => setSettings({ ...settings, enableAnalytics: e.target.checked })}
              className="size-4 rounded border-[var(--color-border)] text-[var(--color-primary)] focus:ring-[var(--color-accent)]/30"
            />
            <label htmlFor="enableAnalytics" className="text-sm font-medium text-gray-700">
              Enable Analytics Tracking
            </label>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Information</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Version</p>
            <p className="font-medium text-gray-900">1.0.0</p>
          </div>
          <div>
            <p className="text-gray-600">Environment</p>
            <p className="font-medium text-gray-900">Production</p>
          </div>
          <div>
            <p className="text-gray-600">Node Version</p>
            <p className="font-medium text-gray-900">18.0.0</p>
          </div>
          <div>
            <p className="text-gray-600">Database</p>
            <p className="font-medium text-gray-900">Neo4j 5.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { clearAdminKey } from '../api';
import { LogOut, ShieldAlert, Leaf } from 'lucide-react';

export default function SettingsPage() {
  const [cleared, setCleared] = useState(false);

  const handleClearKey = () => {
    if (!confirm('This will log you out of the Panchayat portal. Continue?')) return;
    clearAdminKey();
    setCleared(true);
    setTimeout(() => window.location.reload(), 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Portal configuration and session management</p>
      </div>

      {/* About */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <Leaf className="size-5 text-amber-500" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Gram Sabha — Panchayat Portal</p>
            <p className="text-xs text-gray-500">AI4Bharat Welfare Scheme Management System</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Backend', value: 'localhost:3000' },
            { label: 'ML Pipeline', value: 'localhost:8000' },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
              <p className="text-sm font-mono text-gray-700">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="size-4 text-amber-500" />
          <h2 className="font-semibold text-gray-900">Security</h2>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          Your access key is stored locally in this browser session. Clearing it will require you to sign in again.
        </p>
        <button
          onClick={handleClearKey}
          disabled={cleared}
          className="btn btn-danger gap-2"
        >
          <LogOut className="size-4" />
          {cleared ? 'Logging out…' : 'Clear access key & logout'}
        </button>
      </div>

      {/* Info */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">About This Portal</h2>
        <div className="space-y-2 text-sm text-gray-600">
          <p>This portal provides Panchayat-level administrators access to the AI4Bharat welfare scheme matching system.</p>
          <p>Using ML-powered eligibility analysis, it matches registered beneficiaries to relevant Central and State government welfare schemes.</p>
          <p className="text-xs text-gray-400 mt-3">Ministry of Panchayati Raj · Government of India</p>
        </div>
      </div>
    </div>
  );
}

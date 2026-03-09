import { useState } from 'react';
import { clearSession } from '../api';
import { LogOut, ShieldAlert, Leaf } from 'lucide-react';

export default function SettingsPage() {
  const [cleared, setCleared] = useState(false);

  const handleClearKey = () => {
    if (!confirm('This will log you out of the Panchayat portal. Continue?')) return;
    clearSession();
    setCleared(true);
    setTimeout(() => {
      window.location.href = '/panchayat';
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-xl font-bold tracking-tight"
          style={{ color: 'var(--color-ink)', fontFamily: 'Lora, Georgia, serif' }}
        >
          Settings
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
          Portal configuration and session management
        </p>
      </div>

      {/* About */}
      <div className="p-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(217,122,16,0.12)',
              border: '1px solid rgba(217,122,16,0.2)',
            }}
          >
            <Leaf className="size-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div>
            <p className="font-semibold" style={{ color: 'var(--color-ink)' }}>
              Gram Sabha — Panchayat Portal
            </p>
            <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
              AI4Bharat Welfare Scheme Management System
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {[
            { label: 'Version', value: '1.0.0' },
            { label: 'Backend', value: 'localhost:3000' },
            { label: 'ML Pipeline', value: 'localhost:8000' },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-0.5">
              <p
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-muted-2)' }}
              >
                {label}
              </p>
              <p className="text-sm font-mono" style={{ color: 'var(--color-ink-2)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="p-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldAlert className="size-4" style={{ color: 'var(--color-accent)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-ink)' }}>
            Security
          </h2>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--color-muted)' }}>
          Your access key is stored locally in this browser session. Clearing it will require you to
          sign in again.
        </p>
        <button onClick={handleClearKey} disabled={cleared} className="p-btn p-btn-danger gap-2">
          <LogOut className="size-4" />
          {cleared ? 'Logging out…' : 'Clear access key & logout'}
        </button>
      </div>

      {/* Info */}
      <div className="p-card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--color-ink)' }}>
          About This Portal
        </h2>
        <div className="space-y-2 text-sm" style={{ color: 'var(--color-muted)' }}>
          <p>
            This portal provides Panchayat-level administrators access to the AI4Bharat welfare
            scheme matching system.
          </p>
          <p>
            Using ML-powered eligibility analysis, it matches registered beneficiaries to relevant
            Central and State government welfare schemes.
          </p>
          <p className="text-xs mt-3" style={{ color: 'var(--color-muted-2)' }}>
            Ministry of Panchayati Raj · Government of India
          </p>
        </div>
      </div>
    </div>
  );
}

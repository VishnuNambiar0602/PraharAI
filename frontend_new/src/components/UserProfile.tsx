import { User, MapPin, ShieldCheck, Edit3, CheckCircle2, Calendar, FileText, Upload, Download, Eye, LayoutGrid, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { View } from '../types';

interface UserProfileProps {
  onNavigate: (view: View) => void;
}

export default function UserProfile({ onNavigate }: UserProfileProps) {
  const { user, logout } = useAuth();

  const displayName = user?.name || user?.email?.split('@')[0] || 'User';
  const displayAge = user?.age ?? '—';
  const displayState = user?.state || '—';
  const displayIncome = user?.income ? `?${(user.income / 100000).toFixed(1)}L` : '—';

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* -- Profile Banner -- */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-700) 60%, var(--color-primary-600) 100%)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: 'absolute',
            top: '-60px',
            right: '-60px',
            width: '280px',
            height: '280px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '-30px',
            right: '-30px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.06)',
            pointerEvents: 'none',
          }}
        />

        <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-end gap-6 relative z-10">
          {/* Avatar */}
          <div className="relative">
            <div
              className="size-20 rounded-2xl flex items-center justify-center"
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
              }}
            >
              <span
                className="font-display text-3xl font-bold text-white"
                style={{ letterSpacing: '-0.02em' }}
              >
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div
              className="absolute -bottom-1 -right-1 size-5 rounded-full border-2 border-white"
              style={{ background: '#22c55e' }}
            />
          </div>

          {/* Name + meta */}
          <div className="flex-1">
            <h1
              className="font-display text-2xl font-bold text-white mb-1"
              style={{ letterSpacing: '-0.02em' }}
            >
              {displayName}
            </h1>
            <div className="flex flex-wrap gap-3 mt-1">
              {displayAge !== '—' && (
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <User className="size-3" /> Age {displayAge}
                </span>
              )}
              {displayState !== '—' && (
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <MapPin className="size-3" /> {displayState}
                </span>
              )}
              {displayIncome !== '—' && (
                <span
                  className="text-xs flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.55)' }}
                >
                  <FileText className="size-3" /> {displayIncome} / yr
                </span>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              className="flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-xl font-semibold transition-all"
              style={{
                border: '1.5px solid rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.8)',
                background: 'rgba(255,255,255,0.08)',
              }}
            >
              <Edit3 className="size-3.5" /> Edit Profile
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-xl font-semibold transition-all"
              style={{
                border: '1.5px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.5)',
                background: 'transparent',
              }}
            >
              <LogOut className="size-3.5" /> Sign Out
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 pb-16">

        {/* -- Stats Row -- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Eligible Schemes', value: '05', icon: LayoutGrid, accent: 'var(--color-primary)' },
            { label: 'Applied', value: '02', icon: CheckCircle2, accent: 'var(--color-success)' },
            { label: 'Upcoming', value: '01', icon: Calendar, accent: 'var(--color-accent)' },
            { label: 'Profile Complete', value: `${user?.completeness ?? 70}%`, icon: ShieldCheck, accent: '#16a34a' },
          ].map(({ label, value, icon: Icon, accent }) => (
            <div
              key={label}
              className="card p-5"
              style={{ position: 'relative', overflow: 'hidden' }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: accent,
                }}
              />
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: 'var(--color-muted)' }}
                >
                  {label}
                </span>
                <Icon className="size-4 shrink-0" style={{ color: accent }} />
              </div>
              <p
                className="font-display text-3xl font-bold"
                style={{ color: accent, letterSpacing: '-0.02em' }}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* -- Aadhaar Verification -- */}
        <div className="card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="size-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--color-success-50)' }}
            >
              <ShieldCheck className="size-5" style={{ color: 'var(--color-success)' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
                Aadhaar Verified
              </p>
              <p className="text-xs" style={{ color: 'var(--color-muted)' }}>
                1234 XXXX 9012
              </p>
            </div>
          </div>
          <span
            className="text-xs font-bold px-3 py-1 rounded-full"
            style={{
              background: 'var(--color-success-50)',
              color: 'var(--color-success)',
              border: '1px solid var(--color-success-100)',
            }}
          >
            Verified
          </span>
        </div>

        {/* -- Deadline Alert -- */}
        <div
          className="card p-5 flex items-center gap-4"
          style={{ borderLeft: '4px solid var(--color-accent)' }}
        >
          <div
            className="size-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--color-accent-50)' }}
          >
            <Calendar className="size-5" style={{ color: 'var(--color-accent)' }} />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
              Upcoming Deadline
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              UP Scholarship Portal
            </p>
          </div>
          <span
            className="text-xs font-bold px-3 py-1.5 rounded-full"
            style={{
              background: 'var(--color-accent-50)',
              color: 'var(--color-accent-700)',
              border: '1px solid var(--color-accent-100)',
            }}
          >
            Closes in 3 days
          </span>
        </div>

        {/* -- Active Applications -- */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3
              className="font-display text-lg font-bold"
              style={{ color: 'var(--color-ink)' }}
            >
              Active Applications
            </h3>
            <button
              className="text-xs font-semibold"
              style={{ color: 'var(--color-primary)' }}
            >
              View All
            </button>
          </div>

          <div className="flex justify-between items-start mb-5">
            <div>
              <h4 className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
                PM Awas Yojana (Rural)
              </h4>
              <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                Application ID: #PM-882910
              </p>
            </div>
            <span
              className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
              style={{
                background: '#EFF6FF',
                color: '#1D4ED8',
                border: '1px solid #BFDBFE',
              }}
            >
              Processing
            </span>
          </div>

          {/* Progress tracker */}
          <div className="relative px-2 mb-5">
            <div
              className="absolute top-2 left-4 right-4 h-0.5"
              style={{ background: 'var(--color-border)' }}
            />
            <div
              className="absolute top-2 left-4 h-0.5 w-1/3"
              style={{ background: 'var(--color-primary)' }}
            />
            <div className="flex justify-between relative z-10">
              {[
                { label: 'Submitted', done: true },
                { label: 'Verified', done: true },
                { label: 'Approved', done: false },
                { label: 'Fund Transfer', done: false },
              ].map((step, i) => (
                <div key={i} className="flex flex-col items-center gap-2">
                  <div
                    className="size-4 rounded-full border-2"
                    style={{
                      background: step.done ? 'var(--color-primary)' : 'var(--color-parchment)',
                      borderColor: step.done ? 'var(--color-primary)' : 'var(--color-border)',
                    }}
                  />
                  <span
                    className="text-[8px] font-bold uppercase tracking-wider"
                    style={{ color: step.done ? 'var(--color-primary)' : 'var(--color-muted-2)' }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className="flex items-center justify-between p-3.5 rounded-xl text-xs font-semibold w-full border transition-colors"
            style={{
              background: 'var(--color-primary-50)',
              color: 'var(--color-primary)',
              border: '1px solid var(--color-primary-100)',
            }}
          >
            <span>Next Step: Verification by Block Officer</span>
            <ChevronRight className="size-4" />
          </button>
        </div>

        {/* -- Required Documents -- */}
        <div className="card p-6">
          <h3
            className="font-display text-lg font-bold mb-5"
            style={{ color: 'var(--color-ink)' }}
          >
            Required Documents
          </h3>
          <div className="space-y-3">
            <div
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-surface-2)' }}
              >
                <FileText className="size-5" style={{ color: 'var(--color-muted)' }} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Income Certificate
                </h4>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                  Required for 3 schemes
                </p>
              </div>
              <button className="btn btn-navy py-2! px-4! text-xs! flex items-center gap-1.5">
                <Upload className="size-3.5" /> Upload
              </button>
            </div>
            <div
              className="flex items-center gap-4 p-4 rounded-xl border"
              style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
            >
              <div
                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--color-success-50)' }}
              >
                <ShieldCheck className="size-5" style={{ color: 'var(--color-success)' }} />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  Aadhaar Card
                </h4>
                <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--color-success)' }}>
                  Verified
                </p>
              </div>
              <button
                className="p-2 rounded-xl transition-colors"
                style={{ color: 'var(--color-muted)' }}
              >
                <Eye className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* -- Download Forms -- */}
        <div className="card p-6">
          <h3 className="font-display text-lg font-bold mb-5" style={{ color: 'var(--color-ink)' }}>
            Download Forms
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: 'Farmer Subsidy Application', size: '1.2 MB' },
              { title: 'Birth Registration Form', size: '840 KB' },
            ].map((form, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl border"
                style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
              >
                <div
                  className="size-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: '#FEF2F2' }}
                >
                  <FileText className="size-5 text-red-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
                    {form.title}
                  </h4>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
                    PDF · {form.size}
                  </p>
                </div>
                <button
                  className="p-2 rounded-xl transition-colors shrink-0"
                  style={{ color: 'var(--color-muted)' }}
                >
                  <Download className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

      </main>
    </div>
  );
}

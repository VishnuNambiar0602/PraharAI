import { useState, useEffect } from 'react';
import { Search, Trash2, Eye, Users, X } from 'lucide-react';
import { getAllBeneficiaries, deleteBeneficiary } from '../api';
import type { Beneficiary } from '../types';

const AVATAR_PALETTE = [
  { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
  { bg: 'rgba(16,185,129,0.15)', text: '#34d399' },
  { bg: 'rgba(139,92,246,0.15)', text: '#a78bfa' },
  { bg: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  { bg: 'rgba(236,72,153,0.15)', text: '#f472b6' },
  { bg: 'rgba(6,182,212,0.15)', text: '#22d3ee' },
];

function getAvatarStyle(name: string) {
  let h = 0;
  for (const c of (name || 'U')) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

function getInitials(name: string) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

export default function BeneficiariesPage() {
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<Beneficiary | null>(null);

  useEffect(() => { loadBeneficiaries(); }, []);

  const loadBeneficiaries = async () => {
    try {
      const data = await getAllBeneficiaries();
      setBeneficiaries(data);
    } catch (err) {
      console.error('Failed to load beneficiaries:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Remove this beneficiary from the system?')) return;
    try {
      await deleteBeneficiary(userId);
      setBeneficiaries((prev) => prev.filter((u) => u.userId !== userId));
      if (selectedUser?.userId === userId) setSelectedUser(null);
    } catch {
      alert('Failed to remove beneficiary');
    }
  };

  const filtered = beneficiaries.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.userId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onboarded = beneficiaries.filter((u) => u.onboardingComplete).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div className="size-10 rounded-full border-2 border-gray-200 border-t-green-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading beneficiaries…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Beneficiaries</h1>
        <p className="text-sm text-gray-500 mt-0.5">Citizens registered for scheme eligibility</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card blue">
          <p className="stat-label">Total</p>
          <p className="stat-value">{beneficiaries.length}</p>
        </div>
        <div className="stat-card green">
          <p className="stat-label">Onboarded</p>
          <p className="stat-value">{onboarded}</p>
        </div>
        <div className="stat-card amber">
          <p className="stat-label">Pending</p>
          <p className="stat-value">{beneficiaries.length - onboarded}</p>
        </div>
        <div className="stat-card purple">
          <p className="stat-label">Completion</p>
          <p className="stat-value">{beneficiaries.length ? Math.round((onboarded / beneficiaries.length) * 100) : 0}%</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, state, or ID…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9 text-sm"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Beneficiary</th>
                <th>State / District</th>
                <th>Employment</th>
                <th>Joined</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const av = getAvatarStyle(u.name || '');
                return (
                  <tr key={u.userId}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="user-avatar text-xs font-bold" style={{ background: av.bg, color: av.text }}>
                          {getInitials(u.name || '')}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{u.name || '—'}</p>
                          <p className="text-[11px] font-mono text-gray-400 tabular-nums">{u.userId.slice(0, 8)}…</p>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm text-gray-600">{u.state || '—'}</td>
                    <td className="text-sm">{u.employment || '—'}</td>
                    <td className="text-sm text-gray-500 tabular-nums">
                      {new Date(u.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {u.onboardingComplete
                        ? <span className="badge badge-success">Enrolled</span>
                        : <span className="badge badge-warning">Pending</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedUser(u)} className="p-1.5 rounded-md hover:bg-blue-50 transition-colors" title="View">
                          <Eye className="size-3.5 text-blue-500" />
                        </button>
                        <button onClick={() => handleDelete(u.userId)} className="p-1.5 rounded-md hover:bg-red-50 transition-colors" title="Remove">
                          <Trash2 className="size-3.5 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Users className="size-7 text-gray-400" />
            </div>
            <p className="font-semibold text-gray-700">{searchTerm ? 'No matching beneficiaries' : 'No beneficiaries registered yet'}</p>
            <p className="text-sm text-gray-400 mt-1 max-w-xs">
              {searchTerm ? `No results for "${searchTerm}"` : 'Beneficiaries appear here once they register through the citizen app.'}
            </p>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100">
            <p className="text-xs text-gray-400">Showing {filtered.length} beneficiar{filtered.length === 1 ? 'y' : 'ies'}{searchTerm && ` matching "${searchTerm}"`}</p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedUser(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                {(() => {
                  const s = getAvatarStyle(selectedUser.name || '');
                  return <div className="user-avatar text-sm font-bold" style={{ background: s.bg, color: s.text }}>{getInitials(selectedUser.name || '')}</div>;
                })()}
                <div>
                  <p className="font-semibold text-gray-900">{selectedUser.name || '—'}</p>
                  <p className="text-xs text-gray-400 font-mono">{selectedUser.userId}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUser(null)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="size-4 text-gray-500" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-2 gap-4">
              {[
                { label: 'Email', value: selectedUser.email },
                { label: 'Age', value: selectedUser.age ? `${selectedUser.age} years` : '—' },
                { label: 'State', value: selectedUser.state || '—' },
                { label: 'Employment', value: selectedUser.employment || '—' },
                { label: 'Education', value: selectedUser.education || '—' },
                { label: 'Gender', value: selectedUser.gender || '—' },
                { label: 'Annual Income', value: selectedUser.income ? `₹${selectedUser.income.toLocaleString('en-IN')}` : '—' },
                { label: 'Registered', value: new Date(selectedUser.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-800">{value}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between px-5 py-4 bg-gray-50 border-t border-gray-100">
              {selectedUser.onboardingComplete
                ? <span className="badge badge-success">Enrolled</span>
                : <span className="badge badge-warning">Onboarding Pending</span>}
              <div className="flex gap-2">
                <button onClick={() => setSelectedUser(null)} className="btn btn-secondary text-sm">Close</button>
                <button onClick={() => handleDelete(selectedUser.userId)} className="btn btn-danger text-sm">
                  <Trash2 className="size-3.5" />
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Building2, MapPin, Mail, User, Lock, RefreshCw } from 'lucide-react';
import {
  PanchayatUserRecord,
  fetchPanchayatUsers,
  createPanchayatUser,
  deletePanchayatUser,
  getLGDStates,
  getLGDDistricts,
  getLGDPanchayats,
} from '../../api';
import { useDialog } from '../DialogProvider';
import SearchableSelect from '../SearchableSelect';

const defaultForm = {
  name: '',
  email: '',
  password: '',
  panchayatName: '',
  district: '',
  state: '',
};

export default function PanchayatUsersPage() {
  const { confirm } = useDialog();
  const [users, setUsers] = useState<PanchayatUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(defaultForm);
  const [formBusy, setFormBusy] = useState(false);
  const [formMessage, setFormMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  // LGD cascading dropdowns
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [panchayatOptions, setPanchayatOptions] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingPanchayats, setLoadingPanchayats] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchPanchayatUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load panchayat users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    getLGDStates().then((states) => setStateOptions(states.map((s) => s.name)));
  }, []);

  // Reload districts whenever the selected state changes
  useEffect(() => {
    if (!form.state) {
      setDistrictOptions([]);
      setPanchayatOptions([]);
      return;
    }
    setLoadingDistricts(true);
    getLGDDistricts(form.state)
      .then(setDistrictOptions)
      .finally(() => setLoadingDistricts(false));
  }, [form.state]);

  // Reload panchayats whenever state or district changes
  useEffect(() => {
    if (!form.state || !form.district) {
      setPanchayatOptions([]);
      return;
    }
    setLoadingPanchayats(true);
    getLGDPanchayats(form.state, form.district)
      .then(setPanchayatOptions)
      .finally(() => setLoadingPanchayats(false));
  }, [form.state, form.district]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.email ||
      !form.password ||
      !form.name ||
      !form.panchayatName ||
      !form.district ||
      !form.state
    ) {
      setFormMessage('All fields are required.');
      return;
    }
    setFormBusy(true);
    setFormMessage('');
    try {
      await createPanchayatUser(form);
      setForm(defaultForm);
      setShowForm(false);
      setFormMessage('Panchayat user created successfully.');
      await loadUsers();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Failed to create user.');
    } finally {
      setFormBusy(false);
    }
  };

  const handleDelete = async (user: PanchayatUserRecord) => {
    const ok = await confirm({
      title: 'Delete Panchayat Account',
      message: `Delete panchayat account for ${user.name} (${user.email})? This action cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    try {
      await deletePanchayatUser(user.userId);
      setFormMessage('Panchayat user deleted successfully.');
      await loadUsers();
    } catch (err) {
      setFormMessage(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  };

  const inputClass =
    'w-full px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] transition';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panchayat Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage accounts for Gram Panchayat officials who can access the Panchayat Portal.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => {
              setShowForm((v) => !v);
              setFormMessage('');
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <UserPlus className="size-4" />
            Add Panchayat User
          </button>
        </div>
      </div>

      {/* Feedback message */}
      {formMessage && (
        <div
          className={`p-3 rounded-lg text-sm ${
            formMessage.toLowerCase().includes('fail') ||
            formMessage.toLowerCase().includes('error') ||
            formMessage.toLowerCase().includes('required')
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}
        >
          {formMessage}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Create New Panchayat User</h2>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rajesh Kumar"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={`${inputClass} pl-9`}
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="email"
                  placeholder="official@panchayat.gov.in"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`${inputClass} pl-9`}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
                <input
                  type="password"
                  placeholder="Min 8 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={`${inputClass} pl-9`}
                  minLength={8}
                  required
                />
              </div>
            </div>

            {/* State */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                State / UT
              </label>
              <SearchableSelect
                options={stateOptions}
                value={form.state}
                onChange={(v) => setForm({ ...form, state: v, district: '', panchayatName: '' })}
                placeholder="Select state…"
                inputClassName={inputClass}
              />
            </div>

            {/* District */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                District
              </label>
              <SearchableSelect
                options={districtOptions}
                value={form.district}
                onChange={(v) => setForm({ ...form, district: v, panchayatName: '' })}
                placeholder={
                  !form.state
                    ? 'Select state first…'
                    : loadingDistricts
                      ? 'Loading…'
                      : 'Select district…'
                }
                disabled={!form.state || loadingDistricts}
                inputClassName={inputClass}
              />
            </div>

            {/* Panchayat Name */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                Village / Panchayat
              </label>
              <SearchableSelect
                options={panchayatOptions}
                value={form.panchayatName}
                onChange={(v) => setForm({ ...form, panchayatName: v })}
                placeholder={
                  !form.state
                    ? 'Select state first…'
                    : !form.district
                      ? 'Select district first…'
                      : loadingPanchayats
                        ? 'Loading…'
                        : 'Select panchayat…'
                }
                disabled={!form.state || !form.district || loadingPanchayats}
                inputClassName={inputClass}
              />
            </div>

            {/* Actions */}
            <div className="sm:col-span-2 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setFormMessage('');
                }}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formBusy}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {formBusy ? (
                  <>
                    <div className="size-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <UserPlus className="size-4" />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Registered Panchayat Accounts</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {users.length} account{users.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-sm text-gray-400 text-center">
            Loading panchayat accounts…
          </div>
        ) : error ? (
          <div className="px-6 py-10 text-sm text-red-600 text-center">{error}</div>
        ) : users.length === 0 ? (
          <div className="px-6 py-10 text-center">
            <Building2 className="size-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No panchayat accounts yet.</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "Add Panchayat User" to create the first account.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Name / Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Panchayat
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    District
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    State
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Created
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr
                    key={user.userId}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{user.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{user.panchayatName}</td>
                    <td className="px-4 py-3 text-gray-700">{user.district}</td>
                    <td className="px-4 py-3 text-gray-700">{user.state}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

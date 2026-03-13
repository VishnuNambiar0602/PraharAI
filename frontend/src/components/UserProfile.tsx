import { useMemo, useState } from 'react';
import {
  User,
  Mail,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  IndianRupee,
  ShieldAlert,
  PencilLine,
  Trash2,
  Save,
  X,
  LogOut,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useDialog } from './DialogProvider';
import { deleteProfile, updateProfile } from '../api';
import { View } from '../types';

interface UserProfileProps {
  onNavigate: (view: View) => void;
}

type EditableProfile = {
  name: string;
  dateOfBirth: string;
  age: string;
  income: string;
  state: string;
  district: string;
  employment: string;
  education: string;
  gender: string;
  maritalStatus: string;
  familySize: string;
  residenceType: string;
  occupation: string;
  povertyStatus: string;
  rationCard: string;
  landOwnership: string;
  socialCategory: string;
  disability: boolean;
  disabilityType: string;
  minority: boolean;
  minorityCommunity: string;
  interests: string;
};

type ExtendedUser = {
  dateOfBirth?: string;
  district?: string;
  maritalStatus?: string;
  familySize?: number;
  residenceType?: string;
  occupation?: string;
  povertyStatus?: string;
  rationCard?: string;
  landOwnership?: string;
  socialCategory?: string;
  disability?: boolean;
  disabilityType?: string;
  minority?: boolean;
  minorityCommunity?: string;
  interests?: string;
};

function toCurrency(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return 'Not provided';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function normalizeField(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'Not provided';
}

function toDateInputValue(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : '';
}

function formatDate(value: unknown): string {
  const dateValue = toDateInputValue(value);
  if (!dateValue) return 'Not provided';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return 'Not provided';
  return parsed.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function toEditable(user: Record<string, unknown>): EditableProfile {
  return {
    name: typeof user.name === 'string' ? user.name : '',
    dateOfBirth: toDateInputValue(user.dateOfBirth),
    age: typeof user.age === 'number' ? String(user.age) : '',
    income: typeof user.income === 'number' ? String(user.income) : '',
    state: typeof user.state === 'string' ? user.state : '',
    district: typeof user.district === 'string' ? user.district : '',
    employment: typeof user.employment === 'string' ? user.employment : '',
    education: typeof user.education === 'string' ? user.education : '',
    gender: typeof user.gender === 'string' ? user.gender : '',
    maritalStatus: typeof user.maritalStatus === 'string' ? user.maritalStatus : '',
    familySize: typeof user.familySize === 'number' ? String(user.familySize) : '',
    residenceType: typeof user.residenceType === 'string' ? user.residenceType : '',
    occupation: typeof user.occupation === 'string' ? user.occupation : '',
    povertyStatus: typeof user.povertyStatus === 'string' ? user.povertyStatus : '',
    rationCard: typeof user.rationCard === 'string' ? user.rationCard : '',
    landOwnership: typeof user.landOwnership === 'string' ? user.landOwnership : '',
    socialCategory: typeof user.socialCategory === 'string' ? user.socialCategory : '',
    disability: Boolean(user.disability),
    disabilityType: typeof user.disabilityType === 'string' ? user.disabilityType : '',
    minority: Boolean(user.minority),
    minorityCommunity: typeof user.minorityCommunity === 'string' ? user.minorityCommunity : '',
    interests: typeof user.interests === 'string' ? user.interests : '',
  };
}

export default function UserProfile({ onNavigate }: UserProfileProps) {
  const { user, refreshProfile, logout } = useAuth();
  const { confirm } = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [form, setForm] = useState<EditableProfile>(() =>
    toEditable((user || {}) as Record<string, unknown>)
  );

  const profileCompleteness = typeof user?.completeness === 'number' ? user.completeness : 0;
  const extra = (user as (typeof user & ExtendedUser) | null) || null;

  const profileCards = useMemo(
    () => [
      {
        label: 'Full Name',
        value: normalizeField(user?.name),
        icon: User,
      },
      {
        label: 'Email',
        value: normalizeField(user?.email),
        icon: Mail,
      },
      {
        label: 'Date of Birth',
        value: formatDate(extra?.dateOfBirth),
        icon: Calendar,
      },
      {
        label: 'Age',
        value: typeof user?.age === 'number' && user.age > 0 ? String(user.age) : 'Not provided',
        icon: User,
      },
      {
        label: 'Annual Income',
        value: toCurrency(user?.income),
        icon: IndianRupee,
      },
      {
        label: 'State',
        value: normalizeField(user?.state),
        icon: MapPin,
      },
      {
        label: 'District',
        value: normalizeField(extra?.district),
        icon: MapPin,
      },
      {
        label: 'Employment',
        value: normalizeField(user?.employment),
        icon: Briefcase,
      },
      {
        label: 'Education',
        value: normalizeField(user?.education),
        icon: GraduationCap,
      },
      {
        label: 'Marital Status',
        value: normalizeField(extra?.maritalStatus),
        icon: User,
      },
      {
        label: 'Family Size',
        value:
          typeof extra?.familySize === 'number' && extra.familySize > 0
            ? String(extra.familySize)
            : 'Not provided',
        icon: User,
      },
      {
        label: 'Residence Type',
        value: normalizeField(extra?.residenceType),
        icon: MapPin,
      },
      {
        label: 'Occupation',
        value: normalizeField(extra?.occupation),
        icon: Briefcase,
      },
      {
        label: 'Social Category',
        value: normalizeField(extra?.socialCategory),
        icon: User,
      },
      {
        label: 'Poverty Status',
        value: normalizeField(extra?.povertyStatus),
        icon: IndianRupee,
      },
      {
        label: 'Ration Card',
        value: normalizeField(extra?.rationCard),
        icon: IndianRupee,
      },
      {
        label: 'Land Ownership',
        value: normalizeField(extra?.landOwnership),
        icon: MapPin,
      },
      {
        label: 'Disability',
        value: extra?.disability ? 'Yes' : 'No',
        icon: User,
      },
      {
        label: 'Disability Type',
        value: normalizeField(extra?.disabilityType),
        icon: User,
      },
      {
        label: 'Minority',
        value: extra?.minority ? 'Yes' : 'No',
        icon: User,
      },
      {
        label: 'Minority Community',
        value: normalizeField(extra?.minorityCommunity),
        icon: User,
      },
      {
        label: 'Interests',
        value: normalizeField(extra?.interests),
        icon: GraduationCap,
      },
    ],
    [extra, user]
  );

  const beginEdit = () => {
    if (!user) return;
    setForm(toEditable(user as unknown as Record<string, unknown>));
    setError('');
    setMessage('');
    setIsEditing(true);
  };

  const cancelEdit = () => {
    if (!user) return;
    setForm(toEditable(user as unknown as Record<string, unknown>));
    setIsEditing(false);
    setError('');
  };

  const onFieldChange = (
    key: keyof EditableProfile,
    value: EditableProfile[keyof EditableProfile]
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async () => {
    if (!user?.userId) return;

    const trimmedName = form.name.trim();
    const parsedAge = form.age.trim() ? Number(form.age) : null;
    const parsedIncome = form.income.trim() ? Number(form.income) : null;
    const parsedFamilySize = form.familySize.trim() ? Number(form.familySize) : null;

    if (!trimmedName) {
      setError('Name is required.');
      return;
    }

    if (parsedAge !== null && (!Number.isFinite(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      setError('Age must be a valid number between 1 and 120.');
      return;
    }

    if (parsedIncome !== null && (!Number.isFinite(parsedIncome) || parsedIncome < 0)) {
      setError('Income must be 0 or greater.');
      return;
    }

    if (
      parsedFamilySize !== null &&
      (!Number.isFinite(parsedFamilySize) || parsedFamilySize < 1 || parsedFamilySize > 30)
    ) {
      setError('Family size must be a valid number between 1 and 30.');
      return;
    }

    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      await updateProfile(user.userId, {
        name: trimmedName,
        dateOfBirth: form.dateOfBirth || null,
        age: parsedAge,
        income: parsedIncome,
        state: form.state.trim() || null,
        district: form.district.trim() || null,
        employment: form.employment.trim() || null,
        education: form.education.trim() || null,
        gender: form.gender.trim() || null,
        maritalStatus: form.maritalStatus.trim() || null,
        familySize: parsedFamilySize,
        residenceType: form.residenceType.trim() || null,
        occupation: form.occupation.trim() || null,
        povertyStatus: form.povertyStatus.trim() || null,
        rationCard: form.rationCard.trim() || null,
        landOwnership: form.landOwnership.trim() || null,
        socialCategory: form.socialCategory.trim() || null,
        disability: form.disability,
        disabilityType: form.disability ? form.disabilityType.trim() || null : null,
        minority: form.minority,
        minorityCommunity: form.minority ? form.minorityCommunity.trim() || null : null,
        interests: form.interests.trim() || null,
      });

      await refreshProfile();
      setIsEditing(false);
      setMessage('Profile updated successfully.');
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : 'Failed to update profile. Please try again.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const removeProfile = async () => {
    if (!user?.userId) return;

    const confirmed = await confirm({
      title: 'Delete Profile',
      message: 'Delete your profile permanently? This action cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
    });

    if (!confirmed) return;

    setIsDeleting(true);
    setError('');
    setMessage('');

    try {
      await deleteProfile(user.userId);
      logout();
      onNavigate('home');
    } catch {
      setError('Failed to delete profile. Please try again.');
      setIsDeleting(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="card p-6 max-w-md w-full text-center">
          <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
            Please sign in to view your profile.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <section
        style={{
          background:
            'linear-gradient(140deg, var(--color-primary) 0%, var(--color-primary-700) 60%, var(--color-primary-600) 100%)',
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-9 sm:py-11">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="flex items-center gap-4">
              <div
                className="size-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.13)',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                <span
                  className="text-white text-2xl font-bold"
                  style={{ fontFamily: 'Space Grotesk, sans-serif' }}
                >
                  {(user.name || user.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h1 className="text-white text-2xl font-bold" style={{ fontFamily: 'Lora, serif' }}>
                  {normalizeField(user.name)}
                </h1>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.72)' }}>
                  {user.email}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={beginEdit}
                disabled={isSaving || isDeleting || isEditing}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.22)',
                }}
              >
                <PencilLine className="size-3.5" /> Edit Profile
              </button>

              <button
                onClick={removeProfile}
                disabled={isSaving || isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                style={{
                  background: 'rgba(220,38,38,0.18)',
                  color: '#fee2e2',
                  border: '1px solid rgba(254,202,202,0.35)',
                }}
              >
                <Trash2 className="size-3.5" /> {isDeleting ? 'Deleting...' : 'Delete Profile'}
              </button>

              <button
                onClick={logout}
                disabled={isSaving || isDeleting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.85)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
              >
                <LogOut className="size-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-16 space-y-5">
        <div className="card p-5">
          <div className="flex items-center justify-between gap-4 mb-3">
            <h2
              className="text-lg font-bold"
              style={{ color: 'var(--color-ink)', fontFamily: 'Lora, serif' }}
            >
              Profile Completeness
            </h2>
            <span className="pill pill-primary">{profileCompleteness}% complete</span>
          </div>
          <div className="h-2.5 rounded-full" style={{ background: 'var(--color-surface-2)' }}>
            <div
              className="h-2.5 rounded-full"
              style={{
                width: `${Math.max(0, Math.min(100, profileCompleteness))}%`,
                background:
                  'linear-gradient(90deg, var(--color-accent) 0%, var(--color-primary) 100%)',
              }}
            />
          </div>
        </div>

        {error && (
          <div
            className="card p-4 flex items-start gap-3"
            style={{ borderColor: '#fecaca', background: '#fef2f2' }}
          >
            <AlertTriangle className="size-4 mt-0.5" style={{ color: '#b91c1c' }} />
            <p className="text-sm" style={{ color: '#991b1b' }}>
              {error}
            </p>
          </div>
        )}

        {message && (
          <div
            className="card p-4 flex items-start gap-3"
            style={{ borderColor: '#bbf7d0', background: '#f0fdf4' }}
          >
            <ShieldAlert className="size-4 mt-0.5" style={{ color: '#166534' }} />
            <p className="text-sm" style={{ color: '#14532d' }}>
              {message}
            </p>
          </div>
        )}

        {isEditing && (
          <section className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-5">
              <h3
                className="text-lg font-bold"
                style={{ color: 'var(--color-ink)', fontFamily: 'Lora, serif' }}
              >
                Edit Profile
              </h3>
              <span className="text-xs" style={{ color: 'var(--color-muted)' }}>
                Save only real details you want to use for recommendations.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Full Name
                </span>
                <input
                  className="input-base"
                  value={form.name}
                  onChange={(e) => onFieldChange('name', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Date of Birth
                </span>
                <input
                  className="input-base"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={(e) => onFieldChange('dateOfBirth', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Age
                </span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  max={120}
                  value={form.age}
                  onChange={(e) => onFieldChange('age', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Annual Income (INR)
                </span>
                <input
                  className="input-base"
                  type="number"
                  min={0}
                  value={form.income}
                  onChange={(e) => onFieldChange('income', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Gender
                </span>
                <input
                  className="input-base"
                  value={form.gender}
                  onChange={(e) => onFieldChange('gender', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  State
                </span>
                <input
                  className="input-base"
                  value={form.state}
                  onChange={(e) => onFieldChange('state', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  District
                </span>
                <input
                  className="input-base"
                  value={form.district}
                  onChange={(e) => onFieldChange('district', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Employment
                </span>
                <input
                  className="input-base"
                  value={form.employment}
                  onChange={(e) => onFieldChange('employment', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Education
                </span>
                <input
                  className="input-base"
                  value={form.education}
                  onChange={(e) => onFieldChange('education', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Marital Status
                </span>
                <input
                  className="input-base"
                  value={form.maritalStatus}
                  onChange={(e) => onFieldChange('maritalStatus', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Family Size
                </span>
                <input
                  className="input-base"
                  type="number"
                  min={1}
                  max={30}
                  value={form.familySize}
                  onChange={(e) => onFieldChange('familySize', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Residence Type
                </span>
                <input
                  className="input-base"
                  value={form.residenceType}
                  onChange={(e) => onFieldChange('residenceType', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Occupation
                </span>
                <input
                  className="input-base"
                  value={form.occupation}
                  onChange={(e) => onFieldChange('occupation', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Social Category
                </span>
                <input
                  className="input-base"
                  value={form.socialCategory}
                  onChange={(e) => onFieldChange('socialCategory', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Poverty Status
                </span>
                <input
                  className="input-base"
                  value={form.povertyStatus}
                  onChange={(e) => onFieldChange('povertyStatus', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Ration Card
                </span>
                <input
                  className="input-base"
                  value={form.rationCard}
                  onChange={(e) => onFieldChange('rationCard', e.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Land Ownership
                </span>
                <input
                  className="input-base"
                  value={form.landOwnership}
                  onChange={(e) => onFieldChange('landOwnership', e.target.value)}
                />
              </label>

              <label className="text-sm sm:col-span-2">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Interests (comma separated)
                </span>
                <input
                  className="input-base"
                  value={form.interests}
                  onChange={(e) => onFieldChange('interests', e.target.value)}
                />
              </label>

              <label className="text-sm flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={form.disability}
                  onChange={(e) => onFieldChange('disability', e.target.checked)}
                  className="size-4"
                />
                <span style={{ color: 'var(--color-muted)' }}>Person with Disability</span>
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Disability Type
                </span>
                <input
                  className="input-base"
                  value={form.disabilityType}
                  onChange={(e) => onFieldChange('disabilityType', e.target.value)}
                  disabled={!form.disability}
                />
              </label>

              <label className="text-sm flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  checked={form.minority}
                  onChange={(e) => onFieldChange('minority', e.target.checked)}
                  className="size-4"
                />
                <span style={{ color: 'var(--color-muted)' }}>Minority Community</span>
              </label>

              <label className="text-sm">
                <span className="block mb-1.5" style={{ color: 'var(--color-muted)' }}>
                  Minority Community Type
                </span>
                <input
                  className="input-base"
                  value={form.minorityCommunity}
                  onChange={(e) => onFieldChange('minorityCommunity', e.target.value)}
                  disabled={!form.minority}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2 mt-6">
              <button onClick={saveProfile} disabled={isSaving} className="btn btn-primary">
                <Save className="size-3.5" /> {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={cancelEdit} disabled={isSaving} className="btn btn-ghost">
                <X className="size-3.5" /> Cancel
              </button>
            </div>
          </section>
        )}

        {!isEditing && (
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {profileCards.map(({ label, value, icon: Icon }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p
                    className="text-xs uppercase tracking-wide font-bold"
                    style={{ color: 'var(--color-muted-2)' }}
                  >
                    {label}
                  </p>
                  <Icon className="size-4" style={{ color: 'var(--color-primary)' }} />
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                  {value}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

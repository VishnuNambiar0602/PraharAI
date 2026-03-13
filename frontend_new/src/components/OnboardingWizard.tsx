import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Briefcase,
  GraduationCap,
  Heart,
  ChevronRight,
  ChevronLeft,
  Check,
  X,
} from 'lucide-react';
import {
  updateProfile,
  getLGDStates,
  getLGDDistricts,
  getLGDSubdistricts,
  getLGDPanchayats,
} from '../api';
import { useAuth } from '../AuthContext';
import SearchableSelect from './SearchableSelect';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const INTERESTS = [
  'Agriculture',
  'Health',
  'Education',
  'Housing',
  'Employment',
  'Women Welfare',
  'Senior Citizens',
  'Disability',
  'Minority',
  'Sports',
  'Entrepreneurship',
  'Skill Development',
  'Social Welfare',
  'Finance',
];

const steps = [
  { id: 1, label: 'Personal', icon: User, title: 'Personal Details' },
  { id: 2, label: 'Work', icon: Briefcase, title: 'Work, Income & Land' },
  { id: 3, label: 'Education', icon: GraduationCap, title: 'Education & Category' },
  { id: 4, label: 'Interests', icon: Heart, title: 'Interests' },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[0.72rem] font-bold uppercase tracking-[0.08em] mb-1.5"
      style={{ color: 'var(--color-muted)' }}
    >
      {children}
    </label>
  );
}

export default function OnboardingWizard({ onComplete, onSkip }: Props) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age?.toString() || '');
  const [state, setState] = useState(user?.state || '');
  const [district, setDistrict] = useState((user as any)?.district || '');
  const [subdistrict, setSubdistrict] = useState((user as any)?.subdistrict || '');
  const [panchayatName, setPanchayatName] = useState((user as any)?.panchayatName || '');
  const [gender, setGender] = useState((user as any)?.gender || '');
  const [maritalStatus, setMaritalStatus] = useState((user as any)?.maritalStatus || '');
  const [familySize, setFamilySize] = useState((user as any)?.familySize?.toString() || '');
  const [residenceType, setResidenceType] = useState((user as any)?.residenceType || '');

  // LGD geography data
  const [stateOptions, setStateOptions] = useState<string[]>([]);
  const [districtOptions, setDistrictOptions] = useState<string[]>([]);
  const [subdistrictOptions, setSubdistrictOptions] = useState<string[]>([]);
  const [panchayatOptions, setPanchayatOptions] = useState<string[]>([]);
  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingSubdistricts, setLoadingSubdistricts] = useState(false);
  const [loadingPanchayats, setLoadingPanchayats] = useState(false);

  const [employment, setEmployment] = useState(user?.employment || '');
  const [occupation, setOccupation] = useState((user as any)?.occupation || '');
  const [income, setIncome] = useState(user?.income?.toString() || '');
  const [povertyStatus, setPovertyStatus] = useState((user as any)?.povertyStatus || '');
  const [rationCard, setRationCard] = useState((user as any)?.rationCard || '');
  const [landOwnership, setLandOwnership] = useState((user as any)?.landOwnership || '');

  const [education, setEducation] = useState(user?.education || '');
  const [socialCategory, setSocialCategory] = useState((user as any)?.socialCategory || '');
  const [hasDisability, setHasDisability] = useState(!!(user as any)?.disability);
  const [disabilityType, setDisabilityType] = useState((user as any)?.disabilityType || '');
  const [isMinority, setIsMinority] = useState(!!(user as any)?.minority);
  const [minorityCommunity, setMinorityCommunity] = useState(
    (user as any)?.minorityCommunity || ''
  );

  const [interests, setInterests] = useState<string[]>([]);

  // Load LGD states once on mount
  useEffect(() => {
    getLGDStates().then((states) => setStateOptions(states.map((s) => s.name)));
  }, []);

  // Reload districts whenever state changes
  useEffect(() => {
    if (!state) {
      setDistrictOptions([]);
      setDistrict('');
      setSubdistrictOptions([]);
      setSubdistrict('');
      setPanchayatOptions([]);
      setPanchayatName('');
      return;
    }
    setLoadingDistricts(true);
    getLGDDistricts(state)
      .then((d) => setDistrictOptions(d))
      .finally(() => setLoadingDistricts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Reload sub-districts whenever district changes
  useEffect(() => {
    if (!state || !district) {
      setSubdistrictOptions([]);
      setSubdistrict('');
      setPanchayatOptions([]);
      setPanchayatName('');
      return;
    }
    setLoadingSubdistricts(true);
    getLGDSubdistricts(state, district)
      .then((s) => setSubdistrictOptions(s))
      .finally(() => setLoadingSubdistricts(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [district]);

  // Reload villages/panchayats whenever sub-district changes
  useEffect(() => {
    if (!state || !district) {
      setPanchayatOptions([]);
      setPanchayatName('');
      return;
    }
    setLoadingPanchayats(true);
    getLGDPanchayats(state, district, subdistrict || undefined)
      .then((p) => setPanchayatOptions(p))
      .finally(() => setLoadingPanchayats(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subdistrict, district]);

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const saveAndNext = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload: Record<string, any> = {};
      if (step === 1) {
        if (name) payload.name = name;
        if (age) payload.age = Number(age);
        if (state) payload.state = state;
        if (district) payload.district = district;
        if (subdistrict) payload.subdistrict = subdistrict;
        if (panchayatName) payload.panchayat_name = panchayatName;
        if (gender) payload.gender = gender;
        if (maritalStatus) payload.maritalStatus = maritalStatus;
        if (familySize) payload.familySize = Number(familySize);
        if (residenceType) payload.residenceType = residenceType;
      } else if (step === 2) {
        if (employment) payload.employment = employment;
        if (occupation) payload.occupation = occupation;
        if (income) payload.income = Number(income);
        if (povertyStatus) payload.povertyStatus = povertyStatus;
        if (rationCard) payload.rationCard = rationCard;
        if (landOwnership) payload.landOwnership = landOwnership;
      } else if (step === 3) {
        if (education) payload.education = education;
        if (socialCategory) payload.socialCategory = socialCategory;
        payload.disability = hasDisability;
        if (hasDisability && disabilityType) payload.disabilityType = disabilityType;
        payload.minority = isMinority;
        if (isMinority && minorityCommunity) payload.minorityCommunity = minorityCommunity;
      } else if (step === 4) {
        if (interests.length > 0) payload.interests = interests.join(',');
        payload.onboardingComplete = true;
      }
      if (Object.keys(payload).length > 0) {
        await updateProfile(user.userId, payload);
      }
    } catch (e) {
      console.error('Failed to save step', e);
    } finally {
      setSaving(false);
    }

    if (step < 4) {
      setStep((s) => s + 1);
    } else {
      await refreshProfile();
      onComplete();
    }
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return employment.length > 0;
    if (step === 3) return education.length > 0;
    if (step === 4) return true;
    return true;
  };

  const ChipGroup = ({
    options,
    value,
    onChange,
    columns = 2,
  }: {
    options: string[];
    value: string;
    onChange: (v: string) => void;
    columns?: number;
  }) => (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className="h-11 px-3 rounded-xl border text-sm font-semibold transition-all"
          style={
            value === opt
              ? {
                  background: 'var(--color-accent)',
                  color: '#fff',
                  borderColor: 'var(--color-accent)',
                  boxShadow: '0 3px 10px rgba(200,112,13,0.32)',
                }
              : {
                  background: 'var(--color-parchment)',
                  color: 'var(--color-ink-2)',
                  borderColor: 'var(--color-border)',
                }
          }
        >
          {opt}
        </button>
      ))}
    </div>
  );

  const currentStep = steps[step - 1];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSkip]);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSkip();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 28, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        className="w-full max-w-3xl rounded-2xl border overflow-hidden flex flex-col"
        style={{
          maxHeight: 'min(92vh, 860px)',
          background: 'var(--color-parchment)',
          borderColor: 'var(--color-border)',
          boxShadow: '0 24px 60px rgba(7,15,26,0.35)',
        }}
      >
        <header
          className="relative px-5 sm:px-7 py-5 sm:py-6 shrink-0"
          style={{
            background:
              'linear-gradient(145deg, var(--color-primary-900) 0%, var(--color-primary) 55%, var(--color-primary-700) 100%)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 15% 18%, rgba(255,255,255,0.12), transparent 34%), radial-gradient(circle at 85% 50%, rgba(200,112,13,0.22), transparent 35%)',
            }}
          />

          <button
            type="button"
            onClick={onSkip}
            className="absolute top-4 right-4 z-20 size-8 rounded-full grid place-items-center transition-colors pointer-events-auto"
            style={{ color: 'rgba(255,255,255,0.9)', background: 'rgba(255,255,255,0.08)' }}
            aria-label="Close onboarding"
          >
            <X className="size-4" />
          </button>

          <div className="relative z-10">
            <p
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Step {step} of 4
            </p>
            <h2
              className="mt-2 text-2xl sm:text-[1.85rem] font-bold"
              style={{ color: 'white', fontFamily: 'Lora, serif' }}
            >
              {currentStep.title}
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: 'rgba(255,255,255,0.78)' }}>
              Complete your profile for better and more relevant scheme matching.
            </p>

            <div className="mt-5 grid grid-cols-4 gap-2">
              {steps.map((item) => {
                const Icon = item.icon;
                const active = item.id === step;
                const done = item.id < step;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl px-2 py-2.5 text-center border"
                    style={{
                      borderColor: active ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.16)',
                      background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center justify-center mb-1">
                      <span
                        className="size-6 rounded-full grid place-items-center"
                        style={{
                          background:
                            done || active ? 'var(--color-accent)' : 'rgba(255,255,255,0.16)',
                          color: '#fff',
                        }}
                      >
                        <Icon className="size-3.5" />
                      </span>
                    </div>
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.09em]"
                      style={{ color: 'rgba(255,255,255,0.85)' }}
                    >
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 sm:px-7 py-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              {step === 1 && (
                <>
                  <div>
                    <FieldLabel>Full Name *</FieldLabel>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="input-base h-11"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Age</FieldLabel>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="e.g. 28"
                        min="5"
                        max="120"
                        className="input-base h-11"
                      />
                    </div>
                    <div>
                      <FieldLabel>Gender</FieldLabel>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="input-base h-11"
                      >
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <FieldLabel>State / UT *</FieldLabel>
                    <SearchableSelect
                      options={stateOptions}
                      value={state}
                      onChange={(v) => setState(v)}
                      placeholder={stateOptions.length === 0 ? 'Loading states…' : 'Select state…'}
                      disabled={stateOptions.length === 0}
                    />
                  </div>

                  <div>
                    <FieldLabel>District</FieldLabel>
                    <SearchableSelect
                      options={districtOptions}
                      value={district}
                      onChange={(v) => setDistrict(v)}
                      placeholder={
                        !state
                          ? 'Select state first…'
                          : loadingDistricts
                            ? 'Loading…'
                            : 'Select district…'
                      }
                      disabled={!state || loadingDistricts}
                    />
                  </div>

                  <div>
                    <FieldLabel>Block / Sub-District</FieldLabel>
                    <SearchableSelect
                      options={subdistrictOptions}
                      value={subdistrict}
                      onChange={(v) => {
                        setSubdistrict(v);
                        setPanchayatName('');
                      }}
                      placeholder={
                        !district
                          ? 'Select district first…'
                          : loadingSubdistricts
                            ? 'Loading…'
                            : subdistrictOptions.length === 0
                              ? 'No blocks found'
                              : 'Select block…'
                      }
                      disabled={!district || loadingSubdistricts}
                    />
                  </div>

                  <div>
                    <FieldLabel>Village / Gram Panchayat</FieldLabel>
                    <SearchableSelect
                      options={panchayatOptions}
                      value={panchayatName}
                      onChange={(v) => setPanchayatName(v)}
                      allowFreeText
                      placeholder={
                        !district
                          ? 'Select district first…'
                          : loadingPanchayats
                            ? 'Loading…'
                            : 'Search your village or GP…'
                      }
                      disabled={!district || loadingPanchayats}
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      Helps connect you with your local panchayat services.
                    </p>
                  </div>

                  <div>
                    <FieldLabel>Marital Status</FieldLabel>
                    <ChipGroup
                      options={['Single', 'Married', 'Divorced', 'Widowed']}
                      value={maritalStatus}
                      onChange={setMaritalStatus}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Family Size</FieldLabel>
                      <input
                        type="number"
                        value={familySize}
                        onChange={(e) => setFamilySize(e.target.value)}
                        placeholder="e.g. 4"
                        min="1"
                        max="20"
                        className="input-base h-11"
                      />
                    </div>
                    <div>
                      <FieldLabel>Residence</FieldLabel>
                      <select
                        value={residenceType}
                        onChange={(e) => setResidenceType(e.target.value)}
                        className="input-base h-11"
                      >
                        <option value="">Select</option>
                        <option value="Rural">Rural</option>
                        <option value="Urban">Urban</option>
                        <option value="Semi-urban">Semi-urban</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <FieldLabel>Employment Status *</FieldLabel>
                    <ChipGroup
                      options={[
                        'Salaried',
                        'Self-Employed',
                        'Unemployed',
                        'Student',
                        'Farmer',
                        'Retired',
                      ]}
                      value={employment}
                      onChange={setEmployment}
                      columns={3}
                    />
                  </div>

                  <div>
                    <FieldLabel>Specific Occupation</FieldLabel>
                    <input
                      value={occupation}
                      onChange={(e) => setOccupation(e.target.value)}
                      placeholder="e.g. Construction Worker, Artisan, Teacher"
                      className="input-base h-11"
                    />
                    <p className="text-xs mt-1" style={{ color: 'var(--color-muted)' }}>
                      Helps match occupation-specific schemes.
                    </p>
                  </div>

                  <div>
                    <FieldLabel>Annual Income (INR)</FieldLabel>
                    <input
                      type="number"
                      value={income}
                      onChange={(e) => setIncome(e.target.value)}
                      placeholder="e.g. 350000"
                      className="input-base h-11"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <FieldLabel>Poverty Status</FieldLabel>
                      <ChipGroup
                        options={['BPL', 'APL', 'Not Sure']}
                        value={povertyStatus}
                        onChange={setPovertyStatus}
                        columns={1}
                      />
                    </div>
                    <div>
                      <FieldLabel>Ration Card</FieldLabel>
                      <ChipGroup
                        options={['AAY', 'BPL', 'APL', 'None']}
                        value={rationCard}
                        onChange={setRationCard}
                        columns={1}
                      />
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Land Ownership</FieldLabel>
                    <ChipGroup
                      options={[
                        'Landless',
                        'Marginal (< 1 ha)',
                        'Small (1-2 ha)',
                        'Large (> 2 ha)',
                        'N/A',
                      ]}
                      value={landOwnership}
                      onChange={setLandOwnership}
                      columns={2}
                    />
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <FieldLabel>Education Level *</FieldLabel>
                    <ChipGroup
                      options={[
                        'Below 10th',
                        '10th / SSC',
                        '12th / HSC',
                        'Diploma',
                        'Graduate',
                        'Post-Graduate',
                      ]}
                      value={education}
                      onChange={setEducation}
                      columns={3}
                    />
                  </div>

                  <div>
                    <FieldLabel>Social Category</FieldLabel>
                    <ChipGroup
                      options={['General', 'OBC', 'SC', 'ST', 'EWS', 'Minority']}
                      value={socialCategory}
                      onChange={setSocialCategory}
                      columns={3}
                    />
                  </div>

                  <div
                    className="rounded-xl p-3.5 border"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasDisability}
                        onChange={(e) => {
                          setHasDisability(e.target.checked);
                          if (!e.target.checked) setDisabilityType('');
                        }}
                        className="size-4 rounded accent-accent"
                      />
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                        Person with Disability
                      </span>
                    </label>
                    {hasDisability && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3"
                      >
                        <ChipGroup
                          options={[
                            'Visual',
                            'Hearing',
                            'Locomotor',
                            'Intellectual',
                            'Multiple',
                            'Other',
                          ]}
                          value={disabilityType}
                          onChange={setDisabilityType}
                          columns={3}
                        />
                      </motion.div>
                    )}
                  </div>

                  <div
                    className="rounded-xl p-3.5 border"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isMinority}
                        onChange={(e) => {
                          setIsMinority(e.target.checked);
                          if (!e.target.checked) setMinorityCommunity('');
                        }}
                        className="size-4 rounded accent-accent"
                      />
                      <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                        Minority Community
                      </span>
                    </label>
                    {isMinority && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3"
                      >
                        <ChipGroup
                          options={['Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi']}
                          value={minorityCommunity}
                          onChange={setMinorityCommunity}
                          columns={3}
                        />
                      </motion.div>
                    )}
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <div
                    className="rounded-xl border p-3.5"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
                      Select areas you care about. This helps prioritize recommendations.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map((interest) => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className="px-3.5 h-10 rounded-full border text-sm font-semibold transition-all"
                        style={
                          interests.includes(interest)
                            ? {
                                background: 'var(--color-accent)',
                                borderColor: 'var(--color-accent)',
                                color: '#fff',
                              }
                            : {
                                background: 'var(--color-parchment)',
                                borderColor: 'var(--color-border)',
                                color: 'var(--color-ink-2)',
                              }
                        }
                      >
                        {interests.includes(interest) && <Check className="size-3.5 inline mr-1" />}
                        {interest}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <footer
          className="px-5 sm:px-7 py-4 border-t flex items-center justify-between gap-3 shrink-0"
          style={{ borderColor: 'var(--color-border)', background: 'var(--color-parchment)' }}
        >
          <button
            type="button"
            onClick={step === 1 ? onSkip : () => setStep((s) => s - 1)}
            className="btn btn-ghost"
          >
            {step === 1 ? (
              'Skip For Now'
            ) : (
              <>
                <ChevronLeft className="size-4" /> Back
              </>
            )}
          </button>

          <button
            type="button"
            onClick={saveAndNext}
            disabled={!canProceed() || saving}
            className="btn btn-primary"
          >
            {saving ? (
              <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : step === 4 ? (
              <>
                <Check className="size-4" /> Complete Setup
              </>
            ) : (
              <>
                Next <ChevronRight className="size-4" />
              </>
            )}
          </button>
        </footer>
      </motion.div>
    </div>
  );
}

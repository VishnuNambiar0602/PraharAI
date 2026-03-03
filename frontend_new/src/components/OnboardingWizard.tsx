import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Briefcase, GraduationCap, Heart, ChevronRight, ChevronLeft, Check, X } from 'lucide-react';
import { updateProfile } from '../api';
import { useAuth } from '../AuthContext';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Puducherry', 'Chandigarh',
];

const INTERESTS = [
  'Agriculture', 'Health', 'Education', 'Housing', 'Employment',
  'Women Welfare', 'Senior Citizens', 'Disability', 'Minority', 'Sports',
  'Entrepreneurship', 'Skill Development', 'Social Welfare', 'Finance',
];

const steps = [
  { id: 1, label: 'Personal', icon: User, title: 'Your Personal Details' },
  { id: 2, label: 'Work', icon: Briefcase, title: 'Employment & Income' },
  { id: 3, label: 'Education', icon: GraduationCap, title: 'Education & Category' },
  { id: 4, label: 'Interests', icon: Heart, title: 'Pick Your Interests' },
];

export default function OnboardingWizard({ onComplete, onSkip }: Props) {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [name, setName] = useState(user?.name || '');
  const [age, setAge] = useState(user?.age?.toString() || '');
  const [state, setState] = useState(user?.state || '');
  const [gender, setGender] = useState((user as any)?.gender || '');

  // Step 2
  const [employment, setEmployment] = useState(user?.employment || '');
  const [income, setIncome] = useState(user?.income?.toString() || '');

  // Step 3
  const [education, setEducation] = useState(user?.education || '');
  const [socialCategory, setSocialCategory] = useState('');

  // Step 4
  const [interests, setInterests] = useState<string[]>([]);

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
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
        if (gender) payload.gender = gender;
      } else if (step === 2) {
        if (employment) payload.employment = employment;
        if (income) payload.income = Number(income);
      } else if (step === 3) {
        if (education) payload.education = education;
        if (socialCategory) payload.socialCategory = socialCategory;
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
      setStep(s => s + 1);
    } else {
      await refreshProfile();
      onComplete();
    }
  };

  const canProceed = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return employment.length > 0;
    if (step === 3) return education.length > 0;
    if (step === 4) return true; // interests optional
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end justify-center sm:items-center">
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary/80 p-6 text-white relative">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="size-4" />
          </button>
          <p className="text-xs font-bold uppercase tracking-widest text-white/70 mb-1">Step {step} of 4</p>
          <h2 className="text-xl font-bold">{steps[step - 1].title}</h2>
          <p className="text-sm text-white/70 mt-1">
            Complete your profile to get personalized scheme recommendations
          </p>

          {/* Progress bar */}
          <div className="mt-4 flex gap-1.5">
            {steps.map(s => (
              <div
                key={s.id}
                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                  s.id <= step ? 'bg-white' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 min-h-[280px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {step === 1 && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Full Name *</label>
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Age</label>
                      <input
                        type="number"
                        value={age}
                        onChange={e => setAge(e.target.value)}
                        placeholder="e.g. 28"
                        min="5" max="120"
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Gender</label>
                      <select
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
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
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">State / UT</label>
                    <select
                      value={state}
                      onChange={e => setState(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                    >
                      <option value="">Select state</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Employment Status *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Salaried', 'Self-Employed', 'Unemployed', 'Student', 'Farmer', 'Retired'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setEmployment(opt)}
                          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            employment === opt
                              ? 'bg-primary text-white border-primary'
                              : 'border-slate-200 text-slate-600 hover:border-primary/40'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Annual Income (₹)</label>
                    <input
                      type="number"
                      value={income}
                      onChange={e => setIncome(e.target.value)}
                      placeholder="e.g. 350000"
                      className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <p className="text-xs text-slate-400 mt-1">Used only to match relevant government schemes</p>
                  </div>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Education Level *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['Below 10th', '10th / SSC', '12th / HSC', 'Diploma', 'Graduate', 'Post-Graduate'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setEducation(opt)}
                          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            education === opt
                              ? 'bg-primary text-white border-primary'
                              : 'border-slate-200 text-slate-600 hover:border-primary/40'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Social Category</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['General', 'OBC', 'SC', 'ST', 'EWS', 'Minority'].map(opt => (
                        <button
                          key={opt}
                          onClick={() => setSocialCategory(opt)}
                          className={`px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                            socialCategory === opt
                              ? 'bg-primary text-white border-primary'
                              : 'border-slate-200 text-slate-600 hover:border-primary/40'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 4 && (
                <>
                  <p className="text-sm text-slate-500">Select areas you're interested in (optional)</p>
                  <div className="flex flex-wrap gap-2">
                    {INTERESTS.map(interest => (
                      <button
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                          interests.includes(interest)
                            ? 'bg-primary text-white border-primary'
                            : 'border-slate-200 text-slate-600 hover:border-primary/40'
                        }`}
                      >
                        {interests.includes(interest) && <Check className="size-3 inline mr-1" />}
                        {interest}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 pb-8 flex items-center justify-between gap-3">
          <button
            onClick={step === 1 ? onSkip : () => setStep(s => s - 1)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            {step === 1 ? (
              'Skip for now'
            ) : (
              <><ChevronLeft className="size-4" /> Back</>
            )}
          </button>

          <button
            onClick={saveAndNext}
            disabled={!canProceed() || saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-40 hover:bg-primary/90 transition-all shadow-md"
          >
            {saving ? (
              <span className="animate-spin size-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : step === 4 ? (
              <><Check className="size-4" /> Complete Setup</>
            ) : (
              <>Next <ChevronRight className="size-4" /></>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

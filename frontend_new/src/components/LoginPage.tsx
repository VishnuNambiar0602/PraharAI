import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  ChevronLeft,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { View } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Jammu & Kashmir',
  'Ladakh',
  'Puducherry',
  'Chandigarh',
];

interface LoginPageProps {
  onNavigate: (view: View) => void;
  onLoginSuccess?: () => void;
}

export default function LoginPage({ onNavigate, onLoginSuccess }: LoginPageProps) {
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [form, setForm] = useState({
    email: '',
    password: '',
    name: '',
    age: '',
    state: '',
    income: '',
    gender: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  // Password strength calculator
  const getPasswordStrength = (pwd: string): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[a-z]/.test(pwd) && /[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[^a-zA-Z0-9]/.test(pwd)) score++;

    if (score <= 2) return { score, label: t('auth.password_strength_weak'), color: 'bg-red-500' };
    if (score === 3)
      return { score, label: t('auth.password_strength_fair'), color: 'bg-yellow-500' };
    if (score === 4)
      return { score, label: t('auth.password_strength_good'), color: 'bg-blue-500' };
    return { score, label: t('auth.password_strength_strong'), color: 'bg-green-500' };
  };

  const passwordStrength = mode === 'register' ? getPasswordStrength(form.password) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
        setSuccessMessage(`${t('auth.welcome_toast')} ${t('auth.redirecting')}`);
      } else {
        await register({
          email: form.email,
          password: form.password,
          name: form.name,
          age: form.age ? Number(form.age) : undefined,
          state: form.state || undefined,
          income: form.income ? Number(form.income) : undefined,
          gender: form.gender || undefined,
        });
        setSuccessMessage(`${t('auth.account_created')} ${t('auth.redirecting')}`);
      }
      setTimeout(() => {
        if (onLoginSuccess) onLoginSuccess();
        else onNavigate('home');
      }, 1000);
    } catch (err: any) {
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left Branding Panel ── */}
      <div
        className="hidden lg:flex lg:w-5/12 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'var(--color-primary)' }}
      >
        {/* Background geometric pattern */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Large concentric circles */}
          <svg
            viewBox="0 0 600 600"
            className="absolute -right-32 -top-32 w-[480px] h-[480px] opacity-[0.06]"
            fill="none"
          >
            {[46, 92, 138, 184, 230, 276].map((r, i) => (
              <circle key={i} cx="300" cy="300" r={r} stroke="white" strokeWidth="1" />
            ))}
            {Array.from({ length: 24 }).map((_, i) => {
              const angle = (i * 360) / 24;
              const rad = (angle * Math.PI) / 180;
              return (
                <line
                  key={i}
                  x1={300 + 50 * Math.cos(rad)}
                  y1={300 + 50 * Math.sin(rad)}
                  x2={300 + 274 * Math.cos(rad)}
                  y2={300 + 274 * Math.sin(rad)}
                  stroke="white"
                  strokeWidth="0.8"
                />
              );
            })}
            <circle cx="300" cy="300" r="20" stroke="white" strokeWidth="2" fill="none" />
          </svg>
          {/* Bottom left circles */}
          <svg
            viewBox="0 0 300 300"
            className="absolute -left-16 -bottom-16 w-64 h-64 opacity-[0.05]"
            fill="none"
          >
            {[32, 64, 96, 128].map((r, i) => (
              <circle key={i} cx="150" cy="150" r={r} stroke="white" strokeWidth="1" />
            ))}
          </svg>
          {/* Diagonal grid lines */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(255,255,255,0.03) 0px, rgba(255,255,255,0.03) 1px, transparent 1px, transparent 40px)',
            }}
          />
        </div>

        {/* Logo */}
        <button onClick={() => onNavigate('home')} className="flex items-center gap-3 relative z-10">
          <div
            className="size-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <svg viewBox="0 0 100 100" className="size-6 text-white" fill="none">
              <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="5" />
              <circle cx="50" cy="50" r="8" stroke="currentColor" strokeWidth="5" />
              {Array.from({ length: 24 }).map((_, i) => {
                const a = (i * 360) / 24,
                  r = (a * Math.PI) / 180;
                return (
                  <line
                    key={i}
                    x1={50 + 10 * Math.cos(r)}
                    y1={50 + 10 * Math.sin(r)}
                    x2={50 + 44 * Math.cos(r)}
                    y2={50 + 44 * Math.sin(r)}
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                );
              })}
            </svg>
          </div>
          <span
            className="font-display text-2xl font-bold text-white"
            style={{ letterSpacing: '-0.02em' }}
          >
            Prahar AI
          </span>
        </button>

        {/* Hero text */}
        <div className="space-y-6 relative z-10">
          <div>
            <h2
              className="font-display text-4xl font-bold text-white leading-tight mb-4"
              style={{ letterSpacing: '-0.02em' }}
            >
              {t('auth.left_title_line_1')}
              <br />
              <span style={{ color: 'var(--color-accent-300)', fontStyle: 'italic' }}>
                {t('auth.left_title_line_2')}
              </span>
            </h2>
            <p
              className="text-base leading-relaxed max-w-sm"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              {t('auth.left_subtitle')}
            </p>
          </div>

          {/* Feature points */}
          <div className="space-y-3.5">
            {[t('auth.left_point_1'), t('auth.left_point_2'), t('auth.left_point_3')].map(
              (p, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="size-5 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(200,168,85,0.25)', border: '1px solid rgba(200,168,85,0.4)' }}
                  >
                    <CheckCircle2
                      className="size-3"
                      style={{ color: 'var(--color-accent-300)' }}
                    />
                  </div>
                  <span className="text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    {p}
                  </span>
                </div>
              ),
            )}
          </div>

          {/* Stat row */}
          <div
            className="flex gap-6 pt-4"
            style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}
          >
            {[
              { n: '500+', label: 'Schemes' },
              { n: '28', label: 'States' },
              { n: '10L+', label: 'Beneficiaries' },
            ].map(({ n, label }) => (
              <div key={label}>
                <p
                  className="font-display text-2xl font-bold text-white"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {n}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs relative z-10" style={{ color: 'rgba(255,255,255,0.28)' }}>
          © {new Date().getFullYear()} Prahar AI · {t('auth.left_footer_partner')}
        </p>
      </div>

      {/* ── Right Form Panel ── */}
      <div
        className="flex-1 flex items-center justify-center px-6 py-12"
        style={{ background: 'var(--color-surface)' }}
      >
        <motion.div
          key={mode}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md"
        >
          <button
            onClick={() => onNavigate('home')}
            className="lg:hidden flex items-center gap-1 text-sm mb-6 transition-colors"
            style={{ color: 'var(--color-muted)' }}
          >
            <ChevronLeft className="size-4" /> {t('auth.back_home')}
          </button>

          <div className="mb-8">
            <h1
              className="font-display text-3xl font-bold mb-2"
              style={{ color: 'var(--color-ink)', letterSpacing: '-0.01em' }}
            >
              {mode === 'login' ? t('auth.welcome_back') : t('auth.create_account')}
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              {mode === 'login' ? t('auth.login_subtitle') : t('auth.register_subtitle')}
            </p>
          </div>

          {/* Tab Switcher */}
          <div
            className="relative flex gap-1 p-1 rounded-xl mb-6"
            style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}
          >
            <AnimatePresence mode="wait">
              {(['login', 'register'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setError('');
                    setSuccessMessage('');
                  }}
                  className="relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors z-10"
                  style={{ color: mode === m ? '#fff' : 'var(--color-muted)' }}
                >
                  {mode === m && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg shadow-sm"
                      style={{ background: 'var(--color-primary)' }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10">
                    {m === 'login' ? t('auth.sign_in') : t('auth.register')}
                  </span>
                </button>
              ))}
            </AnimatePresence>
          </div>

          {/* Success Message */}
          <AnimatePresence>
            {successMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                style={{
                  background: 'var(--color-success-50)',
                  border: '1px solid var(--color-success-100)',
                  color: 'var(--color-success)',
                }}
              >
                <CheckCircle2 className="size-4 shrink-0" />
                {successMessage}
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C' }}
            >
              <X className="size-4 shrink-0" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, x: mode === 'register' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: mode === 'register' ? -20 : 20 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {mode === 'register' && (
                  <div>
                    <Label htmlFor="name">{t('auth.full_name')}</Label>
                    <Input
                      id="name"
                      type="text"
                      required
                      value={form.name}
                      onChange={(e) => update('name', e.target.value)}
                      placeholder={t('auth.name_placeholder')}
                    />
                  </div>
                )}

                <div>
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => update('email', e.target.value)}
                    placeholder={t('auth.email_placeholder')}
                  />
                </div>

                <div>
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => update('password', e.target.value)}
                      placeholder={t('auth.password_placeholder')}
                      className="pr-12!"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary transition-colors"
                    >
                      {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {mode === 'register' && form.password && passwordStrength && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 space-y-2"
                    >
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div
                            key={level}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              level <= passwordStrength.score
                                ? passwordStrength.color
                                : 'bg-gray-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span
                          className={`font-medium ${
                            passwordStrength.score <= 2
                              ? 'text-red-600'
                              : passwordStrength.score === 3
                                ? 'text-yellow-600'
                                : passwordStrength.score === 4
                                  ? 'text-blue-600'
                                  : 'text-green-600'
                          }`}
                        >
                          {passwordStrength.label}
                        </span>
                        <span className="text-muted">
                          {passwordStrength.score >= 4 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Check className="size-3" /> {t('auth.password_strength_secure')}
                            </span>
                          )}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </div>

                {mode === 'register' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="age">{t('auth.age')}</Label>
                        <Input
                          id="age"
                          type="number"
                          min={1}
                          max={120}
                          value={form.age}
                          onChange={(e) => update('age', e.target.value)}
                          placeholder={t('auth.age_placeholder')}
                        />
                      </div>
                      <div>
                        <Label htmlFor="gender">{t('auth.gender')}</Label>
                        <select
                          id="gender"
                          value={form.gender}
                          onChange={(e) => update('gender', e.target.value)}
                          className="input-base"
                        >
                          <option value="">{t('auth.select')}</option>
                          <option value="Male">{t('auth.gender_male')}</option>
                          <option value="Female">{t('auth.gender_female')}</option>
                          <option value="Other">{t('auth.gender_other')}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="state">{t('auth.state')}</Label>
                      <select
                        id="state"
                        value={form.state}
                        onChange={(e) => update('state', e.target.value)}
                        className="input-base"
                      >
                        <option value="">{t('auth.state_select')}</option>
                        {INDIA_STATES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="income">{t('auth.income')}</Label>
                      <Input
                        id="income"
                        type="number"
                        min={0}
                        value={form.income}
                        onChange={(e) => update('income', e.target.value)}
                        placeholder={t('auth.income_placeholder')}
                      />
                    </div>
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-navy w-full py-3! text-sm! mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {t('auth.processing')}
                </>
              ) : (
                <>
                  {mode === 'login' ? t('auth.sign_in_button') : t('auth.create_button')}
                  <ArrowRight className="size-4" />
                </>
              )}
            </button>
          </form>

          <div
            className="mt-6 flex items-center gap-2 text-xs"
            style={{ color: 'var(--color-muted)' }}
          >
            <ShieldCheck className="size-3.5 shrink-0" style={{ color: 'var(--color-success)' }} />
            {t('auth.security_notice')}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

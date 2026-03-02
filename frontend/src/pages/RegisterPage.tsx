import { useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Mail, Lock, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { register } = useAuth();

  // Form data
  const [formData, setFormData] = useState({
    // Basic Info
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    
    // Required demographic fields
    gender: '',
    age: '',
    state: '',
    socialCategory: '',
    locality: '',
    isDisabled: false,
    isMinority: false,
    
    // Economic fields
    income: '',
    employment: '',
    povertyLine: '',
    
    // Education
    education: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setError('');
    setLoading(true);

    try {
      console.log('RegisterPage: Calling register function');
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        gender: formData.gender as any,
        age: parseInt(formData.age),
        state: formData.state,
        socialCategory: formData.socialCategory as any,
        locality: formData.locality as any,
        isDisabled: formData.isDisabled,
        isMinority: formData.isMinority,
        income: parseInt(formData.income),
        employment: formData.employment as any,
        povertyLine: formData.povertyLine as any,
        education: formData.education as any,
      });
      
      console.log('RegisterPage: Registration successful, redirecting to dashboard');
      
      // Navigate to dashboard after successful registration
      navigate('/dashboard');
    } catch (err: any) {
      console.error('RegisterPage: Registration error:', err);
      setError(err.message || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-background-light flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h1>
            <p className="text-slate-500">Get personalized scheme recommendations</p>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                  step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'
                }`}>
                  {step > s ? <CheckCircle2 className="w-6 h-6" /> : s}
                </div>
                {s < 3 && (
                  <div className={`w-16 h-1 ${step > s ? 'bg-primary' : 'bg-slate-200'}`} />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Basic Information</h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Email Address *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Password *</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>
              </motion.div>
            )}

            {/* Step 2: Demographics */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Demographic Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Gender *</label>
                    <select
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Age *</label>
                    <input
                      type="number"
                      name="age"
                      value={formData.age}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                      min="1"
                      max="120"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Social Category *</label>
                  <select
                    name="socialCategory"
                    value={formData.socialCategory}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select</option>
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="Minority">Minority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Locality *</label>
                  <select
                    name="locality"
                    value={formData.locality}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Rural">Rural</option>
                    <option value="Urban">Urban</option>
                    <option value="Semi-Urban">Semi-Urban</option>
                  </select>
                </div>

                <div className="flex gap-6">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isDisabled"
                      checked={formData.isDisabled}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">Person with Disability</span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="isMinority"
                      checked={formData.isMinority}
                      onChange={handleChange}
                      className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                    />
                    <span className="text-sm text-slate-700">Minority Community</span>
                  </label>
                </div>
              </motion.div>
            )}

            {/* Step 3: Economic & Education */}
            {step === 3 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-4"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Economic & Education Details</h3>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Annual Income (₹) *</label>
                  <input
                    type="number"
                    name="income"
                    value={formData.income}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Employment Status *</label>
                  <select
                    name="employment"
                    value={formData.employment}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Employed">Employed</option>
                    <option value="Unemployed">Unemployed</option>
                    <option value="Student">Student</option>
                    <option value="Self-Employed">Self-Employed</option>
                    <option value="Retired">Retired</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Poverty Line Status</label>
                  <select
                    name="povertyLine"
                    value={formData.povertyLine}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="">Select</option>
                    <option value="BPL">Below Poverty Line (BPL)</option>
                    <option value="APL">Above Poverty Line (APL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Education Level *</label>
                  <select
                    name="education"
                    value={formData.education}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Primary">Primary</option>
                    <option value="Secondary">Secondary</option>
                    <option value="Graduate">Graduate</option>
                    <option value="Post-Graduate">Post-Graduate</option>
                    <option value="Professional">Professional</option>
                  </select>
                </div>
              </motion.div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-4 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 px-6 py-3 border border-slate-300 text-slate-700 rounded-lg font-semibold hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white py-3 rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : step === 3 ? 'Create Account' : 'Next'}
              </button>
            </div>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-primary font-semibold hover:underline"
              >
                Sign in here
              </button>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

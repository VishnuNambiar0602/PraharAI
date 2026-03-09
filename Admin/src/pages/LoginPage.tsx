import { useState } from 'react';
import { Shield, Lock, AlertCircle } from 'lucide-react';
import { verifyAdminKey, saveAdminKey } from '../api';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [adminKey, setAdminKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const isValid = await verifyAdminKey(adminKey);
      if (isValid) {
        saveAdminKey(adminKey);
        onLogin();
      } else {
        setError('Invalid admin key. Please check and try again.');
      }
    } catch (err) {
      setError('Failed to verify admin key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-16 bg-primary rounded-2xl mb-4">
            <Shield className="size-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Prahar AI</h1>
          <p className="text-gray-600 mt-2">Government Admin Portal</p>
        </div>

        {/* Login Card */}
        <div className="card p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Admin Authentication</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="adminKey" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Key
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                <input
                  id="adminKey"
                  type="password"
                  value={adminKey}
                  onChange={(e) => setAdminKey(e.target.value)}
                  placeholder="Enter your admin key"
                  className="input pl-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg">
                <AlertCircle className="size-5 text-danger shrink-0 mt-0.5" />
                <p className="text-sm text-danger">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !adminKey}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Verifying...
                </>
              ) : (
                'Access Dashboard'
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This portal is restricted to authorized government personnel only.
              <br />
              Unauthorized access is prohibited and will be logged.
            </p>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Scheme {
  id: string;
  title: string;
  description: string;
  category: string;
  benefits?: string;
  eligibility?: string;
  deadline?: string;
  applicationProcess?: string;
  requiredDocuments?: string[];
}

export default function SchemeDetailPage() {
  const { schemeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scheme, setScheme] = useState<Scheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSchemeDetails();
  }, [schemeId]);

  const fetchSchemeDetails = async () => {
    try {
      const response = await fetch(`http://localhost:3000/api/schemes/${schemeId}`);
      if (!response.ok) throw new Error('Failed to fetch scheme details');
      
      const data = await response.json();
      setScheme(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-background-light flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Scheme not found'}</p>
          <button
            onClick={() => navigate('/schemes')}
            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Schemes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light">
      <header className="bg-white border-b border-primary/10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/schemes')}
            className="flex items-center gap-2 text-primary hover:underline"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Schemes
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-primary/5 p-8"
        >
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">{scheme.title}</h1>
              <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded">
                {scheme.category}
              </span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Description</h2>
              <p className="text-slate-600">{scheme.description}</p>
            </div>

            {scheme.benefits && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Benefits</h2>
                <div className="bg-primary/5 rounded-lg p-4 border-l-4 border-primary">
                  <p className="text-slate-700 font-semibold">{scheme.benefits}</p>
                </div>
              </div>
            )}

            {scheme.eligibility && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Eligibility Criteria</h2>
                <p className="text-slate-600">{scheme.eligibility}</p>
              </div>
            )}

            {scheme.deadline && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Deadline</h2>
                <p className="text-slate-600">{scheme.deadline}</p>
              </div>
            )}

            {scheme.applicationProcess && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Application Process</h2>
                <p className="text-slate-600">{scheme.applicationProcess}</p>
              </div>
            )}

            {scheme.requiredDocuments && scheme.requiredDocuments.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">Required Documents</h2>
                <ul className="space-y-2">
                  {scheme.requiredDocuments.map((doc, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-600">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-6 border-t border-slate-200">
              <button className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2">
                Apply Now
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>

            {!user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Want personalized recommendations?</strong> Create an account to see schemes tailored to your profile.
                </p>
                <button
                  onClick={() => navigate('/register')}
                  className="mt-3 px-4 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                >
                  Register Now
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}

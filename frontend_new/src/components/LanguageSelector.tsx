import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  // All 13 Google Cloud Translation API supported Indian languages + English
  const languages = [
    // Most commonly used (top section)
    { code: 'en', label: 'English', nativeName: 'English', popular: true },
    { code: 'hi', label: 'Hindi', nativeName: 'हिन्दी', popular: true },
    { code: 'bn', label: 'Bengali', nativeName: 'বাংলা', popular: true },
    { code: 'te', label: 'Telugu', nativeName: 'తెలుగు', popular: true },
    { code: 'mr', label: 'Marathi', nativeName: 'मराठी', popular: true },
    { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', popular: true },
    { code: 'gu', label: 'Gujarati', nativeName: 'ગુજરાતી', popular: true },
    { code: 'kn', label: 'Kannada', nativeName: 'ಕನ್ನಡ', popular: true },
    { code: 'ml', label: 'Malayalam', nativeName: 'മലയാളം', popular: true },
    { code: 'pa', label: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', popular: true },

    // Other supported languages (bottom section)
    { code: 'or', label: 'Odia', nativeName: 'ଓଡ଼ିଆ', popular: false },
    { code: 'as', label: 'Assamese', nativeName: 'অসমীয়া', popular: false },
    { code: 'ur', label: 'Urdu', nativeName: 'اردو', popular: false },
    { code: 'ne', label: 'Nepali', nativeName: 'नेपाली', popular: false },
  ];

  const popularLanguages = languages.filter((l) => l.popular);
  const otherLanguages = languages.filter((l) => !l.popular);

  const currentLanguage = languages.find((l) => l.code === i18n.language) || languages[0];

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-ink hover:bg-primary-50 transition-colors border border-border"
        title="Change language"
      >
        <Globe className="size-4" />
        <span className="hidden sm:inline">{currentLanguage.nativeName}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-64 bg-white border border-border rounded-lg shadow-xl z-50 overflow-hidden"
            >
              {/* Popular Languages */}
              <div className="p-2 max-h-96 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  Common Languages
                </div>
                <div className="space-y-0.5">
                  {popularLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        i18n.language === lang.code
                          ? 'bg-primary text-white font-semibold'
                          : 'text-ink hover:bg-primary-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{lang.nativeName}</span>
                        <span className="text-xs opacity-70">{lang.label}</span>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Divider */}
                <div className="my-2 border-t border-border" />

                {/* Other Languages */}
                <div className="px-3 py-1.5 text-xs font-semibold text-ink-muted uppercase tracking-wider">
                  More Languages
                </div>
                <div className="space-y-0.5">
                  {otherLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                        i18n.language === lang.code
                          ? 'bg-primary text-white font-semibold'
                          : 'text-ink hover:bg-primary-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{lang.nativeName}</span>
                        <span className="text-xs opacity-70">{lang.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="px-3 py-2 bg-gray-50 border-t border-border text-xs text-ink-muted text-center">
                {languages.length} languages supported
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

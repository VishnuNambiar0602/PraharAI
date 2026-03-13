/**
 * Automated Translation Script for PraharAI
 *
 * This script automatically translates locale files to all 22 Indian languages.
 *
 * Features:
 * - Detects missing translation keys
 * - Uses Google Translate API or free alternatives
 * - Preserves existing translations
 * - Validates JSON structure
 *
 * Usage:
 *   npm run translate              # Translate all missing keys
 *   npm run translate -- --force   # Re-translate all keys
 *   npm run translate -- --lang hi # Translate specific language
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

// Indian language codes (ISO 639-1 / 639-3) - ONLY Google Cloud Translation API supported
const INDIAN_LANGUAGES = {
  en: { name: 'English', nativeName: 'English' },
  hi: { name: 'Hindi', nativeName: 'हिन्दी' },
  bn: { name: 'Bengali', nativeName: 'বাংলা' },
  te: { name: 'Telugu', nativeName: 'తెలుగు' },
  mr: { name: 'Marathi', nativeName: 'मराठी' },
  ta: { name: 'Tamil', nativeName: 'தமிழ்' },
  ur: { name: 'Urdu', nativeName: 'اردو' },
  gu: { name: 'Gujarati', nativeName: 'ગુજરાતી' },
  kn: { name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
  ml: { name: 'Malayalam', nativeName: 'മലയാളം' },
  or: { name: 'Odia', nativeName: 'ଓଡ଼ିଆ' },
  pa: { name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  as: { name: 'Assamese', nativeName: 'অসমীয়া' },
  ne: { name: 'Nepali', nativeName: 'नेपाली' },
};

// Translation provider interface
interface TranslationProvider {
  translate(text: string, targetLang: string): Promise<string>;
  batchTranslate(texts: string[], targetLang: string): Promise<string[]>;
}

// Google Translate API Provider (requires @google-cloud/translate)
class GoogleTranslateProvider implements TranslationProvider {
  private apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  }

  async translate(text: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY not set in environment');
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: text,
        target: targetLang,
        source: 'en',
        format: 'text',
      }),
    });

    const data = await response.json();
    return data.data.translations[0].translatedText;
  }

  async batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
    if (!this.apiKey) {
      throw new Error('GOOGLE_TRANSLATE_API_KEY not set');
    }

    // Process in chunks of 128 (API limit)
    const chunkSize = 128;
    const results: string[] = [];

    for (let i = 0; i < texts.length; i += chunkSize) {
      const chunk = texts.slice(i, i + chunkSize);
      const url = `https://translation.googleapis.com/language/translate/v2?key=${this.apiKey}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: chunk,
          target: targetLang,
          source: 'en',
          format: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error(`API error for language ${targetLang}: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle missing translations property
      if (!data.data || !data.data.translations) {
        console.warn(`⚠️  Unexpected API response for ${targetLang}:`, data);
        throw new Error(`Invalid API response for language ${targetLang}`);
      }

      results.push(...data.data.translations.map((t: any) => t.translatedText));
    }

    return results;
  }
}

// LibreTranslate Provider (free, self-hosted or public instance)
class LibreTranslateProvider implements TranslationProvider {
  private apiUrl: string;
  private apiKey: string | undefined;

  constructor() {
    this.apiUrl = process.env.LIBRETRANSLATE_URL || 'https://libretranslate.com/translate';
    this.apiKey = process.env.LIBRETRANSLATE_API_KEY;
  }

  async translate(text: string, targetLang: string): Promise<string> {
    const body: any = {
      q: text,
      source: 'en',
      target: this.mapLanguageCode(targetLang),
      format: 'text',
    };

    if (this.apiKey) {
      body.api_key = this.apiKey;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return data.translatedText;
  }

  async batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
    // LibreTranslate doesn't support batch, translate sequentially with rate limiting
    const results: string[] = [];
    for (const text of texts) {
      results.push(await this.translate(text, targetLang));
      await new Promise((resolve) => setTimeout(resolve, 100)); // Rate limit
    }
    return results;
  }

  private mapLanguageCode(code: string): string {
    // LibreTranslate uses different codes for some languages
    const mapping: Record<string, string> = {
      brx: 'hi', // Bodo → Hindi (fallback)
      mai: 'hi', // Maithili → Hindi (fallback)
      sat: 'hi', // Santali → Hindi (fallback)
      kok: 'hi', // Konkani → Hindi (fallback)
      doi: 'hi', // Dogri → Hindi (fallback)
      mni: 'bn', // Manipuri → Bengali (fallback)
      sa: 'hi', // Sanskrit → Hindi (fallback)
    };
    return mapping[code] || code;
  }
}

// Mock Provider for testing (returns placeholder text)
class MockTranslateProvider implements TranslationProvider {
  async translate(text: string, targetLang: string): Promise<string> {
    return `[${targetLang.toUpperCase()}] ${text}`;
  }

  async batchTranslate(texts: string[], targetLang: string): Promise<string[]> {
    return texts.map((text) => `[${targetLang.toUpperCase()}] ${text}`);
  }
}

// Utility functions
function flattenObject(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};

  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = String(obj[key]);
    }
  }

  return result;
}

function unflattenObject(flat: Record<string, string>): any {
  const result: any = {};

  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }

    current[parts[parts.length - 1]] = value;
  }

  return result;
}

// Main translation function
async function translateLocaleFiles(options: {
  sourceLang?: string;
  targetLangs?: string[];
  force?: boolean;
  provider?: 'google' | 'libretranslate' | 'mock';
}) {
  const {
    sourceLang = 'en',
    targetLangs = Object.keys(INDIAN_LANGUAGES).filter((lang) => lang !== 'en'),
    force = false,
    provider = 'mock', // Default to mock for safety
  } = options;

  console.log('\n🌐 PraharAI Auto-Translation Tool\n');
  console.log(`Source language: ${sourceLang}`);
  console.log(`Target languages: ${targetLangs.join(', ')}`);
  console.log(`Provider: ${provider}`);
  console.log(`Force re-translate: ${force}\n`);

  // Initialize translation provider
  let translationProvider: TranslationProvider;
  switch (provider) {
    case 'google':
      translationProvider = new GoogleTranslateProvider();
      break;
    case 'libretranslate':
      translationProvider = new LibreTranslateProvider();
      break;
    case 'mock':
      translationProvider = new MockTranslateProvider();
      console.warn('⚠️  Using MOCK provider - translations will be placeholders');
      console.warn('   Set GOOGLE_TRANSLATE_API_KEY or use --provider libretranslate\n');
      break;
  }

  // Load source locale file
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const localesDir = path.resolve(__dirname, '..', 'src', 'locales');

  console.log(`📁 Locales directory: ${localesDir}\n`);

  const sourceFile = path.resolve(localesDir, `${sourceLang}.json`);

  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  const sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
  const sourceFlat = flattenObject(sourceData);
  const sourceKeys = Object.keys(sourceFlat);

  console.log(`📖 Loaded ${sourceKeys.length} keys from ${sourceLang}.json\n`);

  // Process each target language
  for (const targetLang of targetLangs) {
    console.log(
      `\n🔄 Processing ${INDIAN_LANGUAGES[targetLang as keyof typeof INDIAN_LANGUAGES].nativeName} (${targetLang})...`
    );

    const targetFile = path.resolve(localesDir, `${targetLang}.json`);
    let targetData: any = {};
    let targetFlat: Record<string, string> = {};

    // Load existing translations if file exists
    if (fs.existsSync(targetFile) && !force) {
      targetData = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
      targetFlat = flattenObject(targetData);
      console.log(`   Found ${Object.keys(targetFlat).length} existing translations`);
    }

    // Find missing keys
    const missingKeys = force ? sourceKeys : sourceKeys.filter((key) => !targetFlat[key]);

    if (missingKeys.length === 0) {
      console.log(`   ✅ All keys already translated`);
      continue;
    }

    console.log(`   🔍 Found ${missingKeys.length} missing keys`);
    console.log(`   🌐 Translating...`);

    // Translate missing keys
    const textsToTranslate = missingKeys.map((key) => sourceFlat[key]);
    const translations = await translationProvider.batchTranslate(textsToTranslate, targetLang);

    // Update target flat object
    missingKeys.forEach((key, index) => {
      targetFlat[key] = translations[index];
    });

    // Convert back to nested object and save
    const updatedData = unflattenObject(targetFlat);
    fs.writeFileSync(targetFile, JSON.stringify(updatedData, null, 2), 'utf-8');

    console.log(`   ✅ Saved ${Object.keys(targetFlat).length} total keys to ${targetLang}.json`);
  }

  console.log('\n✨ Translation complete!\n');
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: any = {
    force: args.includes('--force'),
    provider: 'mock', // Default to mock for safety
  };

  // Parse --lang argument
  const langIndex = args.indexOf('--lang');
  if (langIndex !== -1 && args[langIndex + 1]) {
    options.targetLangs = [args[langIndex + 1]];
  }

  // Parse --provider argument
  const providerIndex = args.indexOf('--provider');
  if (providerIndex !== -1 && args[providerIndex + 1]) {
    options.provider = args[providerIndex + 1];
  }

  try {
    await translateLocaleFiles(options);
  } catch (error) {
    console.error('\n❌ Translation failed:', error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export { translateLocaleFiles, INDIAN_LANGUAGES };

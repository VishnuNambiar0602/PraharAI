/**
 * Backend Translation Service for PraharAI
 *
 * Handles real-time translation of:
 * - API responses (schemes data)
 * - Chatbot messages
 * - Dynamic content
 *
 * Features:
 * - Redis caching to avoid repeated translations
 * - Batch translation support
 * - Automatic language detection
 * - Fallback to English on errors
 */

// Translation provider interface
interface TranslationProvider {
  translate(text: string, sourceLang: string, targetLang: string): Promise<string>;
  batchTranslate(texts: string[], sourceLang: string, targetLang: string): Promise<string[]>;
  detectLanguage(text: string): Promise<string>;
}

// Google Cloud Translation API implementation
class GoogleTranslationProvider implements TranslationProvider {
  private apiKey: string;
  private baseUrl = 'https://translation.googleapis.com/language/translate/v2';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GOOGLE_TRANSLATE_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️  Google Translate API key not configured. Translations will fail.');
    }
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
    if (!this.apiKey) {
      return text; // Return original if no API key
    }

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        }),
      });

      if (!response.ok) {
        throw new Error(`Translation API error: ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.data.translations[0].translatedText;
    } catch (error) {
      console.error('Translation error:', error);
      return text; // Fallback to original
    }
  }

  async batchTranslate(texts: string[], sourceLang: string, targetLang: string): Promise<string[]> {
    if (!this.apiKey || texts.length === 0) {
      return texts;
    }

    try {
      const url = `${this.baseUrl}?key=${this.apiKey}`;

      // Split into chunks of 128 (API limit)
      const chunkSize = 128;
      const results: string[] = [];

      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: chunk,
            source: sourceLang,
            target: targetLang,
            format: 'text',
          }),
        });

        if (!response.ok) {
          throw new Error(`Batch translation error: ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        results.push(...data.data.translations.map((t: any) => t.translatedText));
      }

      return results;
    } catch (error) {
      console.error('Batch translation error:', error);
      return texts; // Fallback to original
    }
  }

  async detectLanguage(text: string): Promise<string> {
    if (!this.apiKey) {
      return 'en';
    }

    try {
      const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${this.apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
      });

      if (!response.ok) {
        return 'en';
      }

      const data = (await response.json()) as any;
      return data.data.detections[0][0].language;
    } catch (error) {
      console.error('Language detection error:', error);
      return 'en';
    }
  }
}

// Translation service with caching
export class TranslationService {
  private provider: TranslationProvider;
  private cache: any; // Redis client
  private cacheEnabled: boolean;
  private cacheTTL: number = 86400 * 30; // 30 days

  constructor(provider?: TranslationProvider, redisClient?: any) {
    this.provider = provider || new GoogleTranslationProvider();
    this.cache = redisClient;
    this.cacheEnabled = !!redisClient;
  }

  /**
   * Generate cache key for translation
   */
  private getCacheKey(text: string, sourceLang: string, targetLang: string): string {
    // Create a hash of the text to keep keys short
    const textHash = this.simpleHash(text);
    return `translation:${sourceLang}:${targetLang}:${textHash}`;
  }

  /**
   * Simple hash function for cache keys
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Translate a single text string
   */
  async translate(text: string, targetLang: string, sourceLang: string = 'en'): Promise<string> {
    // Don't translate if source and target are the same
    if (sourceLang === targetLang) {
      return text;
    }

    // Check cache first
    if (this.cacheEnabled) {
      try {
        const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
        const cached = await this.cache.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (error) {
        console.error('Cache read error:', error);
      }
    }

    // Translate
    const translated = await this.provider.translate(text, sourceLang, targetLang);

    // Store in cache
    if (this.cacheEnabled && translated !== text) {
      try {
        const cacheKey = this.getCacheKey(text, sourceLang, targetLang);
        await this.cache.setEx(cacheKey, this.cacheTTL, translated);
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }

    return translated;
  }

  /**
   * Translate multiple texts in batch
   */
  async batchTranslate(
    texts: string[],
    targetLang: string,
    sourceLang: string = 'en'
  ): Promise<string[]> {
    if (sourceLang === targetLang) {
      return texts;
    }

    // Check cache for all texts
    const results: string[] = new Array(texts.length);
    const uncachedIndices: number[] = [];
    const uncachedTexts: string[] = [];

    if (this.cacheEnabled) {
      for (let i = 0; i < texts.length; i++) {
        try {
          const cacheKey = this.getCacheKey(texts[i], sourceLang, targetLang);
          const cached = await this.cache.get(cacheKey);
          if (cached) {
            results[i] = cached;
          } else {
            uncachedIndices.push(i);
            uncachedTexts.push(texts[i]);
          }
        } catch (error) {
          uncachedIndices.push(i);
          uncachedTexts.push(texts[i]);
        }
      }
    } else {
      uncachedIndices.push(...texts.map((_, i) => i));
      uncachedTexts.push(...texts);
    }

    // Translate uncached texts
    if (uncachedTexts.length > 0) {
      const translations = await this.provider.batchTranslate(
        uncachedTexts,
        sourceLang,
        targetLang
      );

      // Store in cache and results
      for (let i = 0; i < uncachedIndices.length; i++) {
        const originalIndex = uncachedIndices[i];
        const translated = translations[i];
        results[originalIndex] = translated;

        // Cache the translation
        if (this.cacheEnabled && translated !== uncachedTexts[i]) {
          try {
            const cacheKey = this.getCacheKey(uncachedTexts[i], sourceLang, targetLang);
            await this.cache.setEx(cacheKey, this.cacheTTL, translated);
          } catch (error) {
            console.error('Cache write error:', error);
          }
        }
      }
    }

    return results;
  }

  /**
   * Translate an object's string values recursively
   */
  async translateObject(obj: any, targetLang: string, sourceLang: string = 'en'): Promise<any> {
    if (typeof obj === 'string') {
      return this.translate(obj, targetLang, sourceLang);
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map((item) => this.translateObject(item, targetLang, sourceLang)));
    }

    if (typeof obj === 'object' && obj !== null) {
      const translated: any = {};
      for (const [key, value] of Object.entries(obj)) {
        translated[key] = await this.translateObject(value, targetLang, sourceLang);
      }
      return translated;
    }

    return obj; // Return non-string, non-object values as-is
  }

  /**
   * Middleware for Express to automatically translate API responses
   */
  translationMiddleware() {
    return (req: any, res: any, next: any) => {
      // Get target language from request (header, query param, or cookie)
      const targetLang =
        req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
        req.query.lang ||
        req.cookies?.language ||
        'en';

      // Store original json method
      const originalJson = res.json.bind(res);
      const self = this;

      // Override json method to translate before sending
      res.json = function (data: any) {
        // Handle translation asynchronously
        if (targetLang !== 'en' && data) {
          self
            .translateObject(data, targetLang)
            .then((translatedData) => {
              originalJson.call(this, translatedData);
            })
            .catch((error) => {
              console.error('Response translation error:', error);
              originalJson.call(this, data); // Send untranslated on error
            });
        } else {
          originalJson.call(this, data);
        }
        return this;
      };

      next();
    };
  }

  /**
   * Detect language of a text
   */
  async detectLanguage(text: string): Promise<string> {
    return this.provider.detectLanguage(text);
  }
}

// Singleton instance
let translationServiceInstance: TranslationService | null = null;

export function getTranslationService(redisClient?: any): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService(undefined, redisClient);
  }
  return translationServiceInstance;
}

export default TranslationService;

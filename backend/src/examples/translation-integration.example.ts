/**
 * Example: Backend Translation Integration
 *
 * This file demonstrates how to integrate the TranslationService
 * into your Express API routes for automatic multilingual support.
 */

import express from 'express';
import { getTranslationService } from '../services/translation.service';
// Note: Replace 'redisClient' with your actual Redis instance
// import { redisClient } from '../db/redis.service';

const router = express.Router();
// Replace with actual Redis client from your database service
const translationService = getTranslationService(undefined); // Pass your redisClient here

// Mock Redis client for demonstration (replace with actual redis.createClient())
const redisClient = {
  get: async (_key: string) => null,
  setEx: async (_key: string, _ttl: number, _value: string) => true,
};

const ts = translationService; // Shorter alias for convenience

// =============================================================================
// EXAMPLE 1: Auto-translate all API responses (Global Middleware)
// =============================================================================

// Add this to your main server.ts file:
// app.use(translationService.translationMiddleware());
//
// This will automatically translate ALL API responses based on:
// - Accept-Language header
// - ?lang=hi query parameter
// - language cookie

// Example requests:
// curl http://localhost:3000/api/schemes
// curl -H "Accept-Language: hi" http://localhost:3000/api/schemes
// curl http://localhost:3000/api/schemes?lang=ta

// =============================================================================
// EXAMPLE 2: Manual translation for specific endpoints
// =============================================================================

/**
 * Get scheme by ID with translation
 */
router.get('/schemes/:id', async (req, res) => {
  try {
    // Get target language from request
    const targetLang =
      (req.query.lang as string) ||
      req.headers['accept-language']?.split(',')[0]?.split('-')[0] ||
      'en';

    // Fetch scheme data (in English)
    const scheme = await fetchSchemeFromDatabase(req.params.id);

    if (!scheme) {
      return res.status(404).json({ error: 'Scheme not found' });
    }

    // Translate scheme if not English
    if (targetLang !== 'en') {
      const translatedScheme = await ts.translateObject(scheme, targetLang);
      return res.json(translatedScheme);
    }

    return res.json(scheme);
  } catch (error) {
    console.error('Error fetching scheme:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// EXAMPLE 3: Batch translation for list endpoints
// =============================================================================

/**
 * Search schemes with translation
 */
router.get('/schemes/search', async (req, res) => {
  try {
    const targetLang = (req.query.lang as string) || 'en';
    const searchQuery = (req.query.q as string) || '';

    // Fetch schemes (in English)
    const schemes = await searchSchemesInDatabase(searchQuery);

    // Batch translate all scheme titles and descriptions
    if (targetLang !== 'en' && schemes.length > 0) {
      const titles = schemes.map((s) => s.title);
      const descriptions = schemes.map((s) => s.description);

      // Translate in parallel
      const [translatedTitles, translatedDescriptions] = await Promise.all([
        translationService.batchTranslate(titles, targetLang),
        translationService.batchTranslate(descriptions, targetLang),
      ]);

      // Merge back
      schemes.forEach((scheme, i) => {
        scheme.title = translatedTitles[i];
        scheme.description = translatedDescriptions[i];
      });
    }

    return res.json(schemes);
  } catch (error) {
    console.error('Error searching schemes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// EXAMPLE 4: Chatbot with translation
// =============================================================================

/**
 * Chat endpoint with automatic translation
 */
router.post('/chat', async (req, res) => {
  try {
    const { message, language = 'en' } = req.body;
    // Note: userId is available in req.body if needed for logging/context

    // Translate user message to English (if needed)
    let englishMessage = message;
    if (language !== 'en') {
      englishMessage = await translationService.translate(message, 'en', language);
    }

    // Process message with bot (in English)
    const botResponse = await generateChatbotResponse(englishMessage);

    // Translate bot response back to user's language
    let translatedResponse = botResponse;
    if (language !== 'en') {
      translatedResponse = await translationService.translate(botResponse, language);
    }

    return res.json({
      message: translatedResponse,
      originalMessage: message,
      language: language,
    });
  } catch (error) {
    console.error('Error in chat:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
});

// =============================================================================
// EXAMPLE 5: Language detection for user input
// =============================================================================

/**
 * Detect language of user input
 */
router.post('/detect-language', async (req, res) => {
  try {
    const { text } = req.body;

    const detectedLanguage = await translationService.detectLanguage(text);

    return res.json({
      language: detectedLanguage,
      text: text,
    });
  } catch (error) {
    console.error('Error detecting language:', error);
    return res.status(500).json({ error: 'Failed to detect language' });
  }
});

// =============================================================================
// EXAMPLE 6: Selective translation (only specific fields)
// =============================================================================

/**
 * Get user profile with selective translation
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const targetLang = (req.query.lang as string) || 'en';
    const profile = await fetchUserProfile(req.params.userId);

    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Only translate user-facing text, not data fields
    if (targetLang !== 'en') {
      profile.bio = await translationService.translate(profile.bio, targetLang);
      profile.interests = await translationService.batchTranslate(profile.interests, targetLang);
      // Don't translate: name, email, phone, etc.
    }

    return res.json(profile);
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// EXAMPLE 7: Caching strategy for frequently accessed data
// =============================================================================

/**
 * Get popular schemes with aggressive caching
 */
router.get('/schemes/popular', async (req, res) => {
  try {
    const targetLang = (req.query.lang as string) || 'en';
    const cacheKey = `popular_schemes:${targetLang}`;

    // Check Redis cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    // Fetch from database
    const schemes = await getPopularSchemes();

    // Translate if needed
    const translatedSchemes =
      targetLang !== 'en' ? await translationService.translateObject(schemes, targetLang) : schemes;

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, JSON.stringify(translatedSchemes));

    return res.json(translatedSchemes);
  } catch (error) {
    console.error('Error fetching popular schemes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// Mock database functions (replace with your actual implementations)
// =============================================================================

async function fetchSchemeFromDatabase(id: string) {
  // Replace with actual database query
  return {
    id,
    title: 'Pradhan Mantri Awas Yojana',
    description: 'Housing for all by 2022',
    benefits: [
      'Free house for eligible citizens',
      'Subsidized interest rate',
      'Easy application process',
    ],
    eligibility: {
      income: 'Below ₹3,00,000 per annum',
      age: '18-70 years',
      citizenship: 'Indian citizen',
    },
  };
}

async function searchSchemesInDatabase(_query: string) {
  // Replace with actual search logic that uses _query parameter
  // Example: filter schemes based on keyword in title/description
  return [
    {
      id: '1',
      title: 'PM Kisan Yojana',
      description: 'Direct income support to farmers',
    },
    {
      id: '2',
      title: 'Ayushman Bharat',
      description: 'Healthcare coverage for economically vulnerable',
    },
  ];
}

async function generateChatbotResponse(message: string) {
  // Replace with actual chatbot logic
  return `I understand you're asking about: "${message}". How can I help you with government schemes?`;
}

async function fetchUserProfile(userId: string) {
  // Replace with actual profile fetch
  return {
    id: userId,
    name: 'Rajesh Kumar',
    email: 'rajesh@example.com',
    phone: '+91-9876543210',
    bio: 'Looking for agricultural and housing schemes',
    interests: ['Agriculture', 'Housing', 'Education'],
    preferredLanguage: 'hi',
  };
}

async function getPopularSchemes() {
  // Replace with actual query
  return [
    { id: '1', title: 'PM Kisan', views: 1000000 },
    { id: '2', title: 'Ayushman Bharat', views: 800000 },
    { id: '3', title: 'PM Awas Yojana', views: 600000 },
  ];
}

export default router;

import crypto from 'crypto';
import { neo4jService } from '../db/neo4j.service';
import { redisService } from '../db/redis.service';
import { getTranslationService } from './translation.service';
import { mlService } from './ml.service';
import { chatIntelligenceService, ChatTurn } from './chat-intelligence.service';
import { ProfileExtractor } from '../utils/profile-extractor';
import { initializeTools, reactAgent } from '../agents';
import config from '../config';

export type ChatMode = 'legacy' | 'react' | 'hybrid';

export interface ProcessChatInput {
  message: string;
  authorization?: string;
  conversationHistory?: ChatTurn[];
  preferredLanguage?: string;
  forceMode?: Exclude<ChatMode, 'hybrid'>;
}

export interface ProcessChatResult {
  statusCode: number;
  body: Record<string, any>;
}

interface RoutedIntent {
  primary: string;
  confidence: number;
}

const CHAT_INPUT_TOKEN_LIMIT = Number(process.env.CHAT_INPUT_TOKEN_LIMIT || 500);
const CHAT_RESPONSE_TIMEOUT_MS = Number(process.env.CHAT_RESPONSE_TIMEOUT_MS || 12000);

const ts = getTranslationService(redisService);

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4);
}

function detectLanguageHeuristic(text: string): string {
  if (!text) return 'en';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu';
  if (/[\u0B00-\u0B7F]/.test(text)) return 'or';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml';
  if (/[\u0600-\u06FF]/.test(text)) return 'ur';
  return 'en';
}

function isLikelyEnglish(text: string): boolean {
  if (!text) return true;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  const devanagari = (text.match(/[\u0900-\u097F]/g) || []).length;
  return latin > 20 && devanagari === 0;
}

function localizeSummary(lang: string, schemeCount: number): string {
  if (lang === 'hi') {
    return `मैंने आपकी रिक्वेस्ट के अनुसार योजनाएं खोज ली हैं। नीचे ${schemeCount} मिलती-जुलती योजनाएं दिख रही हैं।`;
  }
  return `I found ${schemeCount} matching schemes for your request.`;
}

function localizeActions(lang: string): string[] {
  if (lang === 'hi') {
    return ['मेरी पात्रता जांचें', 'और योजनाएं दिखाएं', 'आवेदन कैसे करें?'];
  }
  return ['Check my eligibility', 'Show matching schemes', 'How to apply?'];
}

function localizeUpdatePrefix(prefix: string, lang: string): string {
  if (lang !== 'hi') return prefix;
  return prefix
    .replace(/Updated your state to/gi, 'आपका राज्य अपडेट किया गया:')
    .replace(/Updated your employment status to/gi, 'रोज़गार स्थिति अपडेट की गई:')
    .replace(/Updated your education to/gi, 'शिक्षा अपडेट की गई:')
    .replace(/Updated your income to/gi, 'आय अपडेट की गई:')
    .replace(/Updated your age to/gi, 'आयु अपडेट की गई:');
}

function hashText(text: string): string {
  return crypto.createHash('sha1').update(text).digest('hex');
}

function fallbackActions(intent: string, lang: string): string[] {
  if (lang === 'hi') {
    return localizeActions(lang);
  }
  switch (intent) {
    case 'eligibility_check':
      return ['Check my eligibility', 'Show matching schemes', 'What documents are required?'];
    case 'application_info':
      return ['How do I apply?', 'Show official links', 'List required documents'];
    case 'scheme_search':
    default:
      return ['Show matching schemes', 'Personalize using my profile', 'Check eligibility'];
  }
}

function clarificationActions(intent: string, lang: string): string[] {
  if (lang === 'hi') {
    if (intent === 'eligibility_check') {
      return ['मेरा राज्य महाराष्ट्र है', 'मेरी उम्र 28 है', 'मैं किसान हूं'];
    }
    if (intent === 'recommendation') {
      return ['मैं कर्नाटक से हूं', 'मैं छात्र हूं', 'मुझे कृषि योजनाएं चाहिए'];
    }
    return ['मेरा राज्य बताएं', 'मेरी आय बताएं', 'मेरी नौकरी बताएं'];
  }

  if (intent === 'eligibility_check') {
    return ['My state is Maharashtra', 'I am 28 years old', 'I am a farmer'];
  }

  if (intent === 'recommendation') {
    return ['I am from Karnataka', 'I am a student', 'I want agriculture schemes'];
  }

  return ['My state is Delhi', 'My income is 200000', 'I am self-employed'];
}

function normalizeConfiguredMode(): ChatMode {
  const raw = String(config.chat.orchestrator || 'hybrid')
    .trim()
    .toLowerCase();
  if (raw === 'legacy' || raw === 'react' || raw === 'hybrid') {
    return raw;
  }
  return 'hybrid';
}

export function shouldUseReactForMessage(
  message: string,
  conversationHistory: ChatTurn[] = []
): boolean {
  const normalized = String(message || '')
    .trim()
    .toLowerCase();
  if (!normalized) return false;

  if (/^(hi|hello|hey|thanks|thank you|ok|okay)$/.test(normalized)) {
    return false;
  }

  if (
    /\b(recommend|best|suitable|eligible|eligibility|qualify|apply|application|document|deadline|scheme|schemes|benefit|benefits|profile)\b/.test(
      normalized
    )
  ) {
    return true;
  }

  return conversationHistory.length > 1 && normalized.split(/\s+/).length > 8;
}

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

class ChatOrchestrationService {
  async process(input: ProcessChatInput): Promise<ProcessChatResult> {
    const startedAt = Date.now();
    const traceId = crypto.randomUUID();
    const sanitizedMessage = String(input.message || '').trim();

    if (!sanitizedMessage) {
      return { statusCode: 400, body: { error: 'Message is required', traceId } };
    }

    if (estimateTokens(sanitizedMessage) > CHAT_INPUT_TOKEN_LIMIT) {
      return {
        statusCode: 400,
        body: {
          error: `Message exceeds token limit (${CHAT_INPUT_TOKEN_LIMIT}). Please shorten your query.`,
          traceId,
        },
      };
    }

    try {
      const detectedLang = ((await ts.detectLanguage(sanitizedMessage)) || 'en').toLowerCase();
      const heuristicLang = detectLanguageHeuristic(sanitizedMessage);
      const requestedLang =
        typeof input.preferredLanguage === 'string' ? input.preferredLanguage.toLowerCase() : '';
      const replyLanguage = requestedLang || (detectedLang === 'en' ? heuristicLang : detectedLang);
      const languageAwareMessage =
        replyLanguage === 'en'
          ? sanitizedMessage
          : `Reply strictly in language code "${replyLanguage}". Keep answer concise and practical. User message: ${sanitizedMessage}`;

      const token = input.authorization?.replace('Bearer ', '');
      const tokenUserId = token
        ? token.replace('mock_access_token_', '').replace('mock_refresh_token_', '')
        : null;
      const user = tokenUserId ? await neo4jService.getUserById(tokenUserId) : null;
      const effectiveUserId = user?.user_id || tokenUserId || 'guest';

      const extraction = ProfileExtractor.extract(sanitizedMessage);
      const updates = extraction.updates;
      const updateMessages = extraction.messages;

      const dbUpdates: Record<string, any> = {};
      const appliedUpdates: string[] = [];

      if (updates.age !== undefined) {
        dbUpdates['age'] = updates.age;
        appliedUpdates.push(updateMessages.find((m) => m.includes('age')) || '');
      }
      if (updates.income !== undefined) {
        dbUpdates['income'] = updates.income;
        appliedUpdates.push(updateMessages.find((m) => m.includes('income')) || '');
      }
      if (updates.state !== undefined) {
        dbUpdates['state'] = updates.state;
        appliedUpdates.push(updateMessages.find((m) => m.includes('state')) || '');
      }
      if (updates.employment !== undefined) {
        dbUpdates['employment'] = updates.employment;
        appliedUpdates.push(updateMessages.find((m) => m.includes('employment')) || '');
      }
      if (updates.education !== undefined) {
        dbUpdates['education'] = updates.education;
        appliedUpdates.push(updateMessages.find((m) => m.includes('education')) || '');
      }
      if (updates.disability !== undefined) {
        dbUpdates['is_disabled'] = updates.disability;
      }
      if (updates.minority !== undefined) {
        dbUpdates['is_minority'] = updates.minority;
      }

      const profileUpdated = Object.keys(dbUpdates).length > 0;
      if (profileUpdated && user) {
        try {
          await neo4jService.updateUserProfile(effectiveUserId, dbUpdates);
        } catch (error) {
          console.error('Profile update error', error);
        }
      }

      const freshUser = user ? (await neo4jService.getUserById(effectiveUserId)) || user : null;
      const userProfile = {
        userId: freshUser?.user_id || effectiveUserId,
        email: freshUser?.email || null,
        name: freshUser?.name || 'Guest User',
        age: freshUser?.age,
        income: freshUser?.income,
        state: freshUser?.state,
        employment: freshUser?.employment,
        education: freshUser?.education,
        gender: freshUser?.gender,
        interests: freshUser?.interests,
        social_category: freshUser?.social_category,
        is_disabled: freshUser?.is_disabled,
        is_minority: freshUser?.is_minority,
        marital_status: freshUser?.marital_status,
        family_size: freshUser?.family_size,
        rural_urban: freshUser?.rural_urban,
        occupation: freshUser?.occupation,
        poverty_status: freshUser?.poverty_status,
        ration_card: freshUser?.ration_card,
        land_ownership: freshUser?.land_ownership,
        district: freshUser?.district,
        disability_type: freshUser?.disability_type,
        minority_community: freshUser?.minority_community,
        ...dbUpdates,
      };

      const normalizedHistory: ChatTurn[] = Array.isArray(input.conversationHistory)
        ? input.conversationHistory
            .filter((entry: any) => entry && typeof entry.content === 'string')
            .map((entry: any) => ({
              role: entry.role === 'assistant' ? 'assistant' : 'user',
              content: String(entry.content).slice(0, 1200),
            }))
        : [];

      const historyProfile = ProfileExtractor.extractFromHistory(normalizedHistory);
      Object.assign(userProfile, historyProfile);

      const routedIntent = await this.classifyForRouting(sanitizedMessage, effectiveUserId);
      const clarification = this.getProfileClarification(
        routedIntent.primary,
        sanitizedMessage,
        userProfile
      );

      if (clarification) {
        let responseText = clarification;
        if (profileUpdated && appliedUpdates.length > 0) {
          const updatePrefix = localizeUpdatePrefix(
            appliedUpdates.filter(Boolean).join(' '),
            replyLanguage
          );
          responseText = `${updatePrefix}\n\n${responseText}`;
        }

        const latencyMs = Date.now() - startedAt;
        return {
          statusCode: 200,
          body: {
            response: responseText,
            suggestions: clarificationActions(routedIntent.primary, replyLanguage),
            degraded: false,
            trace: {
              traceId,
              latencyMs,
              modeUsed: 'clarification',
              replyLanguage,
              intent: routedIntent.primary,
            },
          },
        };
      }

      const configuredMode = input.forceMode || normalizeConfiguredMode();
      const modeUsed =
        configuredMode === 'hybrid'
          ? shouldUseReactForMessage(sanitizedMessage, normalizedHistory)
            ? 'react'
            : 'legacy'
          : configuredMode;

      if (modeUsed === 'react') {
        return this.processWithReact({
          traceId,
          message: sanitizedMessage,
          normalizedHistory,
          replyLanguage,
          effectiveUserId,
          intent: routedIntent.primary,
          profileUpdated,
          appliedUpdates,
          startedAt,
        });
      }

      return this.processWithLegacy({
        traceId,
        message: sanitizedMessage,
        languageAwareMessage,
        normalizedHistory,
        replyLanguage,
        effectiveUserId,
        userProfile,
        routedIntent,
        profileUpdated,
        appliedUpdates,
        startedAt,
        modeUsed,
      });
    } catch (error: any) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      return {
        statusCode,
        body: {
          error: statusCode === 500 ? 'Failed to process message' : error.message,
          details: statusCode === 500 ? error.message : undefined,
          traceId,
        },
      };
    }
  }

  private async processWithReact(input: {
    traceId: string;
    message: string;
    normalizedHistory: ChatTurn[];
    replyLanguage: string;
    effectiveUserId: string;
    intent: string;
    profileUpdated: boolean;
    appliedUpdates: string[];
    startedAt: number;
  }): Promise<ProcessChatResult> {
    initializeTools();

    const response = await reactAgent.process(
      input.message,
      input.effectiveUserId,
      input.normalizedHistory
    );

    let responseText = response.response;
    if (input.profileUpdated && input.appliedUpdates.length > 0) {
      const updatePrefix = localizeUpdatePrefix(
        input.appliedUpdates.filter(Boolean).join(' '),
        input.replyLanguage
      );
      responseText = `${updatePrefix}\n\n${responseText}`;
    }

    const latencyMs = Date.now() - input.startedAt;
    console.log(
      JSON.stringify({
        event: 'chat_turn',
        traceId: input.traceId,
        userId: input.effectiveUserId,
        modeUsed: 'react',
        latencyMs,
        toolsUsed: response.actionsUsed.map((action) => action.toolName),
        confidence: response.confidence,
        replyLanguage: input.replyLanguage,
      })
    );

    return {
      statusCode: 200,
      body: {
        response: responseText,
        suggestions: fallbackActions(input.intent, input.replyLanguage),
        degraded: false,
        toolsUsed: response.actionsUsed.map((action) => action.toolName),
        thinking: response.thinking.map((thought) => ({
          type: thought.type,
          content: thought.content,
        })),
        confidence: response.confidence,
        trace: {
          traceId: input.traceId,
          latencyMs,
          modeUsed: 'react',
          replyLanguage: input.replyLanguage,
        },
      },
    };
  }

  private async processWithLegacy(input: {
    traceId: string;
    message: string;
    languageAwareMessage: string;
    normalizedHistory: ChatTurn[];
    replyLanguage: string;
    effectiveUserId: string;
    userProfile: Record<string, any>;
    routedIntent: RoutedIntent;
    profileUpdated: boolean;
    appliedUpdates: string[];
    startedAt: number;
    modeUsed: string;
  }): Promise<ProcessChatResult> {
    const { modelHistory, summary } = await chatIntelligenceService.getContext(
      input.effectiveUserId,
      input.normalizedHistory
    );

    const intentCacheKey = `chat:intent:${hashText(input.message.toLowerCase())}`;
    const cachedIntent = await redisService.get<{ intent: string; confidence: number }>(
      intentCacheKey
    );
    const classified = cachedIntent || {
      intent: input.routedIntent.primary,
      confidence: input.routedIntent.confidence,
    };

    if (!cachedIntent && classified) {
      await redisService.set(intentCacheKey, classified, 120);
    }

    const intent = classified?.intent || 'scheme_search';
    const retrieval = await chatIntelligenceService.retrieveSchemes(
      input.message,
      input.userProfile,
      6
    );

    const mlRace = await Promise.race<
      | { type: 'ok'; payload: Awaited<ReturnType<typeof mlService.chat>> }
      | { type: 'timeout' }
      | { type: 'error'; message: string }
    >([
      mlService
        .chat(input.languageAwareMessage, input.userProfile, modelHistory)
        .then((payload) => ({ type: 'ok' as const, payload }))
        .catch((error: any) => ({
          type: 'error' as const,
          message: String(error?.message || 'ml_error'),
        })),
      new Promise((resolve) => {
        setTimeout(() => resolve({ type: 'timeout' as const }), CHAT_RESPONSE_TIMEOUT_MS);
      }),
    ]);

    const degraded = mlRace.type !== 'ok' || !mlRace.payload;
    const degradedReason =
      mlRace.type === 'timeout'
        ? 'ml_timeout'
        : mlRace.type === 'error'
          ? mlRace.message
          : degraded
            ? 'ml_unavailable'
            : null;

    const structured = chatIntelligenceService.buildStructuredPayload(
      mlRace.type === 'ok' && mlRace.payload?.response ? mlRace.payload.response : '',
      intent,
      retrieval.schemes,
      degraded
    );

    if (input.replyLanguage !== 'en' && isLikelyEnglish(structured.summary)) {
      structured.summary = localizeSummary(input.replyLanguage, structured.schemes.length);
      structured.next_actions = localizeActions(input.replyLanguage);
    }

    let responseText = structured.summary;
    if (input.profileUpdated && input.appliedUpdates.length > 0) {
      const updatePrefix = localizeUpdatePrefix(
        input.appliedUpdates.filter(Boolean).join(' '),
        input.replyLanguage
      );
      responseText = `${updatePrefix}\n\n${responseText}`;
    }

    const latencyMs = Date.now() - input.startedAt;
    console.log(
      JSON.stringify({
        event: 'chat_turn',
        traceId: input.traceId,
        userId: input.effectiveUserId,
        intent,
        intentConfidence: classified?.confidence || 0,
        latencyMs,
        retrievalCount: retrieval.schemes.length,
        retrievalCacheHit: retrieval.cacheHit,
        contextSummaryChars: summary.length,
        degraded,
        degradedReason,
        replyLanguage: input.replyLanguage,
        modeUsed: input.modeUsed,
      })
    );

    return {
      statusCode: 200,
      body: {
        response: responseText,
        suggestions:
          mlRace.type === 'ok' && mlRace.payload?.suggestions?.length
            ? mlRace.payload.suggestions
            : structured.next_actions,
        degraded,
        structured,
        schemes: structured.schemes,
        trace: {
          traceId: input.traceId,
          intent,
          latencyMs,
          retrievalCount: structured.schemes.length,
          degradedReason,
          replyLanguage: input.replyLanguage,
          modeUsed: input.modeUsed,
        },
      },
    };
  }

  private async classifyForRouting(message: string, userId: string): Promise<RoutedIntent> {
    const normalized = String(message || '').toLowerCase();

    if (normalized.includes('who am i') || normalized === 'my profile') {
      return { primary: 'profile_query', confidence: 0.9 };
    }

    if (normalized.includes('eligible') || normalized.includes('qualify')) {
      return { primary: 'eligibility_check', confidence: 0.8 };
    }

    if (
      normalized.includes('recommend') ||
      normalized.includes('suggest') ||
      normalized.includes('best')
    ) {
      return { primary: 'recommendation', confidence: 0.8 };
    }

    if (normalized.includes('apply') || normalized.includes('document')) {
      return { primary: 'application_info', confidence: 0.75 };
    }

    try {
      const classification = await mlService.classify(message, userId);
      if (classification?.primary_intent) {
        return {
          primary: classification.primary_intent,
          confidence: classification.confidence || 0.6,
        };
      }
    } catch (error) {
      console.error('Routing classification error', error);
    }

    return { primary: 'scheme_search', confidence: 0.6 };
  }

  private getProfileClarification(
    intent: string,
    message: string,
    userProfile: Record<string, any>
  ): string | null {
    const extractedFromMessage = ProfileExtractor.extract(message).updates;
    const effectiveProfile: Record<string, any> = { ...userProfile, ...extractedFromMessage };
    const hasState = Boolean(effectiveProfile.state);
    const hasQualificationSignal = Boolean(
      effectiveProfile.age ||
      effectiveProfile.income ||
      effectiveProfile.employment ||
      effectiveProfile.education ||
      effectiveProfile.gender ||
      effectiveProfile.interests ||
      effectiveProfile.social_category ||
      effectiveProfile.is_disabled ||
      effectiveProfile.is_minority
    );

    if (intent === 'recommendation') {
      if (!hasState && !hasQualificationSignal) {
        return 'I can personalize recommendations better if you share your state and one profile detail like occupation, income, age, or education.';
      }
      if (!hasState) {
        return 'To narrow down recommendations, please tell me your state.';
      }
      if (!hasQualificationSignal) {
        return 'To personalize the recommendations, please share one detail like your occupation, income, age, or education.';
      }
    }

    if (intent === 'eligibility_check') {
      if (!hasState && !hasQualificationSignal) {
        return 'To check eligibility reliably, please share your state and one or two profile details such as age, occupation, income, or education.';
      }
      if (!hasState) {
        return 'Please tell me your state so I can check eligibility against the right schemes.';
      }
      if (!hasQualificationSignal) {
        return 'Please share one or two details like your age, occupation, income, or education so I can check eligibility properly.';
      }
    }

    if (intent === 'profile_update' && Object.keys(extractedFromMessage).length === 0) {
      return 'Please tell me which profile field you want to update, such as age, state, income, employment, or education.';
    }

    return null;
  }
}

export const chatOrchestrationService = new ChatOrchestrationService();

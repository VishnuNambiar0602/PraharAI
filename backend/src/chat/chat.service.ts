/**
 * Chat Service - Integrates ReAct Agent with Similarity Agent and Profile Management
 * 
 * Provides intelligent conversational interface for:
 * - Scheme discovery and recommendations
 * - Profile viewing and updates
 * - Eligibility checking
 * - Natural language interaction
 */

import { SchemeInformationService } from '../services/scheme-information.service';
import { similarityAgent } from '../agents/similarity-agent';
import { findMatchingIntent, getResponseForIntent } from '../utils/training-data';
import { ReActAgent } from '../react-agent/react-agent';
import { ConversationContext, Tool, ToolResult } from '../react-agent/types';
import { mlService } from '../services/ml.service';
import { llmService } from '../services/llm.service';

interface ChatResponse {
  response: string;
  suggestions?: string[];
}

class ChatService {
  private agent: ReActAgent;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    // Initialize ReAct agent with tools
    this.agent = new ReActAgent([
      this.createSearchSchemesTool(),
      this.createGetSchemeDetailsTool(),
      this.createCheckEligibilityTool(),
      this.createGetProfileTool(),
      this.createUpdateProfileTool(),
    ]);
  }

  /**
   * Process a chat message
   */
  async processMessage(
    userId: string,
    message: string,
    userProfile: any,
    conversationHistory: any[] = []
  ): Promise<ChatResponse> {
    try {
      // Get or create conversation context
      let context = this.conversations.get(userId);
      if (!context) {
        context = {
          sessionId: `session_${userId}_${Date.now()}`,
          userId,
          userProfile,
          messageHistory: [],
          toolExecutionHistory: [],
        };
        this.conversations.set(userId, context);
      }

      // Update user profile in context
      context.userProfile = userProfile;

      // T-13: Extract entities from message and auto-update profile context
      const extractedEntities = this.extractEntities(message, userProfile);
      if (extractedEntities && Object.keys(extractedEntities).length > 0) {
        context.userProfile = { ...context.userProfile, ...extractedEntities };
        console.log('Extracted entities from message:', extractedEntities);
      }

      // Import and sync conversation history from frontend if provided
      if (conversationHistory && conversationHistory.length > 0) {
        console.log(`Syncing ${conversationHistory.length} messages from frontend for user ${userId}`);
        // Convert incoming history to Message objects if needed
        const incomingMessages = conversationHistory.map((msg: any, idx: number) => ({
          messageId: `sync_${idx}`,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(),
        }));
        
        // Replace message history with incoming history to maintain context
        context.messageHistory = incomingMessages;
      }

      // Check for profile queries and updates first (fast path)
      const quickResponse = await this.handleQuickResponses(message, userProfile);
      if (quickResponse) {
        return quickResponse;
      }

      // Use ReAct agent for complex queries, including conversation history
      const agentResponse = await this.agent.processQuery(message, context);

      return {
        response: agentResponse.content,
        suggestions: agentResponse.suggestions,
      };
    } catch (error: any) {
      console.error('Chat processing error:', error);
      return {
        response: "I'm having trouble processing that request. Could you try rephrasing?",
        suggestions: ['Show my profile', 'Find schemes for me', 'Check eligibility'],
      };
    }
  }

  /**
   * Handle quick responses — ONLY greetings, profile view, simple profile field queries.
   * All scheme queries, eligibility, application info go to the ReAct agent.
   */
  private async handleQuickResponses(
    message: string,
    userProfile: any
  ): Promise<ChatResponse | null> {
    const lowerMessage = message.toLowerCase().trim();

    // Greetings only (strict match)
    if (/^(hello|hi|hey|good morning|good afternoon|good evening|namaste|namaskar)[!.,?]*$/i.test(lowerMessage)) {
      return {
        response: `Hello! 👋 I'm your personalized scheme recommendation assistant. I can help you:\n\n` +
          `• Find government schemes you're eligible for\n` +
          `• Check eligibility for specific schemes\n` +
          `• Get application details for any scheme\n` +
          `• View and update your profile\n\n` +
          `What would you like to know?`,
        suggestions: ['Show my profile', 'Find schemes for me', 'What schemes am I eligible for?'],
      };
    }

    // Profile viewing
    if (
      lowerMessage.includes('my profile') ||
      lowerMessage.includes('my details') ||
      lowerMessage.includes('my information') ||
      lowerMessage.includes('about me')
    ) {
      return this.formatProfileResponse(userProfile);
    }

    // Simple profile field queries
    if (lowerMessage === 'my name' || lowerMessage.startsWith('what is my name')) {
      return {
        response: `Your name is ${userProfile.name || 'not set'}.`,
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }
    if (lowerMessage === 'my age' || lowerMessage.startsWith('what is my age')) {
      return {
        response: userProfile.age ? `You are ${userProfile.age} years old.` : "Your age is not set. Tell me your age by saying 'my age is 25'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }
    if (lowerMessage === 'my income' || lowerMessage.startsWith('what is my income')) {
      return {
        response: userProfile.income ? `Your annual income is ₹${userProfile.income.toLocaleString()}.` : "Your income is not set. Tell me by saying 'my income is 500000'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }
    if (lowerMessage === 'my state' || lowerMessage.startsWith('what is my state') || lowerMessage.startsWith('where am i from')) {
      return {
        response: userProfile.state ? `You are from ${userProfile.state}.` : "Your state is not set. Tell me by saying 'I live in Maharashtra'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }

    // Everything else → ReAct agent
    return null;
  }

  /**
   * Handle scheme-related queries — uses real database via SimilarityAgent
   */
  private async handleSchemeQuery(
    userProfile: any,
    message: string
  ): Promise<ChatResponse> {
    try {
      const lowerMessage = message.toLowerCase();

      // First check if asking about a specific well-known scheme
      const schemeInfo = SchemeInformationService.getSchemeInfo(message);
      if (schemeInfo) {
        return {
          response: schemeInfo.info,
          suggestions: schemeInfo.suggestions,
        };
      }

      // Check if asking for eligibility
      if (lowerMessage.includes('eligible') || lowerMessage.includes('qualify')) {
        const schemeMatch = message.match(/(for|to)\s+(.+?)(?:\?|$)/i);
        if (schemeMatch) {
          const schemeName = schemeMatch[2];
          return {
            response: SchemeInformationService.checkEligibility(userProfile, schemeName),
            suggestions: ['How to apply', 'Find more schemes', 'Check another scheme'],
          };
        }
      }

      // Extract meaningful keywords from the message for search
      const stopWords = new Set(['find', 'me', 'show', 'get', 'list', 'what', 'are', 'the', 'for', 'my', 'i', 'a', 'an', 'to', 'in', 'of', 'and', 'is', 'can', 'please', 'some', 'any', 'all', 'scheme', 'schemes', 'government']);
      const keywords = lowerMessage.split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
      const searchQuery = keywords.join(' ');

      // Use real database via SimilarityAgent
      let schemes: any[] = [];
      if (searchQuery.length > 0) {
        schemes = await similarityAgent.searchSchemes(searchQuery, 6);
      }

      // If text search found nothing, try profile-based matching
      if (schemes.length === 0) {
        const profileForMatching = {
          userId: userProfile.userId || 'chat-user',
          employment: userProfile.employment,
          income: userProfile.income ? this.mapIncomeToCategory(userProfile.income) : undefined,
          locality: userProfile.locality || 'Urban',
          socialCategory: userProfile.socialCategory,
          education: userProfile.education,
          povertyLine: userProfile.income ? this.mapIncomeToPovertyLine(userProfile.income) : undefined,
          state: userProfile.state,
          age: userProfile.age,
          interests: keywords.length > 0 ? keywords : ['general'],
        };
        const matches = await similarityAgent.findMatchingSchemes(profileForMatching, 6);
        schemes = matches.map(m => ({
          schemeId: m.schemeId,
          name: m.name,
          description: m.description,
          ministry: m.ministry,
          tags: m.tags,
          eligibilityScore: m.eligibilityScore,
        }));
      }

      if (schemes.length === 0) {
        return {
          response: "I couldn't find any matching schemes right now. Try refining your query or browse the Schemes page.",
          suggestions: ['Browse Schemes', 'Show my profile', 'Find agriculture schemes'],
        };
      }

      // Format the results
      let response = `📚 **Matching Government Schemes** (from ${schemes.length.toLocaleString()} results)\n\n`;
      for (const s of schemes) {
        const name = s.name || s.title || 'Unknown';
        const desc = (s.description || '').substring(0, 120);
        const score = s.eligibilityScore ? ` (Score: ${s.eligibilityScore}%)` : '';
        response += `• **${name}**${score}\n  ${desc}${desc.length >= 120 ? '...' : ''}\n\n`;
      }
      response += `💡 Based on your profile (${userProfile.employment || 'Any'} employment, Age: ${userProfile.age || 'Not specified'}), ask me "am I eligible for [scheme name]?" to check your eligibility!`;

      return {
        response,
        suggestions: ['Tell me more about a scheme', 'Check my eligibility', 'Show my profile'],
      };
    } catch (error: any) {
      console.error('Scheme query error:', error);
      return {
        response:
          "I'm having trouble fetching scheme information. Please try asking about a specific scheme or check the Schemes page.",
        suggestions: ['Browse Schemes', 'Show my profile', 'Try again'],
      };
    }
  }

  /**
   * Format profile response
   */
  private formatProfileResponse(profile: any): ChatResponse {
    const completeness = this.calculateCompleteness(profile);
    
    let response = `📋 Your Profile (${completeness}% complete):\n\n`;
    response += `👤 Name: ${profile.name || 'Not set'}\n`;
    response += `📧 Email: ${profile.email || 'Not set'}\n`;
    response += `🎂 Age: ${profile.age || 'Not set'}\n`;
    response += `💰 Income: ${profile.income ? '₹' + profile.income : 'Not set'}\n`;
    response += `📍 State: ${profile.state || 'Not set'}\n`;
    response += `🏢 Employment: ${profile.employment || 'Not set'}\n`;
    response += `🎓 Education: ${profile.education || 'Not set'}\n\n`;

    if (completeness < 100) {
      response += `💡 Complete your profile to get better recommendations! You can say:\n`;
      response += `• "My age is 25"\n`;
      response += `• "I live in Maharashtra"\n`;
      response += `• "I am unemployed"\n`;
      response += `• "My income is 300000"`;
    } else {
      response += `✅ Your profile is complete! Check the Dashboard for personalized recommendations.`;
    }

    return {
      response,
      suggestions: ['Find schemes for me', 'Update my details', 'Check eligibility'],
    };
  }

  /**
   * Calculate profile completeness
   */
  private calculateCompleteness(profile: any): number {
    const fields = ['name', 'email', 'age', 'income', 'state', 'employment', 'education'];
    const filledFields = fields.filter(
      (field) => profile[field] != null && profile[field] !== ''
    );
    return Math.round((filledFields.length / fields.length) * 100);
  }

  /**
   * T-13: Extract entities from user message and return profile fields to update
   */
  private extractEntities(message: string, currentProfile: any): Record<string, any> {
    const entities: Record<string, any> = {};
    const lower = message.toLowerCase();

    // Age: "my age is 25", "I am 25 years old", "I'm 25"
    const ageMatch = message.match(/(?:my age is|i am|i'm|age[:\s]+)\s*(\d{1,3})\s*(?:years?(?:\s+old)?)?/i);
    if (ageMatch) {
      const age = parseInt(ageMatch[1]);
      if (age >= 5 && age <= 120 && age !== currentProfile.age) entities.age = age;
    }

    // Income: "my income is 500000", "earning 5 lakhs", "income: 3.5 lakh"
    const incomeMatch = message.match(/(?:my income is|earning|income[:\s]+)\s*([\d.,]+)\s*(lakh|lakhs|k|cr)?/i);
    if (incomeMatch) {
      let income = parseFloat(incomeMatch[1].replace(/,/g, ''));
      const unit = (incomeMatch[2] || '').toLowerCase();
      if (unit === 'lakh' || unit === 'lakhs') income *= 100000;
      else if (unit === 'k') income *= 1000;
      else if (unit === 'cr') income *= 10000000;
      if (income > 0 && income !== currentProfile.income) entities.income = Math.round(income);
    }

    // State: "I live in Maharashtra", "from Rajasthan", "I'm in Delhi"
    const statePatterns = [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
      'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
      'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
      'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
      'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
      'Delhi', 'Jammu', 'Kashmir', 'Puducherry', 'Chandigarh', 'UP', 'MP',
    ];
    for (const stateName of statePatterns) {
      if (lower.includes(stateName.toLowerCase()) && stateName !== currentProfile.state) {
        entities.state = stateName;
        break;
      }
    }

    // Employment: "I am a farmer", "I work as a teacher", "I'm unemployed", "I'm a student"
    const employmentMap: Record<string, string> = {
      'farmer': 'Farmer', 'agriculture': 'Farmer',
      'salaried': 'Salaried', 'job': 'Salaried', 'employee': 'Salaried', 'office': 'Salaried',
      'self-employed': 'Self-Employed', 'business': 'Self-Employed', 'entrepreneur': 'Self-Employed',
      'unemployed': 'Unemployed', 'no job': 'Unemployed', 'jobless': 'Unemployed',
      'student': 'Student', 'studying': 'Student',
      'retired': 'Retired',
    };
    for (const [keyword, value] of Object.entries(employmentMap)) {
      if (lower.includes(keyword) && value !== currentProfile.employment) {
        entities.employment = value;
        break;
      }
    }

    return entities;
  }

  /**
   * Create get scheme details tool — T-07
   */
  private createGetSchemeDetailsTool(): Tool {
    return {
      name: 'get_scheme_details',
      description: 'Get detailed information about a specific government scheme by name or ID',
      parameters: {
        query: { type: 'string', required: true },
      },
      requiresAuth: false,
      execute: async (params: any, _context: ConversationContext): Promise<ToolResult> => {
        try {
          const results = await similarityAgent.searchSchemes(params.query, 3);
          if (!results || results.length === 0) {
            return {
              success: false,
              error: { code: 'NOT_FOUND', message: `No scheme found matching "${params.query}"` },
              metadata: { executionTime: 0, cacheHit: false, toolVersion: '1.0' },
            };
          }
          const scheme = results[0];
          const appUrl = (scheme as any).schemeUrl || `https://www.myscheme.gov.in/schemes/${scheme.schemeId}`;
          return {
            success: true,
            data: {
              id: scheme.schemeId,
              name: scheme.name,
              description: scheme.description,
              ministry: scheme.ministry,
              tags: scheme.tags,
              applicationUrl: appUrl,
              otherMatches: results.slice(1).map((s: any) => s.name),
            },
            metadata: { executionTime: 0, cacheHit: false, toolVersion: '1.0' },
          };
        } catch (error: any) {
          return {
            success: false,
            error: { code: 'LOOKUP_ERROR', message: error.message },
            metadata: { executionTime: 0, cacheHit: false, toolVersion: '1.0' },
          };
        }
      },
    };
  }

  /**
   * Create search schemes tool
   */
  private createSearchSchemesTool(): Tool {
    return {
      name: 'search_schemes',
      description: 'Search for government schemes based on user profile and query',
      parameters: {
        query: { type: 'string', required: false },
        limit: { type: 'number', required: false, default: 5 },
      },
      requiresAuth: true,
      execute: async (params: any, context: ConversationContext): Promise<ToolResult> => {
        try {
          const userProfile = context.userProfile || {};
          const limit = params.limit || 5;

          // Build user profile for similarity matching
          const profileForMatching = {
            userId: context.userId!,
            employment: userProfile.employment,
            income: this.mapIncomeToCategory(userProfile.income),
            locality: userProfile.locality || 'urban',
            socialCategory: userProfile.socialCategory || 'general',
            education: userProfile.education,
            povertyLine: this.mapIncomeToPovertyLine(userProfile.income),
            state: userProfile.state,
            age: userProfile.age,
            interests: params.query ? [params.query] : [],
          };

          // Find matching schemes
          const matches = await similarityAgent.findMatchingSchemes(
            profileForMatching,
            limit
          );

          return {
            success: true,
            data: matches,
            metadata: {
              executionTime: 0,
              cacheHit: false,
              toolVersion: '1.0',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: 'SEARCH_ERROR',
              message: error.message,
            },
            metadata: {
              executionTime: 0,
              cacheHit: false,
              toolVersion: '1.0',
            },
          };
        }
      },
    };
  }

  /**
   * Create check eligibility tool — T-11: calls ML service for detailed scoring
   */
  private createCheckEligibilityTool(): Tool {
    return {
      name: 'check_eligibility',
      description: 'Check user eligibility for schemes with detailed ML scoring',
      parameters: {
        schemeId: { type: 'string', required: false },
        query: { type: 'string', required: false },
      },
      requiresAuth: true,
      execute: async (params: any, context: ConversationContext): Promise<ToolResult> => {
        try {
          const userProfile = context.userProfile || {};
          const profileForMatching = {
            userId: context.userId!,
            employment: userProfile.employment,
            income: this.mapIncomeToCategory(userProfile.income),
            locality: userProfile.locality || 'urban',
            socialCategory: userProfile.socialCategory || 'general',
            education: userProfile.education,
            povertyLine: this.mapIncomeToPovertyLine(userProfile.income),
            state: userProfile.state,
            age: userProfile.age,
            interests: params.query ? [params.query] : [],
          };

          const matches = await similarityAgent.findMatchingSchemes(profileForMatching, 10);
          const candidateSchemes = matches.filter((m: any) => m.eligibilityScore >= 50);

          // T-11: Call ML eligibility engine for each candidate
          const mlScores: Map<string, number> = new Map();
          try {
            const mlAvailable = await mlService.isAvailable();
            if (mlAvailable && candidateSchemes.length > 0) {
              const mlResults = await Promise.all(
                candidateSchemes.slice(0, 5).map(async (s: any) => {
                  const result = await mlService.eligibility(userProfile, {
                    id: s.schemeId, name: s.name, description: s.description,
                    tags: s.tags, state: s.state,
                  });
                  return { id: s.schemeId, score: result?.percentage ?? s.eligibilityScore };
                })
              );
              mlResults.forEach(r => mlScores.set(r.id, r.score));
            }
          } catch { /* ML is optional */ }

          // Merge ML scores
          const enriched = candidateSchemes.map((s: any) => ({
            ...s,
            eligibilityScore: mlScores.get(s.schemeId) ?? s.eligibilityScore,
          })).sort((a: any, b: any) => b.eligibilityScore - a.eligibilityScore);

          return {
            success: true,
            data: {
              eligibleSchemes: enriched,
              totalChecked: matches.length,
              mlEnhanced: mlScores.size > 0,
            },
            metadata: { executionTime: 0, cacheHit: false, toolVersion: '2.0' },
          };
        } catch (error: any) {
          return {
            success: false,
            error: { code: 'ELIGIBILITY_ERROR', message: error.message },
            metadata: { executionTime: 0, cacheHit: false, toolVersion: '2.0' },
          };
        }
      },
    };
  }

  /**
   * Create get profile tool
   */
  private createGetProfileTool(): Tool {
    return {
      name: 'get_profile',
      description: 'Get user profile information',
      parameters: {},
      requiresAuth: true,
      execute: async (_params: any, context: ConversationContext): Promise<ToolResult> => {
        return {
          success: true,
          data: context.userProfile,
          metadata: {
            executionTime: 0,
            cacheHit: true,
            toolVersion: '1.0',
          },
        };
      },
    };
  }

  /**
   * Create update profile tool
   */
  private createUpdateProfileTool(): Tool {
    return {
      name: 'update_profile',
      description: 'Update user profile fields',
      parameters: {
        field: { type: 'string', required: true },
        value: { type: 'any', required: true },
      },
      requiresAuth: true,
      execute: async (params: any, context: ConversationContext): Promise<ToolResult> => {
        try {
          // Update profile in context (actual DB update would happen in the endpoint)
          if (context.userProfile) {
            context.userProfile[params.field] = params.value;
          }

          return {
            success: true,
            data: {
              field: params.field,
              value: params.value,
              message: `Updated ${params.field} successfully`,
            },
            metadata: {
              executionTime: 0,
              cacheHit: false,
              toolVersion: '1.0',
            },
          };
        } catch (error: any) {
          return {
            success: false,
            error: {
              code: 'UPDATE_ERROR',
              message: error.message,
            },
            metadata: {
              executionTime: 0,
              cacheHit: false,
              toolVersion: '1.0',
            },
          };
        }
      },
    };
  }

  /**
   * Map income to category
   */
  private mapIncomeToCategory(income?: number): string {
    if (!income) return 'Any';
    if (income < 100000) return 'Below 1 Lakh';
    if (income < 300000) return '1-3 Lakh';
    if (income < 500000) return '3-5 Lakh';
    if (income < 1000000) return '5-10 Lakh';
    return 'Above 10 Lakh';
  }

  /**
   * Map income to poverty line
   */
  private mapIncomeToPovertyLine(income?: number): string {
    if (!income) return 'Any';
    return income < 100000 ? 'BPL' : 'APL';
  }

  /**
   * Clear conversation history for a user
   */
  clearConversation(userId: string): void {
    this.conversations.delete(userId);
  }
}

export const chatService = new ChatService();

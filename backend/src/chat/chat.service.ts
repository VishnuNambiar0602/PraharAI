/**
 * Chat Service - Integrates ReAct Agent with Similarity Agent and Profile Management
 * 
 * Provides intelligent conversational interface for:
 * - Scheme discovery and recommendations
 * - Profile viewing and updates
 * - Eligibility checking
 * - Natural language interaction
 */

import { similarityAgent } from '../agents/similarity-agent';
import { ReActAgent } from '../react-agent/react-agent';
import { ConversationContext, Tool, ToolResult } from '../react-agent/types';

interface ChatMessage {
  role: 'user' | 'agent';
  content: string;
  timestamp: Date;
}

interface ChatResponse {
  response: string;
  suggestions?: string[];
}

interface UserContext {
  userId: string;
  profile: any;
}

class ChatService {
  private agent: ReActAgent;
  private conversations: Map<string, ConversationContext> = new Map();

  constructor() {
    // Initialize ReAct agent with tools
    this.agent = new ReActAgent([
      this.createSearchSchemesTool(),
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
    userProfile: any
  ): Promise<ChatResponse> {
    try {
      // Get or create conversation context
      let context = this.conversations.get(userId);
      if (!context) {
        context = {
          userId,
          userProfile,
          messageHistory: [],
          toolExecutionHistory: [],
        };
        this.conversations.set(userId, context);
      }

      // Update user profile in context
      context.userProfile = userProfile;

      // Check for profile queries and updates first (fast path)
      const quickResponse = await this.handleQuickResponses(message, userProfile);
      if (quickResponse) {
        return quickResponse;
      }

      // Use ReAct agent for complex queries
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
   * Handle quick responses for common queries
   */
  private async handleQuickResponses(
    message: string,
    userProfile: any
  ): Promise<ChatResponse | null> {
    const lowerMessage = message.toLowerCase();

    // Profile viewing
    if (
      lowerMessage.includes('my profile') ||
      lowerMessage.includes('my details') ||
      lowerMessage.includes('my information') ||
      lowerMessage.includes('about me')
    ) {
      return this.formatProfileResponse(userProfile);
    }

    // Greetings
    if (
      lowerMessage.match(/^(hello|hi|hey|good morning|good afternoon|good evening)$/i)
    ) {
      return {
        response: `Hello! 👋 I'm your personalized scheme recommendation assistant. I can help you:\n\n` +
          `• Find government schemes you're eligible for\n` +
          `• View and update your profile\n` +
          `• Answer questions about schemes\n` +
          `• Check eligibility criteria\n\n` +
          `What would you like to know?`,
        suggestions: ['Show my profile', 'Find schemes for me', 'What schemes am I eligible for?'],
      };
    }

    // Profile field queries
    if (lowerMessage.includes('my name')) {
      return {
        response: `Your name is ${userProfile.name || 'not set'}.`,
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }

    if (lowerMessage.includes('my age')) {
      return {
        response: userProfile.age
          ? `You are ${userProfile.age} years old.`
          : "Your age is not set. Tell me your age by saying 'my age is 25'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }

    if (lowerMessage.includes('my income')) {
      return {
        response: userProfile.income
          ? `Your annual income is ₹${userProfile.income}.`
          : "Your income is not set. Tell me by saying 'my income is 500000'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }

    if (lowerMessage.includes('my state')) {
      return {
        response: userProfile.state
          ? `You are from ${userProfile.state}.`
          : "Your state is not set. Tell me by saying 'I live in Maharashtra'",
        suggestions: ['Show full profile', 'Find schemes for me'],
      };
    }

    // Scheme queries - use similarity agent
    if (
      lowerMessage.includes('scheme') ||
      lowerMessage.includes('eligible') ||
      lowerMessage.includes('recommend') ||
      lowerMessage.includes('find')
    ) {
      return await this.handleSchemeQuery(userProfile, message);
    }

    return null;
  }

  /**
   * Handle scheme-related queries
   */
  private async handleSchemeQuery(
    userProfile: any,
    message: string
  ): Promise<ChatResponse> {
    try {
      // Build profile for matching
      const profileForMatching = {
        userId: userProfile.userId || 'unknown',
        employment: userProfile.employment,
        income: this.mapIncomeToCategory(userProfile.income),
        locality: userProfile.locality || 'urban',
        socialCategory: userProfile.socialCategory || 'general',
        education: userProfile.education,
        povertyLine: this.mapIncomeToPovertyLine(userProfile.income),
        state: userProfile.state,
        age: userProfile.age,
        interests: [message],
      };

      try {
        // Try using similarity agent (Neo4j)
        const matches = await similarityAgent.findMatchingSchemes(profileForMatching, 5);

        if (matches.length === 0) {
          return {
            response:
              "I couldn't find any schemes matching your profile right now. This could be because:\n\n" +
              "• Your profile is incomplete\n• The scheme database is being updated\n\n" +
              "Try completing your profile by telling me:\n" +
              "• Your age\n• Your income\n• Your state\n• Your employment status",
            suggestions: ['Show my profile', 'Update my details'],
          };
        }

        // Format response with top schemes
        let response = `Based on your profile, here are the top schemes for you:\n\n`;

        matches.slice(0, 3).forEach((match, index) => {
          response += `${index + 1}. ${match.name}\n`;
          response += `   Eligibility: ${match.eligibilityScore}%\n`;
          response += `   ${match.description.substring(0, 100)}...\n\n`;
        });

        response += `\nCheck the Dashboard to see all ${matches.length} recommended schemes and apply!`;

        return {
          response,
          suggestions: [
            'Tell me more about scheme 1',
            'How do I apply?',
            'Show more schemes',
          ],
        };
      } catch (dbError) {
        // Fallback to direct API
        console.log('Neo4j not available, using direct API for schemes');
        
        const { indiaGovService } = await import('../schemes/india-gov.service');
        
        // Fetch schemes from API
        const result = await indiaGovService.fetchSchemes({
          pageNumber: 1,
          pageSize: 5,
        });

        if (result.schemes.length === 0) {
          return {
            response:
              "I couldn't fetch schemes right now. The API might be temporarily unavailable. Please try again in a moment.",
            suggestions: ['Show my profile', 'Try again'],
          };
        }

        // Format response with schemes
        let response = `Here are some government schemes that might interest you:\n\n`;

        result.schemes.slice(0, 3).forEach((scheme, index) => {
          response += `${index + 1}. ${scheme.name}\n`;
          response += `   ${scheme.description.substring(0, 100)}...\n\n`;
        });

        response += `\nCheck the Dashboard to explore more schemes!`;

        return {
          response,
          suggestions: [
            'Tell me more',
            'Show my profile',
            'Update my details',
          ],
        };
      }
    } catch (error: any) {
      console.error('Scheme query error:', error);
      return {
        response:
          "I'm having trouble fetching schemes right now. Please try again in a moment.",
        suggestions: ['Show my profile', 'Try again'],
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
   * Create check eligibility tool
   */
  private createCheckEligibilityTool(): Tool {
    return {
      name: 'check_eligibility',
      description: 'Check user eligibility for schemes',
      parameters: {
        schemeId: { type: 'string', required: false },
      },
      requiresAuth: true,
      execute: async (params: any, context: ConversationContext): Promise<ToolResult> => {
        try {
          const userProfile = context.userProfile || {};
          
          // Build profile for matching
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
          };

          // Get top eligible schemes
          const matches = await similarityAgent.findMatchingSchemes(
            profileForMatching,
            10
          );

          return {
            success: true,
            data: {
              eligibleSchemes: matches.filter((m) => m.eligibilityScore >= 60),
              totalChecked: matches.length,
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
              code: 'ELIGIBILITY_ERROR',
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

/**
 * ReAct Agent
 *
 * Reasoning + Acting agent that can:
 * 1. Understand user intent
 * 2. Generate a multi-step plan
 * 3. Execute tools with context management
 * 4. Interpret tool results across steps
 * 5. Generate natural responses
 *
 * Features:
 * - Planning step before execution
 * - Context management across tool calls
 * - Graceful error recovery (skip failed steps)
 * - Multi-intent support
 */

import {
  toolRegistry,
  ChatMessage,
  AgentThought,
  AgentAction,
  AgentObservation,
  AgentResponse,
} from './tools';
import { mlService } from '../services/ml.service';

const MAX_ITERATIONS = 5;

/** Planned step that the agent intends to execute */
interface PlanStep {
  toolName: string;
  parameters: Record<string, any>;
  reasoning: string;
  dependsOn?: number; // index of step this depends on
}

/** Accumulated context from tool executions */
interface AgentContext {
  schemes: any[];
  eligibility: any[];
  profile: any | null;
  recommendations: any[];
  errors: string[];
}

/**
 * The ReAct Agent
 */
class ReActAgent {
  /**
   * Process a user message and generate a response
   */
  async process(
    message: string,
    userId: string,
    _conversationHistory: ChatMessage[] = []
  ): Promise<AgentResponse> {
    console.log(`\n🤖 ReAct Agent processing: "${message}"`);

    const thoughts: AgentThought[] = [];
    const actions: AgentAction[] = [];
    const observations: AgentObservation[] = [];
    const context: AgentContext = {
      schemes: [],
      eligibility: [],
      profile: null,
      recommendations: [],
      errors: [],
    };

    // Step 1: Classify intent
    const intent = await this.classifyIntent(message, userId);
    const intentThought: AgentThought = {
      type: 'reasoning',
      content: `Classified intent: ${intent.primary} (${(intent.confidence * 100).toFixed(0)}%)${intent.secondary.length > 0 ? `. Secondary: ${intent.secondary.join(', ')}` : ''}`,
      timestamp: Date.now(),
    };
    thoughts.push(intentThought);
    console.log(`💭 ${intentThought.content}`);

    // Step 2: Generate plan
    const plan = this.generatePlan(message, userId, intent);
    const planThought: AgentThought = {
      type: 'reasoning',
      content: `Plan: ${plan.map((s, i) => `${i + 1}) ${s.toolName}`).join(' → ')}`,
      timestamp: Date.now(),
    };
    thoughts.push(planThought);
    console.log(`📋 ${planThought.content}`);

    // Step 3: Execute plan steps
    for (let i = 0; i < Math.min(plan.length, MAX_ITERATIONS); i++) {
      const step = plan[i];

      // Resolve dynamic parameters from context
      const resolvedParams = this.resolveParameters(step, context, userId);

      const action: AgentAction = {
        toolName: step.toolName,
        parameters: resolvedParams,
        reasoning: step.reasoning,
      };
      actions.push(action);
      console.log(
        `⚡ Step ${i + 1}: ${action.toolName}(${JSON.stringify(resolvedParams).slice(0, 80)}...)`
      );

      try {
        const toolResult = await this.executeTool(action.toolName, resolvedParams);
        console.log(`📊 Result: ${toolResult.success ? '✅ Success' : '❌ Failed'}`);

        const interpretation = this.interpretResult(action.toolName, toolResult);
        const observation: AgentObservation = {
          toolName: action.toolName,
          result: toolResult,
          interpretation,
        };
        observations.push(observation);

        // Update context with results
        if (toolResult.success) {
          this.updateContext(context, action.toolName, toolResult.data);
        } else {
          context.errors.push(`${action.toolName}: ${toolResult.error}`);
        }

        // Generate reflection after each step
        const reflectionThought: AgentThought = {
          type: 'result_analysis',
          content: interpretation,
          timestamp: Date.now(),
        };
        thoughts.push(reflectionThought);
      } catch (error: any) {
        console.error(`❌ Step ${i + 1} error: ${error.message}`);
        context.errors.push(`${step.toolName}: ${error.message}`);
        observations.push({
          toolName: step.toolName,
          result: { success: false, error: error.message },
          interpretation: `Skipping failed step: ${error.message}`,
        });
        // Continue to next step — don't abort the whole plan
      }
    }

    // Step 4: Generate final response from accumulated context
    const finalResponse = this.generateFinalResponse(message, context, observations);

    return {
      response: finalResponse,
      thinking: thoughts,
      actionsUsed: actions,
      observations,
      confidence: this.calculateConfidence(actions, observations),
    };
  }

  /**
   * Classify the user's intent
   */
  private async classifyIntent(
    message: string,
    userId: string
  ): Promise<{ primary: string; confidence: number; secondary: string[] }> {
    // Check high-confidence rule patterns first (these are unambiguous)
    const msg = (message || '').toLowerCase();
    if (msg.includes('who am i') || msg === 'my profile' || msg === 'show my profile') {
      return { primary: 'profile_query', confidence: 0.9, secondary: [] };
    }

    // Try ML classification
    const classification = await mlService.classify(message, userId);
    if (classification && classification.confidence >= 0.7) {
      return {
        primary: classification.primary_intent,
        confidence: classification.confidence,
        secondary: classification.secondary_intents || [],
      };
    }

    // Rule-based fallback for lower-confidence ML or when ML is unavailable
    if (msg.includes('eligible') || msg.includes('qualify')) {
      return { primary: 'eligibility_check', confidence: 0.7, secondary: ['scheme_search'] };
    }
    if (msg.includes('recommend') || msg.includes('suggest') || msg.includes('best')) {
      return { primary: 'recommendation', confidence: 0.7, secondary: [] };
    }
    if (msg.includes('find') || msg.includes('search') || msg.includes('show')) {
      return { primary: 'scheme_search', confidence: 0.7, secondary: [] };
    }
    if (msg.includes('apply') || msg.includes('how to') || msg.includes('process')) {
      return { primary: 'application_info', confidence: 0.6, secondary: ['scheme_search'] };
    }
    if (msg.includes('update') || msg.includes('change my')) {
      return { primary: 'profile_update', confidence: 0.6, secondary: [] };
    }
    if (msg.includes('profile') || msg.includes('details') || msg.includes('about me')) {
      return { primary: 'profile_query', confidence: 0.6, secondary: [] };
    }

    // If ML gave a low-confidence result, still use it over the default
    if (classification) {
      return {
        primary: classification.primary_intent,
        confidence: classification.confidence,
        secondary: classification.secondary_intents || [],
      };
    }

    return { primary: 'general', confidence: 0.5, secondary: [] };
  }

  /**
   * Generate a multi-step execution plan based on intent
   */
  private generatePlan(
    message: string,
    userId: string,
    intent: { primary: string; secondary: string[] }
  ): PlanStep[] {
    const keywords = this.extractKeywords(message);
    const state = this.extractState(message);

    switch (intent.primary) {
      case 'scheme_search':
        return [
          {
            toolName: 'search_schemes',
            parameters: { query: keywords, state, limit: 5 },
            reasoning: 'Search for schemes matching user query.',
          },
        ];

      case 'eligibility_check':
        return [
          {
            toolName: 'search_schemes',
            parameters: { query: keywords, state, limit: 3 },
            reasoning: 'First find relevant schemes to check eligibility against.',
          },
          {
            toolName: 'check_eligibility',
            parameters: { userId, schemeId: '__from_context__' },
            reasoning: 'Check eligibility for the top matching scheme.',
            dependsOn: 0,
          },
        ];

      case 'recommendation':
        return [
          {
            toolName: 'get_recommendations',
            parameters: { userId, count: 5 },
            reasoning: 'Get personalized recommendations for the user.',
          },
        ];

      case 'application_info':
        return [
          {
            toolName: 'search_schemes',
            parameters: { query: keywords, state, limit: 3 },
            reasoning: 'Find schemes matching the query.',
          },
          {
            toolName: 'get_scheme_details',
            parameters: { schemeId: '__from_context__' },
            reasoning: 'Get full details including application URL.',
            dependsOn: 0,
          },
        ];

      case 'profile_update':
        return [
          {
            toolName: 'get_user_profile',
            parameters: { userId },
            reasoning: 'Get current profile to understand what needs updating.',
          },
        ];

      case 'profile_query':
        return [
          {
            toolName: 'get_user_profile',
            parameters: { userId },
            reasoning: 'Retrieve user profile information.',
          },
        ];

      default:
        // General: search + optionally recommend
        return [
          {
            toolName: 'search_schemes',
            parameters: { query: keywords, state, limit: 5 },
            reasoning: 'Search for relevant schemes.',
          },
        ];
    }
  }

  /**
   * Resolve dynamic parameters like __from_context__
   */
  private resolveParameters(
    step: PlanStep,
    context: AgentContext,
    userId: string
  ): Record<string, any> {
    const params = { ...step.parameters };

    // Replace __from_context__ with actual values from previous results
    if (params.schemeId === '__from_context__') {
      if (context.schemes.length > 0) {
        params.schemeId = context.schemes[0].id || context.schemes[0].scheme_id;
      } else {
        params.schemeId = undefined;
      }
    }

    // Ensure userId is always set
    if (params.userId === undefined && step.toolName !== 'search_schemes') {
      params.userId = userId;
    }

    return params;
  }

  /**
   * Update accumulated context with tool results
   */
  private updateContext(context: AgentContext, toolName: string, data: any): void {
    switch (toolName) {
      case 'search_schemes':
        if (data?.schemes) {
          context.schemes.push(...data.schemes);
        }
        break;
      case 'get_scheme_details':
        if (data) {
          // Merge details into existing scheme or add new
          const idx = context.schemes.findIndex((s) => s.id === data.id || s.scheme_id === data.id);
          if (idx >= 0) {
            context.schemes[idx] = { ...context.schemes[idx], ...data };
          } else {
            context.schemes.push(data);
          }
        }
        break;
      case 'check_eligibility':
        if (data) {
          context.eligibility.push(data);
        }
        break;
      case 'get_user_profile':
        context.profile = data;
        break;
      case 'get_recommendations':
        if (data?.recommendations) {
          context.recommendations.push(...data.recommendations);
        }
        break;
      case 'get_schemes_by_category':
        if (data?.schemes) {
          context.schemes.push(...data.schemes);
        }
        break;
    }
  }

  /**
   * Execute a tool by name
   */
  private async executeTool(toolName: string, params: Record<string, any>): Promise<any> {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, error: `Tool not found: ${toolName}` };
    }
    return await tool.execute(params);
  }

  /**
   * Interpret tool result into human-readable summary
   */
  private interpretResult(toolName: string, result: any): string {
    if (!result.success) {
      return `Tool "${toolName}" failed: ${result.error}`;
    }
    const data = result.data;
    switch (toolName) {
      case 'search_schemes':
        return `Found ${data?.count || 0} matching schemes.`;
      case 'get_scheme_details':
        return `Retrieved details for: ${data?.name || 'unknown scheme'}.`;
      case 'check_eligibility':
        return `Eligibility: ${data?.percentage || 0}% (${data?.category || 'unknown'}).`;
      case 'get_user_profile':
        return `Profile loaded for ${data?.name || 'user'}. Complete: ${data?.profileComplete ? 'Yes' : 'No'}.`;
      case 'get_recommendations':
        return `Generated ${data?.count || 0} recommendations (source: ${data?.source || 'unknown'}).`;
      case 'get_schemes_by_category':
        return `Found ${data?.count || 0} schemes in category ${data?.category || 'unknown'}.`;
      default:
        return 'Tool executed successfully.';
    }
  }

  /**
   * Generate the final response from accumulated context
   */
  private generateFinalResponse(
    message: string,
    context: AgentContext,
    observations: AgentObservation[]
  ): string {
    // No successful observations
    if (observations.every((o) => !o.result.success)) {
      return "I'm sorry, I encountered issues finding information. Please try rephrasing your question or ask about specific topics like agriculture schemes, education schemes, or women's schemes.";
    }

    const parts: string[] = [];

    // Recommendations
    if (context.recommendations.length > 0) {
      parts.push(`Here are your personalized recommendations:\n`);
      context.recommendations.slice(0, 5).forEach((rec, idx) => {
        parts.push(
          `${idx + 1}. **${rec.name}** — Relevance: ${rec.relevanceScore}% (${rec.state})`
        );
      });
    }

    // Schemes found
    if (context.schemes.length > 0 && context.recommendations.length === 0) {
      const count = context.schemes.length;
      parts.push(`I found ${count} scheme${count > 1 ? 's' : ''} matching your criteria:\n`);
      context.schemes.slice(0, 5).forEach((scheme, idx) => {
        const name = scheme.name;
        const ministry = scheme.ministry ? ` (${scheme.ministry})` : '';
        const state = scheme.state || 'All-India';
        parts.push(`${idx + 1}. **${name}**${ministry}`);
        parts.push(`   State: ${state}`);
        if (scheme.description) {
          parts.push(`   ${String(scheme.description).slice(0, 120)}...`);
        }
        if (scheme.applicationUrl) {
          parts.push(`   Apply: ${scheme.applicationUrl}`);
        }
      });
    }

    // Eligibility results
    if (context.eligibility.length > 0) {
      if (parts.length > 0) parts.push('');
      parts.push('**Eligibility Check:**');
      for (const elig of context.eligibility) {
        parts.push(`- **${elig.schemeName}**: ${elig.percentage}% (${elig.category})`);
        if (elig.explanation) {
          parts.push(`  ${elig.explanation}`);
        }
        if (elig.metCriteria && elig.metCriteria.length > 0) {
          parts.push(`  ✅ ${elig.metCriteria.join(', ')}`);
        }
      }
    }

    // Profile info
    if (context.profile && context.schemes.length === 0 && context.recommendations.length === 0) {
      parts.push(`**Your Profile:**`);
      const p = context.profile;
      if (p.name) parts.push(`- Name: ${p.name}`);
      if (p.age) parts.push(`- Age: ${p.age}`);
      if (p.state) parts.push(`- State: ${p.state}`);
      if (p.employment) parts.push(`- Employment: ${p.employment}`);
      if (p.education) parts.push(`- Education: ${p.education}`);
      if (p.income) parts.push(`- Income: ${p.income}`);
      parts.push(`- Profile Complete: ${p.profileComplete ? 'Yes' : 'No'}`);
    }

    // Fallback
    if (parts.length === 0) {
      return `I'm here to help you find government schemes. ${this.generateSimpleResponse(message)}`;
    }

    // Add follow-up suggestion
    parts.push('');
    if (context.eligibility.length === 0 && context.schemes.length > 0) {
      parts.push('Would you like to check your eligibility for any of these schemes?');
    } else if (context.recommendations.length > 0) {
      parts.push('Would you like more details about any of these schemes?');
    }

    return parts.join('\n');
  }

  /**
   * Generate a simple response when no tools are used
   */
  private generateSimpleResponse(message: string): string {
    const msg = message.toLowerCase();
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
      return 'I can help you find and apply for government schemes. What are you interested in?';
    }
    if (msg.includes('thank')) {
      return "You're welcome! Let me know if you need anything else.";
    }
    return 'What would you like to know about government schemes? You can ask me to search for schemes, check eligibility, or get recommendations.';
  }

  /**
   * Extract keywords from user message
   */
  private extractKeywords(message: string): string {
    const stopwords = new Set([
      'the',
      'and',
      'for',
      'you',
      'are',
      'can',
      'what',
      'how',
      'which',
      'there',
      'any',
      'this',
      'that',
      'with',
      'from',
      'have',
      'has',
      'does',
      'about',
      'please',
      'help',
      'me',
      'my',
      'do',
      'find',
      'search',
      'show',
      'tell',
      'get',
      'give',
      'want',
      'need',
      'looking',
    ]);
    const keywords = message
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2 && !stopwords.has(word))
      .slice(0, 4)
      .join(' ');

    return keywords || 'schemes';
  }

  /**
   * Extract state name from message if present
   */
  private extractState(message: string): string | undefined {
    const states = [
      'Andhra Pradesh',
      'Arunachal Pradesh',
      'Assam',
      'Bihar',
      'Chhattisgarh',
      'Goa',
      'Gujarat',
      'Haryana',
      'Himachal Pradesh',
      'Jharkhand',
      'Karnataka',
      'Kerala',
      'Madhya Pradesh',
      'Maharashtra',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Odisha',
      'Punjab',
      'Rajasthan',
      'Sikkim',
      'Tamil Nadu',
      'Telangana',
      'Tripura',
      'Uttar Pradesh',
      'Uttarakhand',
      'West Bengal',
      'Delhi',
      'Jammu and Kashmir',
      'Ladakh',
    ];
    const msgLower = message.toLowerCase();
    return states.find((s) => msgLower.includes(s.toLowerCase()));
  }

  /**
   * Calculate agent confidence
   */
  private calculateConfidence(_actions: AgentAction[], observations: AgentObservation[]): number {
    if (observations.length === 0) return 0.5;
    const successCount = observations.filter((o) => o.result.success).length;
    return Math.round((successCount / observations.length) * 100) / 100;
  }
}

export const reactAgent = new ReActAgent();

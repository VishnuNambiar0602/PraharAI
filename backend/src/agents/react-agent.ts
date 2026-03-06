/**
 * ReAct Agent
 * 
 * Reasoning + Acting agent that can:
 * 1. Understand user intent
 * 2. Plan a sequence of actions
 * 3. Execute tools (search, eligibility, etc.)
 * 4. Interpret tool results
 * 5. Generate natural responses
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

const MAX_ITERATIONS = 5; // Prevent infinite loops
const THINKING_PREFIX = 'Thought:';
const ACTION_PREFIX = 'Action:';
const OBSERVATION_PREFIX = 'Observation:';

/**
 * The ReAct Agent
 */
class ReActAgent {
  private systemPrompt = `You are Prahar AI, a helpful assistant that helps Indian citizens find government welfare schemes.

You have access to the following tools:
${toolRegistry.getToolDescriptions()}

Your goal is to:
1. Understand what the user needs
2. Use available tools to find schemes, check eligibility, update profiles
3. Provide clear, actionable information

Always think step-by-step. Use tools when needed. Be concise.`;

  /**
   * Process a user message and generate a response
   */
  async process(
    message: string,
    userId: string,
    conversationHistory: ChatMessage[] = []
  ): Promise<AgentResponse> {
    console.log(`\n🤖 ReAct Agent processing: "${message}"`);

    const thoughts: AgentThought[] = [];
    const actions: AgentAction[] = [];
    const observations: AgentObservation[] = [];

    // Initial thought: understand the message
    const initialThought = await this.generateThought(
      message,
      userId,
      thoughts,
      observations,
      conversationHistory
    );
    thoughts.push(initialThought);
    console.log(`💭 Thought: ${initialThought.content}`);

    let iterations = 0;
    let continueLoop = true;

    while (continueLoop && iterations < MAX_ITERATIONS) {
      try {
        // Select and execute action
        const action = await this.selectAction(message, thoughts, observations);

        if (!action) {
          // No more actions needed, generate final response
          continueLoop = false;
          break;
        }

        actions.push(action);
        console.log(`⚡ Action: ${action.toolName}(${JSON.stringify(action.parameters).slice(0, 50)}...)`);

        // Execute the tool
        const toolResult = await this.executeTool(action.toolName, action.parameters);
        console.log(`📊 Result: ${toolResult.success ? '✅ Success' : '❌ Failed'}`);

        const observation: AgentObservation = {
          toolName: action.toolName,
          result: toolResult,
          interpretation: await this.interpretResult(
            action.toolName,
            toolResult,
            message
          ),
        };
        observations.push(observation);

        // Check if we should continue
        if (!toolResult.success || observations.length >= MAX_ITERATIONS - 1) {
          continueLoop = false;
        } else {
          // Generate next thought
          const nextThought = await this.generateThought(
            message,
            userId,
            thoughts,
            observations,
            conversationHistory
          );
          thoughts.push(nextThought);
          console.log(`💭 Thought: ${nextThought.content}`);
        }
      } catch (error: any) {
        console.error(`❌ Agent error: ${error.message}`);
        continueLoop = false;
        observations.push({
          toolName: 'error',
          result: { success: false, error: error.message },
          interpretation: `Error occurred: ${error.message}. Will attempt to generate response with available information.`,
        });
      }

      iterations++;
    }

    // Generate final response
    const finalResponse = await this.generateFinalResponse(
      message,
      thoughts,
      actions,
      observations,
      userId,
      conversationHistory
    );

    return {
      response: finalResponse,
      thinking: thoughts,
      actionsUsed: actions,
      observations: observations,
      confidence: this.calculateConfidence(actions, observations),
    };
  }

  /**
   * Generate a thought about what to do next
   */
  private async generateThought(
    message: string,
    userId: string,
    previousThoughts: AgentThought[],
    observations: AgentObservation[],
    conversationHistory: ChatMessage[]
  ): Promise<AgentThought> {
    // Try ML-based classification first
    const classification = await mlService.classify(message, userId);

    if (classification) {
      const intent = classification.primary_intent;
      const confidence = classification.confidence;

      let thought = '';
      if (intent === 'scheme_search') {
        thought = `User is looking for schemes. I should search for relevant schemes based on their needs.`;
      } else if (intent === 'eligibility_check') {
        thought = `User wants to know if they're eligible for schemes. I should check their eligibility for relevant schemes.`;
      } else if (intent === 'profile_update') {
        thought = `User wants to update their profile information. I should help them update their details.`;
      } else if (intent === 'application_info') {
        thought = `User needs information about how to apply. I should find scheme details and application links.`;
      } else {
        thought = `User is asking a general question about schemes. I should search for relevant information.`;
      }

      return {
        type: 'reasoning',
        content: `${thought} (intent: ${intent}, confidence: ${(confidence * 100).toFixed(0)}%)`,
        timestamp: Date.now(),
      };
    }

    // Fallback: rule-based thought
    let thought = 'Analyzing user message...';
    if (message.toLowerCase().includes('eligible') || message.includes('qualify')) {
      thought = 'User is asking about eligibility. I should check their eligibility.';
    } else if (message.toLowerCase().includes('find') || message.includes('search')) {
      thought = 'User is looking for schemes. I should search for relevant options.';
    } else if (message.toLowerCase().includes('apply')) {
      thought = 'User wants application information. I should find schemes with application links.';
    }

    return {
      type: 'reasoning',
      content: thought,
      timestamp: Date.now(),
    };
  }

  /**
   * Decide which tool to use next
   */
  private async selectAction(
    message: string,
    thoughts: AgentThought[],
    observations: AgentObservation[]
  ): Promise<AgentAction | null> {
    // If we already have enough observations, stop
    if (observations.length > 0 && message.length < 50) {
      // Quick queries - one tool should suffice
      return null;
    }

    // Determine what action to take based on observations
    if (observations.length === 0) {
      // First action: search schemes
      return {
        toolName: 'search_schemes',
        parameters: {
          query: this.extractKeywords(message),
          limit: 5,
        },
        reasoning: 'Start by searching for relevant schemes based on user keywords.',
      };
    }

    // Second action: check eligibility if schemes found
    const lastObservation = observations[observations.length - 1];
    if (lastObservation.toolName === 'search_schemes' && lastObservation.result.success) {
      const schemes = lastObservation.result.data?.schemes || [];
      if (schemes.length > 0 && message.toLowerCase().includes('eligible')) {
        return {
          toolName: 'check_eligibility',
          parameters: {
            userId: 'current_user', // Will be replaced in execution
            schemeId: schemes[0].id,
          },
          reasoning: 'User asked about eligibility, check their eligibility for top scheme.',
        };
      }
    }

    // No more actions needed
    return null;
  }

  /**
   * Execute a tool
   */
  private async executeTool(
    toolName: string,
    params: Record<string, any>
  ): Promise<any> {
    const tool = toolRegistry.get(toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${toolName}`,
      };
    }

    return await tool.execute(params);
  }

  /**
   * Interpret tool result
   */
  private async interpretResult(
    toolName: string,
    result: any,
    userMessage: string
  ): Promise<string> {
    if (!result.success) {
      return `Tool "${toolName}" failed: ${result.error}`;
    }

    if (toolName === 'search_schemes') {
      const count = result.data?.count || 0;
      return `Found ${count} matching schemes`;
    } else if (toolName === 'get_scheme_details') {
      return `Retrieved full details for scheme: ${result.data?.name}`;
    } else if (toolName === 'check_eligibility') {
      const percentage = result.data?.percentage || 0;
      return `Eligibility score: ${percentage}%`;
    }

    return 'Tool executed successfully';
  }

  /**
   * Generate the final response to the user
   */
  private async generateFinalResponse(
    message: string,
    thoughts: AgentThought[],
    actions: AgentAction[],
    observations: AgentObservation[],
    userId: string,
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    // If no observations (no tools were used), generate a simple response
    if (observations.length === 0) {
      return `I'm here to help you find government schemes. ${this.generateSimpleResponse(message)}`;
    }

    // Build context from observations
    let context = '';
    for (const obs of observations) {
      if (obs.result.success) {
        context += `\n- ${obs.interpretation}: ${JSON.stringify(obs.result.data).slice(0, 200)}`;
      }
    }

    // Generate response based on context
    return this.generateResponseFromContext(message, context, observations);
  }

  /**
   * Generate a simple response when no tools are used
   */
  private generateSimpleResponse(message: string): string {
    if (message.toLowerCase().includes('hello') || message.includes('hi')) {
      return "I can help you find and apply for government schemes. What are you interested in?";
    }
    return 'What would you like to know about government schemes?';
  }

  /**
   * Generate response based on tool results
   */
  private generateResponseFromContext(
    message: string,
    context: string,
    observations: AgentObservation[]
  ): string {
    const firstObs = observations[0];

    if (firstObs?.toolName === 'search_schemes') {
      const schemes = firstObs.result.data?.schemes || [];
      if (schemes.length === 0) {
        return `I couldn't find any schemes matching your query. Try searching for broader terms like "agriculture", "education", or "women".`;
      }

      let response = `I found ${schemes.length} schemes matching your criteria:\n\n`;
      schemes.slice(0, 3).forEach((scheme: any, idx: number) => {
        response += `${idx + 1}. **${scheme.name}** (${scheme.ministry})\n`;
        response += `   State: ${scheme.state}\n`;
        if (scheme.description) {
          response += `   ${scheme.description.slice(0, 100)}...\n`;
        }
      });

      response += `\nWould you like more details about any of these schemes or want to check your eligibility?`;
      return response;
    } else if (firstObs?.toolName === 'check_eligibility') {
      const data = firstObs.result.data;
      return `For **${data.schemeName}**:\n- Eligibility Score: ${data.percentage}%\n- Category: ${data.category}\n- ${data.explanation}`;
    }

    return `Found information. ${context}`;
  }

  /**
   * Extract keywords from user message
   */
  private extractKeywords(message: string): string {
    // Simple keyword extraction
    const keywords = message
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 2 && !['the', 'and', 'for', 'you', 'are'].includes(word))
      .slice(0, 3)
      .join(' ');

    return keywords || 'schemes';
  }

  /**
   * Calculate agent confidence based on actions and observations
   */
  private calculateConfidence(actions: AgentAction[], observations: AgentObservation[]): number {
    if (observations.length === 0) return 0.5; // No data yet

    const successCount = observations.filter((o) => o.result.success).length;
    const confidence = successCount / observations.length;

    return Math.round(confidence * 100) / 100;
  }
}

// Export singleton instance
export const reactAgent = new ReActAgent();

/**
 * ReAct Agent - Implements Reasoning + Acting loop for conversational AI
 * 
 * The agent follows a Thought → Action → Observation → Decision cycle:
 * 1. Thought: Analyze query and context to understand intent
 * 2. Action: Select and execute appropriate tools
 * 3. Observation: Interpret tool results
 * 4. Decision: Continue reasoning, ask clarification, or generate response
 */

import {
  ConversationContext,
  Message,
  Thought,
  Action,
  Observation,
  AgentResponse,
  Tool,
  ToolResult,
  ToolExecution,
} from './types';
import { llmService } from '../services/llm.service';
import { mlService } from '../services/ml.service';

export class ReActAgent {
  private tools: Map<string, Tool> = new Map();
  private maxReasoningSteps: number = 5;

  constructor(tools: Tool[] = []) {
    tools.forEach((tool) => this.registerTool(tool));
  }

  /**
   * Register a tool for the agent to use
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Main entry point - Process a user query through the ReAct loop
   */
  async processQuery(
    query: string,
    context: ConversationContext
  ): Promise<AgentResponse> {
    // Add user message to history
    const userMessage: Message = {
      messageId: this.generateId(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    context.messageHistory.push(userMessage);

    const thoughts: Thought[] = [];
    const toolsUsed: string[] = [];
    let stepCount = 0;

    // ReAct reasoning loop
    while (stepCount < this.maxReasoningSteps) {
      stepCount++;

      // THOUGHT: Analyze query and context
      const thought = await this.generateThought(query, context.messageHistory);
      thoughts.push(thought);

      // Check if we have enough information to respond
      if (thought.requiredInformation.length === 0) {
        break;
      }

      // ACTION: Select and execute tool
      const action = await this.selectAction(thought, Array.from(this.tools.values()));
      
      // Check if tool requires auth
      const tool = this.tools.get(action.toolName);
      if (tool?.requiresAuth && !context.userId) {
        // Cannot execute authenticated tool without user
        break;
      }

      const toolResult = await this.executeTool(action, context);
      toolsUsed.push(action.toolName);

      // Record tool execution
      const execution: ToolExecution = {
        executionId: this.generateId(),
        toolName: action.toolName,
        parameters: action.parameters,
        result: toolResult,
        timestamp: new Date(),
      };
      context.toolExecutionHistory.push(execution);

      // OBSERVATION: Process tool result
      const observation = await this.processObservation(toolResult);

      // DECISION: Determine next steps
      if (observation.nextSteps.includes('generate_response')) {
        break;
      }

      if (observation.nextSteps.includes('ask_clarification')) {
        break;
      }
    }

    // Generate final response
    const response = await this.generateResponse(context, thoughts, toolsUsed);

    // Add agent message to history
    const agentMessage: Message = {
      messageId: this.generateId(),
      role: 'agent',
      content: response.content,
      timestamp: new Date(),
    };
    context.messageHistory.push(agentMessage);

    return response;
  }

  /**
   * THOUGHT: Analyze query — uses ML classifier when available, falls back to rule-based
   */
  async generateThought(query: string, history: Message[]): Promise<Thought> {
    const requiredInformation: string[] = [];
    const lowerQuery = query.toLowerCase();

    // Try ML intent classification first (T-09)
    try {
      const mlResult = await mlService.classify(query);
      if (mlResult) {
        const intent = mlResult.primary_intent;
        if (intent === 'scheme_search') requiredInformation.push('scheme_information');
        else if (intent === 'eligibility_check') requiredInformation.push('eligibility_check');
        else if (intent === 'application_info') requiredInformation.push('application_info');
        else if (intent === 'deadline_query') requiredInformation.push('deadline_info');
        else if (intent === 'profile_update') requiredInformation.push('profile_update');

        return {
          reasoning: `ML classified as "${intent}" (confidence: ${mlResult.confidence.toFixed(2)})`,
          confidence: mlResult.confidence,
          requiredInformation,
        };
      }
    } catch { /* fall through to rules */ }

    // Rule-based fallback
    if (lowerQuery.includes('eligible') || lowerQuery.includes('qualify') || lowerQuery.includes('can i get')) {
      requiredInformation.push('eligibility_check');
    } else if (lowerQuery.includes('how to apply') || lowerQuery.includes('apply for') || lowerQuery.includes('application')) {
      requiredInformation.push('application_info');
    } else if (lowerQuery.includes('scheme') || lowerQuery.includes('recommend') || lowerQuery.includes('find') || lowerQuery.includes('benefit') || lowerQuery.includes('welfare') || lowerQuery.includes('scholarship') || lowerQuery.includes('grant')) {
      requiredInformation.push('scheme_information');
    } else if (lowerQuery.includes('deadline') || lowerQuery.includes('last date')) {
      requiredInformation.push('deadline_info');
    } else if (lowerQuery.includes('tell me about') || lowerQuery.includes('what is') || lowerQuery.includes('details of') || lowerQuery.includes('info on')) {
      requiredInformation.push('scheme_details');
    }

    return {
      reasoning: `Rule-based analysis of: "${query}"`,
      confidence: requiredInformation.length > 0 ? 0.75 : 0.5,
      requiredInformation,
    };
  }

  /**
   * ACTION: Select appropriate tool based on thought
   */
  async selectAction(thought: Thought, availableTools: Tool[]): Promise<Action> {
    const toolNames = new Set(availableTools.map(t => t.name));
    let toolName = 'search_schemes';
    const parameters: Record<string, any> = {};

    if (thought.requiredInformation.includes('eligibility_check')) {
      toolName = toolNames.has('check_eligibility') ? 'check_eligibility' : 'search_schemes';
    } else if (thought.requiredInformation.includes('scheme_details')) {
      toolName = toolNames.has('get_scheme_details') ? 'get_scheme_details' : 'search_schemes';
    } else if (thought.requiredInformation.includes('scheme_information')) {
      toolName = 'search_schemes';
      parameters.limit = 6;
    } else if (thought.requiredInformation.includes('application_info')) {
      toolName = toolNames.has('get_scheme_details') ? 'get_scheme_details' : 'search_schemes';
    }

    return {
      toolName,
      parameters,
      reasoning: `Selected ${toolName} for: ${thought.requiredInformation.join(', ')}`,
    };
  }

  /**
   * Execute a tool with given parameters
   */
  private async executeTool(
    action: Action,
    context: ConversationContext
  ): Promise<ToolResult> {
    const tool = this.tools.get(action.toolName);

    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `Tool ${action.toolName} not found`,
        },
        metadata: {
          executionTime: 0,
          cacheHit: false,
          toolVersion: '1.0',
        },
      };
    }

    const startTime = Date.now();
    try {
      const result = await tool.execute(action.parameters, context);
      result.metadata.executionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'TOOL_EXECUTION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        metadata: {
          executionTime: Date.now() - startTime,
          cacheHit: false,
          toolVersion: '1.0',
        },
      };
    }
  }

  /**
   * OBSERVATION: Process and interpret tool results
   */
  async processObservation(toolResult: ToolResult): Promise<Observation> {
    if (!toolResult.success) {
      return {
        toolResult,
        interpretation: 'Tool execution failed',
        nextSteps: ['generate_response'],
      };
    }

    // Interpret the result
    const interpretation = 'Tool executed successfully';
    
    // Determine next steps
    const nextSteps: string[] = [];
    
    if (toolResult.data) {
      // We have data, can generate response
      nextSteps.push('generate_response');
    } else {
      // Need more information
      nextSteps.push('continue_reasoning');
    }

    return {
      toolResult,
      interpretation,
      nextSteps,
    };
  }

  /**
   * Generate final natural language response — uses LLM when configured (T-12),
   * otherwise falls back to rich template-based responses.
   */
  async generateResponse(
    context: ConversationContext,
    thoughts: Thought[],
    toolsUsed: string[]
  ): Promise<AgentResponse> {
    const lastExec = context.toolExecutionHistory[context.toolExecutionHistory.length - 1];
    const toolData = lastExec?.result?.success ? lastExec.result.data : null;
    const toolName = lastExec?.toolName || '';
    const query = context.messageHistory.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
    const profile = context.userProfile || {};

    // Build context summary for LLM
    const toolSummary = toolData ? JSON.stringify(toolData).slice(0, 800) : 'No tool data';

    // Try LLM response first (T-12)
    if (llmService.isConfigured) {
      const systemPrompt =
        `You are Prahar AI, a helpful assistant that helps Indian citizens find government welfare schemes. ` +
        `Respond in a friendly, concise tone. Always include the scheme name and application URL when available. ` +
        `Format lists with bullet points. Keep responses under 300 words. Language: English unless user writes in another language.`;

      const userPrompt =
        `User asked: "${query}"\n\n` +
        `Tool used: ${toolName || 'none'}\n` +
        `Tool result (truncated): ${toolSummary}\n\n` +
        `User profile: age=${profile.age || 'N/A'}, state=${profile.state || 'N/A'}, ` +
        `employment=${profile.employment || 'N/A'}, income=${profile.income || 'N/A'}\n\n` +
        `Generate a helpful, actionable response based on this data.`;

      const llmContent = await llmService.complete(systemPrompt, userPrompt);
      if (llmContent) {
        return {
          content: llmContent,
          reasoning: thoughts,
          toolsUsed,
          suggestions: this.buildSuggestions(toolName),
          timestamp: new Date(),
        };
      }
    }

    // Template fallback — rich structured response
    const content = this.buildTemplateResponse(query, toolName, toolData, profile);

    return {
      content,
      reasoning: thoughts,
      toolsUsed,
      suggestions: this.buildSuggestions(toolName),
      timestamp: new Date(),
    };
  }

  private buildTemplateResponse(
    query: string,
    toolName: string,
    toolData: any,
    profile: any
  ): string {
    const userName = profile.name ? ` ${profile.name.split(' ')[0]}` : '';

    if (!toolData) {
      return `I couldn't find specific information for that query${userName ? `, ${userName}` : ''}. Try rephrasing, or browse the **Schemes** page for the full list of 4,600+ government schemes.`;
    }

    // search_schemes / findMatchingSchemes result
    if (toolName === 'search_schemes' || Array.isArray(toolData)) {
      const schemes: any[] = Array.isArray(toolData) ? toolData : (toolData.matches || []);
      if (schemes.length === 0) {
        return `No schemes found matching your query${userName ? `, ${userName}` : ''}. Try broader keywords like "agriculture", "health", or "education".`;
      }
      let resp = `📚 **Matching Schemes**${userName ? ` for ${userName}` : ''} (${schemes.length} found)\n\n`;
      for (const s of schemes.slice(0, 5)) {
        const name = s.name || s.title || 'Unknown';
        const desc = (s.description || '').substring(0, 110).trim();
        const score = s.eligibilityScore ? ` — ${s.eligibilityScore}% match` : '';
        resp += `• **${name}**${score}\n  ${desc}${desc.length >= 110 ? '...' : ''}\n\n`;
      }
      resp += `💡 Say **"am I eligible for [scheme name]?"** to check your eligibility, or visit the Schemes page to Apply Now.`;
      return resp;
    }

    // check_eligibility result
    if (toolName === 'check_eligibility') {
      const eligible: any[] = toolData.eligibleSchemes || [];
      if (eligible.length === 0) {
        return `Based on your current profile I couldn't find highly matching schemes. Complete your profile (age, state, employment, income) for better results.`;
      }
      let resp = `✅ **Eligible Schemes** for you${userName ? `, ${userName}` : ''}:\n\n`;
      for (const s of eligible.slice(0, 5)) {
        const name = s.name || 'Unknown';
        const score = s.eligibilityScore || 0;
        const url = s.schemeUrl || s.applicationUrl;
        resp += `• **${name}** — ${score}% eligible\n`;
        if (url) resp += `  🔗 [Apply Now](${url})\n`;
        resp += '\n';
      }
      resp += `📝 These are based on your profile. Update your details for more accurate results.`;
      return resp;
    }

    // get_scheme_details result
    if (toolName === 'get_scheme_details') {
      const s = toolData;
      if (!s) return 'Scheme details not found. Try searching by name on the Schemes page.';
      let resp = `📋 **${s.name || 'Scheme Details'}**\n\n`;
      if (s.description) resp += `${s.description.substring(0, 200)}${s.description.length > 200 ? '...' : ''}\n\n`;
      if (s.ministry) resp += `🏛️ Ministry: ${s.ministry}\n`;
      if (s.tags?.length) resp += `🏷️ Tags: ${s.tags.slice(0, 5).join(', ')}\n`;
      if (s.applicationUrl) resp += `\n🔗 **[Apply Now](${s.applicationUrl})**`;
      if (s.otherMatches?.length) resp += `\n\nRelated: ${s.otherMatches.join(', ')}`;
      return resp;
    }

    return `I found some information. Use the **Schemes** page to browse by category, or ask me about a specific scheme.`;
  }

  private buildSuggestions(toolName: string): string[] {
    if (toolName === 'check_eligibility') {
      return ['Show matching schemes', 'Update my profile', 'Tell me more about a scheme'];
    }
    if (toolName === 'get_scheme_details') {
      return ['Am I eligible for this?', 'Find similar schemes', 'Show my profile'];
    }
    return ['Check my eligibility', 'Show all schemes', 'Update my profile'];
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Tool Types and Interfaces
 *
 * Central type definitions for all ReAct tools.
 * Tools are modular functions that the agent can call to:
 * - Search for schemes
 * - Check eligibility
 * - Update user profiles
 * - etc.
 */

/**
 * Parameter definition for a tool
 * Used for validation and type hinting
 */
export interface ParameterDefinition {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: (string | number)[];
  items?: ParameterDefinition; // For arrays
}

/**
 * Tool Result — returned by tool execution
 */
export interface ToolResult {
  success: boolean;
  data?: any; // The actual result
  error?: string; // Error message if failed
  executionTime?: number; // ms
}

/**
 * Tool Definition
 * Every tool must implement this interface
 */
export interface Tool {
  /** Unique tool name (snake_case) — e.g., "search_schemes" */
  name: string;

  /** Human-readable description */
  description: string;

  /** Parameter definitions for validation */
  parameters: Record<string, ParameterDefinition>;

  /**
   * Execute the tool with given parameters
   * Should not throw — return ToolResult with success: false instead
   */
  execute(params: Record<string, any>): Promise<ToolResult>;

  /** Optional: validate raw parameters before execution */
  validate?(params: Record<string, any>): { valid: boolean; error?: string };
}

/**
 * Agent Thought — what the agent is thinking
 */
export interface AgentThought {
  type: 'reasoning' | 'tool_selection' | 'result_analysis';
  content: string;
  timestamp: number;
}

/**
 * Agent Action — a tool call
 */
export interface AgentAction {
  toolName: string;
  parameters: Record<string, any>;
  reasoning: string; // Why are we calling this tool?
}

/**
 * Agent Observation — result from a tool call
 */
export interface AgentObservation {
  toolName: string;
  result: ToolResult;
  interpretation: string; // How agent interprets the result
}

/**
 * Agent Step — one iteration of the ReAct loop
 */
export interface AgentStep {
  thought: AgentThought;
  action?: AgentAction;
  observation?: AgentObservation;
}

/**
 * Chat message in conversation history
 */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    toolsUsed?: string[];
    timestamp?: number;
  };
}

/**
 * Final response from the agent
 */
export interface AgentResponse {
  response: string; // Final answer to user
  thinking: AgentThought[]; // All thoughts from reasoning process
  actionsUsed: AgentAction[]; // All tool calls made
  observations: AgentObservation[]; // Tool results
  confidence: number; // 0-1, how confident in this answer
}

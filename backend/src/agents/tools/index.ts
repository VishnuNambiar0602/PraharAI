/**
 * Tool Index
 *
 * Central export point for all tool-related functionality
 */

export { toolRegistry, Tool } from './registry';
export { BaseTool } from './base';
export { SearchSchemesTool, GetSchemeDetailsTool, GetSchemesByCategoryTool } from './scheme-tools';
export { CheckEligibilityTool, UpdateUserProfileTool, GetUserProfileTool } from './profile-tools';
export { GetRecommendationsTool } from './recommendation-tools';
export { FindBestSchemesTool, AnalyzeEligibilityTool } from './compound-tools';
export type {
  ParameterDefinition,
  ToolResult,
  Tool as ToolInterface,
  AgentThought,
  AgentAction,
  AgentObservation,
  AgentStep,
  ChatMessage,
  AgentResponse,
} from './types';

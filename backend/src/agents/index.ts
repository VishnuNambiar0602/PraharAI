/**
 * Agents Module
 * Exports all autonomous agents and tools
 */

export { schemeSyncAgent } from './scheme-sync-agent';
export { similarityAgent } from './similarity-agent';
export { reactAgent } from './react-agent';

// Tools exports
export {
  toolRegistry,
  BaseTool,
  SearchSchemesTool,
  GetSchemeDetailsTool,
  GetSchemesByCategoryTool,
  CheckEligibilityTool,
  UpdateUserProfileTool,
  GetUserProfileTool,
  GetRecommendationsTool,
  FindBestSchemesTool,
  AnalyzeEligibilityTool,
} from './tools';

/**
 * Initialize all tools
 * Call this once at application startup
 */
export function initializeTools() {
  const {
    toolRegistry,
    SearchSchemesTool,
    GetSchemeDetailsTool,
    GetSchemesByCategoryTool,
    CheckEligibilityTool,
    UpdateUserProfileTool,
    GetUserProfileTool,
    GetRecommendationsTool,
    FindBestSchemesTool,
    AnalyzeEligibilityTool,
  } = require('./tools');

  // Prevent double-registration
  if (toolRegistry.has('search_schemes')) return;

  toolRegistry.registerMultiple([
    new SearchSchemesTool(),
    new GetSchemeDetailsTool(),
    new GetSchemesByCategoryTool(),
    new CheckEligibilityTool(),
    new UpdateUserProfileTool(),
    new GetUserProfileTool(),
    new GetRecommendationsTool(),
    new FindBestSchemesTool(),
    new AnalyzeEligibilityTool(),
  ]);

  console.log('✅ All tools initialized');
}

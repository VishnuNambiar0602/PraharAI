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
  } = require('./tools');

  toolRegistry.registerMultiple([
    new SearchSchemesTool(),
    new GetSchemeDetailsTool(),
    new GetSchemesByCategoryTool(),
    new CheckEligibilityTool(),
    new UpdateUserProfileTool(),
    new GetUserProfileTool(),
  ]);

  console.log('✅ All tools initialized');
}

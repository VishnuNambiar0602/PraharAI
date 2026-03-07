/**
 * Tool Registry
 *
 * Central registry for all available tools that the ReAct agent can use.
 * Tools can be registered at startup and retrieved by name.
 */

import { Tool } from './types';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  /**
   * Register a tool in the registry
   * @throws Error if tool with same name already exists
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
    console.log(`✅ Tool registered: ${tool.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerMultiple(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all available tools
   */
  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tool names only (useful for agent to know available tools)
   */
  listNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool descriptions in a format suitable for LLM prompts
   */
  getToolDescriptions(): string {
    return this.list()
      .map((tool) => {
        const paramsStr = Object.entries(tool.parameters)
          .map(([name, def]) => `${name}: ${def.type}${def.required ? ' (required)' : ''}`)
          .join(', ');
        return `- ${tool.name}(${paramsStr}): ${tool.description}`;
      })
      .join('\n');
  }

  /**
   * Clear all tools (useful for testing)
   */
  clear(): void {
    this.tools.clear();
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistry();

export { Tool };

/**
 * Base Tool Class
 *
 * Abstract base class that all tools should extend.
 * Provides common functionality like validation, error handling, timing.
 */

import { Tool, ToolResult, ParameterDefinition } from './types';

export abstract class BaseTool implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: Record<string, ParameterDefinition>;

  /**
   * Template method — validates then executes
   * Subclasses should override executeImpl() instead of execute()
   */
  async execute(params: Record<string, any>): Promise<ToolResult> {
    const start = Date.now();

    try {
      // Validate parameters
      const validation = this.validate(params);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Validation failed',
          executionTime: Date.now() - start,
        };
      }

      // Execute the tool
      const data = await this.executeImpl(params);

      return {
        success: true,
        data,
        executionTime: Date.now() - start,
      };
    } catch (error: any) {
      console.error(`❌ Tool "${this.name}" error:`, error.message);
      return {
        success: false,
        error: error.message || 'Unknown error',
        executionTime: Date.now() - start,
      };
    }
  }

  /**
   * Subclasses should implement this instead of execute()
   */
  protected abstract executeImpl(params: Record<string, any>): Promise<any>;

  /**
   * Default validation — checks required parameters
   * Subclasses can override for custom validation
   */
  validate(params: Record<string, any>): { valid: boolean; error?: string } {
    for (const [name, def] of Object.entries(this.parameters)) {
      if (def.required && !(name in params)) {
        return {
          valid: false,
          error: `Required parameter missing: "${name}"`,
        };
      }

      if (name in params && params[name] !== null && params[name] !== undefined) {
        const actualType = Array.isArray(params[name]) ? 'array' : typeof params[name];
        if (actualType !== def.type) {
          return {
            valid: false,
            error: `Parameter "${name}": expected ${def.type}, got ${actualType}`,
          };
        }

        // Check enum values
        if (def.enum && !def.enum.includes(params[name])) {
          return {
            valid: false,
            error: `Parameter "${name}": must be one of [${def.enum.join(', ')}]`,
          };
        }
      }
    }

    return { valid: true };
  }
}

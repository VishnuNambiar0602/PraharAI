/**
 * Tests for Tools Registry and Base Tool
 */

import { toolRegistry, BaseTool } from '..';
import { ParameterDefinition } from '../types';

// Mock tool for testing
class MockTool extends BaseTool {
  name = 'mock_tool';
  description = 'A mock tool for testing';
  parameters: Record<string, ParameterDefinition> = {
    input: { type: 'string', description: 'Test input', required: true },
    count: { type: 'number', description: 'Count', required: false },
  };

  protected async executeImpl(): Promise<any> {
    return { success: true, message: 'Mock executed' };
  }
}

// Test tool that throws
class FailingTool extends BaseTool {
  name = 'failing_tool';
  description = 'A tool that fails for testing';
  parameters: Record<string, ParameterDefinition> = {
    input: { type: 'string', description: 'Test input', required: true },
  };

  protected async executeImpl(): Promise<any> {
    throw new Error('Intentional test error');
  }
}

describe('Tool Registry', () => {
  beforeEach(() => {
    toolRegistry.clear();
  });

  test('should register a tool', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);
    expect(toolRegistry.has('mock_tool')).toBe(true);
  });

  test('should get a tool by name', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);
    const retrieved = toolRegistry.get('mock_tool');
    expect(retrieved?.name).toBe('mock_tool');
  });

  test('should list all tools', () => {
    const tool1 = new MockTool();
    const tool2 = new FailingTool();
    toolRegistry.registerMultiple([tool1, tool2]);
    const tools = toolRegistry.list();
    expect(tools.length).toBe(2);
  });

  test('should throw on duplicate registration', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);
    expect(() => toolRegistry.register(tool)).toThrow();
  });

  test('should generate tool descriptions for prompts', () => {
    const tool = new MockTool();
    toolRegistry.register(tool);
    const description = toolRegistry.getToolDescriptions();
    expect(description).toContain('mock_tool');
    expect(description).toContain('A mock tool for testing');
  });
});

describe('BaseTool', () => {
  test('should execute successfully', async () => {
    const tool = new MockTool();
    const result = await tool.execute({ input: 'test' });
    expect(result.success).toBe(true);
    expect(result.data?.message).toBe('Mock executed');
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });

  test('should fail on missing required parameter', async () => {
    const tool = new MockTool();
    const result = await tool.execute({});
    expect(result.success).toBe(false);
    expect(result.error).toContain('Required parameter missing');
  });

  test('should fail on wrong parameter type', async () => {
    const tool = new MockTool();
    const result = await tool.execute({ input: 123 }); // Should be string
    expect(result.success).toBe(false);
    expect(result.error).toContain('expected string');
  });

  test('should catch tool execution errors', async () => {
    const tool = new FailingTool();
    const result = await tool.execute({ input: 'test' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('Intentional test error');
  });

  test('should measure execution time', async () => {
    const tool = new MockTool();
    const result = await tool.execute({ input: 'test' });
    expect(result.executionTime).toBeGreaterThanOrEqual(0);
  });
});

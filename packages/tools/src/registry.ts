/**
 * Tool registry for managing available tools.
 * Provides a central registry for tool definitions.
 */

import type { ToolDefinition } from '@autic/shared';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, { ...tool });
  }

  unregister(id: string): boolean {
    return this.tools.delete(id);
  }

  get(id: string): ToolDefinition | undefined {
    return this.tools.get(id);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  findByCapability(capability: string): ToolDefinition[] {
    return this.list().filter((t) => t.description.toLowerCase().includes(capability.toLowerCase()));
  }

  count(): number {
    return this.tools.size;
  }

  clear(): void {
    this.tools.clear();
  }
}

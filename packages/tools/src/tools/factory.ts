/**
 * Tool factory — Registers all built-in Autic tools with the registry.
 */

import type { ToolDefinition } from '@autic/shared';
import { ToolRegistry } from '../registry.js';

const builtinTools: ToolDefinition[] = [
  {
    id: 'read_file',
    name: 'read_file',
    description: 'Read contents of a file from disk',
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file to read', required: true },
      {
        name: 'maxLength',
        type: 'number',
        description: 'Maximum bytes to read (optional)',
        required: false,
      },
    ],
    handler: 'readFileTool',
    enabled: true,
  },
  {
    id: 'write_file',
    name: 'write_file',
    description: 'Write content to a file on disk',
    parameters: [
      { name: 'path', type: 'string', description: 'Path to the file to write', required: true },
      { name: 'content', type: 'string', description: 'Content to write', required: true },
      {
        name: 'createDirs',
        type: 'boolean',
        description: 'Create parent directories if missing',
        required: false,
      },
    ],
    handler: 'writeFileTool',
    enabled: true,
  },
  {
    id: 'list_files',
    name: 'list_files',
    description: 'List files and directories in a path',
    parameters: [
      { name: 'path', type: 'string', description: 'Directory path to list', required: true },
      { name: 'pattern', type: 'string', description: 'Optional filter pattern', required: false },
      { name: 'recursive', type: 'boolean', description: 'List recursively', required: false },
    ],
    handler: 'listFilesTool',
    enabled: true,
  },
  {
    id: 'search_files',
    name: 'search_files',
    description: 'Search for files by name pattern',
    parameters: [
      { name: 'root', type: 'string', description: 'Root directory to search', required: true },
      { name: 'pattern', type: 'string', description: 'Filename pattern to match', required: true },
      { name: 'maxDepth', type: 'number', description: 'Maximum directory depth', required: false },
      {
        name: 'maxResults',
        type: 'number',
        description: 'Maximum results to return',
        required: false,
      },
    ],
    handler: 'searchFilesTool',
    enabled: true,
  },
  {
    id: 'run_terminal',
    name: 'run_terminal',
    description: 'Execute a shell command with safety controls',
    parameters: [
      { name: 'command', type: 'string', description: 'Command to execute', required: true },
      { name: 'args', type: 'array', description: 'Command arguments', required: false },
      { name: 'cwd', type: 'string', description: 'Working directory', required: false },
      {
        name: 'timeoutMs',
        type: 'number',
        description: 'Execution timeout in ms',
        required: false,
      },
    ],
    handler: 'runTerminalTool',
    enabled: true,
  },
];

export function registerBuiltinTools(registry: ToolRegistry): void {
  for (const tool of builtinTools) {
    registry.register(tool);
  }
}

export function getDefaultTools(): ToolDefinition[] {
  return [...builtinTools];
}

/**
 * read_file — Read file contents from disk.
 * Real implementation using Node.js fs/promises.
 */

import { readFile } from 'node:fs/promises';
import type { ToolResult } from '@autic/shared';

export interface ReadFileArgs {
  path: string;
  maxLength?: number;
}

export async function readFileTool(args: ReadFileArgs): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const content = await readFile(args.path, 'utf-8');
    const truncated =
      args.maxLength && content.length > args.maxLength
        ? content.slice(0, args.maxLength) + '\n... [truncated]'
        : content;
    return {
      success: true,
      data: {
        path: args.path,
        content: truncated,
        byteLength: Buffer.byteLength(content, 'utf-8'),
      },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

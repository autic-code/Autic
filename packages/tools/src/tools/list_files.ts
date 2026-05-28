/**
 * list_files — List files and directories in a path.
 * Real implementation using Node.js fs/promises.
 */

import { readdir } from 'node:fs/promises';
import type { ToolResult } from '@autic/shared';

export interface ListFilesArgs {
  path: string;
  pattern?: string;
  recursive?: boolean;
}

export async function listFilesTool(args: ListFilesArgs): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const entries = await readdir(args.path, { withFileTypes: true });
    const files = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? ('directory' as const) : ('file' as const),
    }));
    return {
      success: true,
      data: { path: args.path, files, count: files.length },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to list ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

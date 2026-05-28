/**
 * write_file — Write content to a file on disk.
 * Real implementation using Node.js fs/promises.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolResult } from '@autic/shared';

export interface WriteFileArgs {
  path: string;
  content: string;
  createDirs?: boolean;
}

export async function writeFileTool(args: WriteFileArgs): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    if (args.createDirs) {
      await mkdir(dirname(args.path), { recursive: true });
    }
    await writeFile(args.path, args.content, 'utf-8');
    return {
      success: true,
      data: { path: args.path, bytesWritten: Buffer.byteLength(args.content, 'utf-8') },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write ${args.path}: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

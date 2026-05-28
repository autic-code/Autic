/**
 * search_files — Search for files by name pattern using glob.
 * Real implementation using Node.js fs/promises and path matching.
 */

import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import type { ToolResult } from '@autic/shared';

export interface SearchFilesArgs {
  root: string;
  pattern: string;
  maxDepth?: number;
  maxResults?: number;
}

interface DirEntry {
  name: string;
  isDirectory: boolean;
}

async function walkDir(
  dirPath: string,
  pattern: string,
  maxDepth: number,
  currentDepth: number,
  rootLen: number,
  results: string[],
  maxResults: number,
): Promise<void> {
  if (results.length >= maxResults || currentDepth > maxDepth) return;

  let entries: DirEntry[];
  try {
    const dir = await readdir(dirPath, { withFileTypes: true });
    entries = dir.map((e) => ({ name: e.name, isDirectory: e.isDirectory() }));
  } catch {
    return;
  }

  for (const entry of entries) {
    if (results.length >= maxResults) return;
    const fullPath = join(dirPath, entry.name);

    if (entry.name.includes(pattern) || entry.name.toLowerCase().includes(pattern.toLowerCase())) {
      results.push(relative(process.cwd(), fullPath));
    }

    if (entry.isDirectory && currentDepth < maxDepth) {
      await walkDir(fullPath, pattern, maxDepth, currentDepth + 1, rootLen, results, maxResults);
    }
  }
}

export async function searchFilesTool(args: SearchFilesArgs): Promise<ToolResult> {
  const startTime = Date.now();
  try {
    const results: string[] = [];
    const maxDepth = args.maxDepth ?? 5;
    const maxResults = args.maxResults ?? 50;
    const rootLen = args.root.length;

    await walkDir(args.root, args.pattern, maxDepth, 0, rootLen, results, maxResults);

    return {
      success: true,
      data: { root: args.root, pattern: args.pattern, results, count: results.length, truncated: results.length >= maxResults },
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to search ${args.root}: ${error instanceof Error ? error.message : String(error)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

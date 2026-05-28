/**
 * ContextOptimizer — Token optimization for context windows.
 *
 * Selectively retrieves relevant files, prunes unnecessary context,
 * and budgets tokens for efficient LLM usage.
 *
 * Key principles:
 * - No loading entire repos blindly
 * - No massive raw context injections
 * - Always aim for < 50% context usage
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname, relative, basename } from 'node:path';
import type { ContextBudget, FileContext, OptimizationResult } from '@autic/shared';

export interface OptimizationOptions {
  maxTokens?: number;
  maxFiles?: number;
  priorityTags?: string[];
  includeConfigs?: boolean;
}

export class ContextOptimizer {
  private rootDir: string;

  // File extension → priority (higher = more relevant)
  private readonly EXTENSION_PRIORITY: Record<string, number> = {
    '.ts': 90,
    '.tsx': 90,
    '.js': 80,
    '.jsx': 80,
    '.py': 80,
    '.go': 80,
    '.rs': 80,
    '.json': 70,
    '.yaml': 60,
    '.yml': 60,
    '.toml': 60,
    '.md': 50,
    '.css': 40,
    '.scss': 40,
    '.html': 40,
  };

  // Config files always get high priority
  private readonly CONFIG_FILES = new Set([
    'package.json', 'tsconfig.json', '.env', '.env.example',
    'next.config.ts', 'next.config.js', 'vite.config.ts',
    'pnpm-workspace.yaml', 'docker-compose.yml', 'Dockerfile',
    'tailwind.config.ts', 'postcss.config.js',
  ]);

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Selectively retrieve relevant files for a given task context.
   * Returns an optimized set of files with relevance scores.
   */
  async selectFiles(
    taskDescription: string,
    options: OptimizationOptions = {},
  ): Promise<{ files: FileContext[]; result: OptimizationResult }> {
    const maxTokens = options.maxTokens || 32_000;
    const maxFiles = options.maxFiles || 15;
    const includeConfigs = options.includeConfigs ?? true;

    // Step 1: Get candidate files
    const candidates = await this.getCandidateFiles(includeConfigs);

    // Step 2: Score files by relevance to task
    const scored = await this.scoreFiles(candidates, taskDescription);

    // Step 3: Sort by relevance and apply token budget
    const sorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const selected: FileContext[] = [];
    let usedTokens = 0;

    for (const file of sorted) {
      if (selected.length >= maxFiles) break;
      if (usedTokens + file.tokenCount > maxTokens) break;
      selected.push(file);
      usedTokens += file.tokenCount;
    }

    // Step 4: Return optimization result
    const result: OptimizationResult = {
      originalTokens: scored.reduce((s, f) => s + f.tokenCount, 0),
      optimizedTokens: usedTokens,
      reduction: scored.reduce((s, f) => s + f.tokenCount, 0) - usedTokens,
      filesSelected: selected.length,
      filesTotal: scored.length,
      reductionPercentage: scored.length > 0
        ? `${Math.round(((scored.reduce((s, f) => s + f.tokenCount, 0) - usedTokens) / scored.reduce((s, f) => s + f.tokenCount, 0)) * 100)}%`
        : '0%',
    };

    return { files: selected, result };
  }

  /**
   * Get a context budget breakdown for the current state.
   */
  async getContextBudget(maxTokens = 32_000): Promise<ContextBudget> {
    const { result } = await this.selectFiles('', { maxTokens });
    const usedTokens = result.optimizedTokens;
    const remainingTokens = maxTokens - usedTokens;

    return {
      totalTokens: maxTokens,
      usedTokens,
      remainingTokens,
      breakdown: [
        {
          category: 'selected_files',
          tokens: usedTokens,
          percentage: Math.round((usedTokens / maxTokens) * 100),
        },
        {
          category: 'system_prompt',
          tokens: Math.round(maxTokens * 0.1), // Estimate ~10% for system prompt
          percentage: 10,
        },
        {
          category: 'conversation_history',
          tokens: Math.round(maxTokens * 0.15), // Estimate ~15% for history
          percentage: 15,
        },
        {
          category: 'available',
          tokens: remainingTokens,
          percentage: Math.round((remainingTokens / maxTokens) * 100),
        },
      ],
    };
  }

  /**
   * Prune conversation context — remove redundant or low-value messages.
   */
  pruneMessages<T extends { role: string; content: string; timestamp?: number }>(
    messages: T[],
    options: { maxMessages?: number; maxTokens?: number } = {},
  ): T[] {
    const maxMessages = options.maxMessages || 40;
    const maxTokens = options.maxTokens || 16_000;

    if (messages.length <= maxMessages) return messages;

    // Keep system messages, first few, and most recent
    const systemMsgs = messages.filter((m) => m.role === 'system' || m.role === 'developer');
    const nonSystem = messages.filter((m) => m.role !== 'system' && m.role !== 'developer');

    // Keep first 3 non-system messages (usually user context)
    const firstBatch = nonSystem.slice(0, 3);

    // Keep last (maxMessages - systemMsgs.length - firstBatch.length) messages
    const remaining = maxMessages - systemMsgs.length - firstBatch.length;
    const lastBatch = nonSystem.slice(Math.max(0, nonSystem.length - remaining));

    const pruned = [...systemMsgs, ...firstBatch, ...lastBatch];

    // If still over token budget, remove from middle
    let totalTokens = pruned.reduce((sum, m) => sum + Math.ceil(m.content.length / 3), 0);
    if (totalTokens > maxTokens) {
      // Remove middle messages (between first batch and last batch)
      const middle = pruned.slice(systemMsgs.length + firstBatch.length, pruned.length - lastBatch.length);
      for (const msg of middle) {
        if (totalTokens <= maxTokens) break;
        const idx = pruned.indexOf(msg);
        if (idx > -1) {
          pruned.splice(idx, 1);
          totalTokens -= Math.ceil(msg.content.length / 3);
        }
      }
    }

    return pruned;
  }

  /**
   * Optimize a file list — deduplicate, prioritize, and validate.
   */
  optimizeFileList(filePaths: string[], options: { maxFiles?: number } = {}): string[] {
    const maxFiles = options.maxFiles || 20;

    // Deduplicate and resolve to absolute
    const unique = [...new Set(filePaths.map((f) => join(this.rootDir, f)))];

    // Sort by priority (config files first, then source files)
    const scored = unique.map((f) => {
      const ext = extname(f).toLowerCase();
      const base = basename(f);
      let priority = this.EXTENSION_PRIORITY[ext] || 30;

      // Config files get boost
      if (this.CONFIG_FILES.has(base)) priority += 20;

      // Source files get moderate boost
      if (f.includes('/src/') || f.includes('/lib/') || !f.includes('/node_modules/')) {
        priority += 10;
      }

      return { path: f, priority, relative: relative(this.rootDir, f) };
    });

    // Sort by priority descending, then by relative path
    scored.sort((a, b) => b.priority - a.priority || a.relative.localeCompare(b.relative));

    return scored.slice(0, maxFiles).map((f) => f.relative);
  }

  // ---- Private helpers ----

  private async getCandidateFiles(includeConfigs: boolean): Promise<string[]> {
    const candidates: string[] = [];

    if (includeConfigs) {
      for (const cf of this.CONFIG_FILES) {
        const fullPath = join(this.rootDir, cf);
        if (existsSync(fullPath)) {
          candidates.push(cf);
        }
      }
    }

    // Add source directories
    const sourceDirs = ['src', 'lib', 'app', 'components', 'pages', 'packages'];
    for (const dir of sourceDirs) {
      await this.collectSourceFiles(join(this.rootDir, dir), candidates, 3);
    }

    return candidates;
  }

  private async collectSourceFiles(
    dir: string,
    files: string[],
    maxDepth: number,
    currentDepth = 0,
  ): Promise<void> {
    if (currentDepth > maxDepth) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = join(dir, entry.name);
        const relPath = relative(this.rootDir, fullPath);
        if (entry.isDirectory()) {
          await this.collectSourceFiles(fullPath, files, maxDepth, currentDepth + 1);
        } else {
          files.push(relPath);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  private async scoreFiles(
    filePaths: string[],
    taskDescription: string,
  ): Promise<FileContext[]> {
    const taskLower = taskDescription.toLowerCase();
    const taskKeywords = taskLower.split(/\s+/).filter((w) => w.length > 3);

    const scored: FileContext[] = [];

    for (const filePath of filePaths) {
      try {
        const fullPath = join(this.rootDir, filePath);
        const content = await readFile(fullPath, 'utf-8');
        const ext = extname(filePath).toLowerCase();
        const basePriority = this.EXTENSION_PRIORITY[ext] || 30;

        // Calculate relevance score based on keyword matches
        let relevanceBoost = 0;
        const contentLower = content.toLowerCase();

        // Check if filename matches task keywords
        for (const kw of taskKeywords) {
          if (filePath.toLowerCase().includes(kw)) {
            relevanceBoost += 15;
          }
          // Check content for keyword density
          const matches = (contentLower.match(new RegExp(kw, 'g')) || []).length;
          relevanceBoost += Math.min(matches, 10);
        }

        // Compute token count
        const tokenCount = Math.ceil(content.length / 3);

        scored.push({
          path: filePath,
          priority: basePriority,
          relevanceScore: Math.min(basePriority + relevanceBoost, 100),
          tokenCount,
          reason: relevanceBoost > 15
            ? 'High keyword relevance'
            : relevanceBoost > 5
              ? 'Moderate relevance'
              : 'General source file',
        });
      } catch {
        // Skip files we can't read
      }
    }

    return scored;
  }
}

/**
 * SelectiveFileRetrieval — Dependency-aware file targeting (#3)
 *
 * Retrieves relevant files for context assembly using:
 *   - Dependency graph analysis (import tracking)
 *   - Execution-stage-aware filtering
 *   - Changed-file prioritization
 *   - Architecture-aware targeting
 *   - File extension and role scoring
 *
 * Never loads full repos blindly — always bounded and targeted.
 */

import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import type { FileContext } from '@autic/shared';

export interface RetrievalOptions {
  maxFiles?: number;
  maxTokens?: number;
  prioritizeChanged?: boolean;
  trackImports?: boolean;
}

interface ImportGraphEntry {
  file: string;
  imports: string[];
  importedBy: string[];
}

export class SelectiveFileRetrieval {
  private rootDir: string;
  private importGraph: Map<string, ImportGraphEntry> = new Map();

  // Priority by extension and role
  private readonly FILE_PRIORITY: Record<string, number> = {
    '.ts': 90,
    '.tsx': 90,
    '.js': 80,
    '.jsx': 80,
    '.py': 80,
    '.go': 80,
    '.rs': 80,
    '.json': 50,
    '.yaml': 40,
    '.toml': 40,
    '.md': 30,
    '.css': 20,
    '.html': 20,
  };

  // Stage-specific file relevance tags
  private readonly STAGE_KEYWORDS: Record<string, string[]> = {
    engineering: ['src/', 'lib/', 'component', 'util', 'helper'],
    verification: ['test', 'spec', 'config', 'tsconfig', 'package.json'],
    architecture: ['package.json', 'tsconfig', 'next.config', 'vite.config'],
    repair: ['error', 'fix', 'patch', 'debug'],
    research: ['readme', 'doc', 'guide', 'api'],
  };

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Retrieve relevant files for a given goal and stage.
   */
  async retrieveFiles(
    goal: string,
    stage?: string,
    explicitFiles?: string[],
    options: RetrievalOptions = {},
  ): Promise<FileContext[]> {
    const maxFiles = options.maxFiles || 15;
    const maxTokens = options.maxTokens || 48_000;

    // Build import graph if not yet done
    if (options.trackImports ?? true) {
      await this.buildImportGraph();
    }

    // Get candidate files
    const candidates = await this.getCandidates(explicitFiles);
    const scored = await this.scoreFiles(candidates, goal, stage);

    // Sort by relevance
    const sorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply budget
    const selected: FileContext[] = [];
    let usedTokens = 0;

    for (const file of sorted) {
      if (selected.length >= maxFiles) break;
      if (usedTokens + file.tokenCount > maxTokens) break;
      selected.push(file);
      usedTokens += file.tokenCount;
    }

    return selected;
  }

  /**
   * Build import graph for dependency-aware retrieval.
   */
  async buildImportGraph(): Promise<void> {
    this.importGraph.clear();
    const sourceFiles: string[] = [];
    await this.collectSourceFiles(this.rootDir, sourceFiles, 5);

    for (const file of sourceFiles) {
      try {
        const content = await readFile(join(this.rootDir, file), 'utf-8');
        const imports = this.extractImports(content);

        const entry = this.importGraph.get(file) || {
          file,
          imports: [],
          importedBy: [],
        };
        entry.imports = imports;

        // Track reverse dependencies
        for (const imp of imports) {
          const target = this.importGraph.get(imp) || {
            file: imp,
            imports: [],
            importedBy: [],
          };
          target.importedBy.push(file);
          this.importGraph.set(imp, target);
        }

        this.importGraph.set(file, entry);
      } catch {
        // Skip unreadable files
      }
    }
  }

  /**
   * Get import graph for inspection.
   */
  getImportGraph(): Map<string, ImportGraphEntry> {
    return this.importGraph;
  }

  // ---- Private Helpers ----

  private async getCandidates(explicitFiles?: string[]): Promise<string[]> {
    if (explicitFiles && explicitFiles.length > 0) {
      return explicitFiles.filter((f) => existsSync(join(this.rootDir, f)));
    }

    const candidates: string[] = [];

    // Collect from source directories
    const sourceDirs = ['src', 'lib', 'app', 'packages', 'components', 'pages'];
    for (const dir of sourceDirs) {
      await this.collectSourceFiles(join(this.rootDir, dir), candidates, 4);
    }

    return candidates;
  }

  private async collectSourceFiles(
    dir: string,
    files: string[],
    maxDepth: number,
    depth = 0,
  ): Promise<void> {
    if (depth > maxDepth) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
          continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectSourceFiles(fullPath, files, maxDepth, depth + 1);
        } else {
          const rel = relative(this.rootDir, fullPath);
          files.push(rel);
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  private async scoreFiles(files: string[], goal: string, stage?: string): Promise<FileContext[]> {
    const goalLower = goal.toLowerCase();
    const goalWords = goalLower.split(/\s+/).filter((w) => w.length > 3);
    const stageTags = stage ? this.STAGE_KEYWORDS[stage] || [] : [];

    const scored: FileContext[] = [];
    const batchSize = 20;

    // Process in batches to avoid overwhelming the filesystem
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (file) => {
          try {
            const fullPath = join(this.rootDir, file);
            const content = await readFile(fullPath, 'utf-8');
            const ext = extname(file).toLowerCase();
            const basePriority = this.FILE_PRIORITY[ext] || 30;
            const contentLower = content.toLowerCase();

            let relevanceBoost = 0;

            // Goal keyword matching
            for (const kw of goalWords) {
              if (file.toLowerCase().includes(kw)) relevanceBoost += 20;
              const matches = (
                contentLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []
              ).length;
              relevanceBoost += Math.min(matches * 2, 15);
            }

            // Stage-specific boosting
            for (const tag of stageTags) {
              if (file.includes(tag)) relevanceBoost += 10;
            }

            // Import graph boosting (depends on how many files import this)
            const graphEntry = this.importGraph.get(file);
            if (graphEntry) {
              relevanceBoost += Math.min(graphEntry.importedBy.length * 5, 20);
            }

            // Architecture-aware: config files and entry points get boost
            const baseName = basename(file);
            if (
              ['package.json', 'tsconfig.json', 'next.config.ts', 'vite.config.ts'].includes(
                baseName,
              )
            ) {
              relevanceBoost += 15;
            }
            if (file.includes('/index.') || file.includes('/main.')) {
              relevanceBoost += 10;
            }

            const tokenCount = Math.ceil(content.length / 3);

            return {
              path: file,
              priority: basePriority,
              relevanceScore: Math.min(basePriority + relevanceBoost, 100),
              tokenCount,
              reason:
                relevanceBoost > 20
                  ? 'High relevance'
                  : relevanceBoost > 10
                    ? 'Moderate relevance'
                    : 'General source',
            };
          } catch {
            return null;
          }
        }),
      );

      for (const r of results) {
        if (r) scored.push(r);
      }
    }

    return scored;
  }

  private extractImports(content: string): string[] {
    const imports: string[] = [];
    // TypeScript/JavaScript imports
    const tsPatterns = [
      /from\s+['"]([^'"]+)['"]/g,
      /import\s+['"]([^'"]+)['"]/g,
      /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];

    for (const pattern of tsPatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(content)) !== null) {
        const mod = match[1];
        // Only track relative imports (project files)
        if (mod.startsWith('.')) {
          imports.push(mod);
        }
      }
    }

    return imports;
  }
}

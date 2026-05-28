/**
 * ContextSelector — Selective workspace file targeting for autonomous workflows.
 *
 * Goals:
 *   - Select only relevant files for a given task
 *   - Avoid full repo injection to reduce token waste
 *   - Dependency-aware retrieval (config files first, then sources)
 *   - Lightweight repo scanning without massive reads
 *
 * Selection strategy:
 *   1. Config files (always high priority)
 *   2. Source files matching task keywords
 *   3. Recently modified files
 *   4. Dependency files (package.json imports, etc.)
 */

import { existsSync } from 'node:fs';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname, basename, relative } from 'node:path';

export interface ContextSelection {
  files: SelectedFile[];
  totalCandidates: number;
  totalTokens: number;
  strategy: string;
}

export interface SelectedFile {
  path: string;
  reason: string;
  priority: number;
  tokenEstimate: number;
}

export class ContextSelector {
  private rootDir: string;

  // High-priority config files to always include
  private readonly CONFIG_FILES = new Set([
    'package.json',
    'tsconfig.json',
    'pnpm-workspace.yaml',
    '.env',
    '.env.example',
    'next.config.ts',
    'vite.config.ts',
    'docker-compose.yml',
    'Dockerfile',
    'Makefile',
    'tailwind.config.ts',
    'tailwind.config.js',
    '.eslintrc.json',
    '.eslintrc.js',
    '.prettierrc',
    'Cargo.toml',
    'Gemfile',
    'requirements.txt',
  ]);

  // File extensions by scanning priority
  private readonly EXT_SCORE: Record<string, number> = {
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
  };

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Select files relevant to a task description.
   * Returns an ordered list of files to include in context.
   */
  async selectForTask(
    taskDescription: string,
    options: {
      maxFiles?: number;
      maxTokens?: number;
      includeConfigs?: boolean;
      scanDepth?: number;
    } = {},
  ): Promise<ContextSelection> {
    const maxFiles = options.maxFiles || 15;
    const maxTokens = options.maxTokens || 16_000;
    const includeConfigs = options.includeConfigs ?? true;
    const scanDepth = options.scanDepth || 3;

    const candidates = await this.gatherCandidates(includeConfigs, scanDepth);
    const scored = await this.scoreCandidates(candidates, taskDescription);

    // Sort by priority descending
    scored.sort((a, b) => b.priority - a.priority);

    const selected: SelectedFile[] = [];
    let totalTokens = 0;

    for (const file of scored) {
      if (selected.length >= maxFiles) break;
      if (totalTokens + file.tokenEstimate > maxTokens) break;
      selected.push(file);
      totalTokens += file.tokenEstimate;
    }

    return {
      files: selected,
      totalCandidates: scored.length,
      totalTokens,
      strategy:
        selected.length > 0
          ? `Selected ${selected.length}/${scored.length} files (~${Math.round(totalTokens / 1000)}K tokens)`
          : 'No relevant files found',
    };
  }

  /**
   * Get a dependency-aware file list with import tracking.
   * Useful for understanding project structure before execution.
   */
  async getDependencyFiles(entryPoints: string[], maxFiles = 10): Promise<SelectedFile[]> {
    const selected: SelectedFile[] = [];
    const visited = new Set<string>();

    for (const entry of entryPoints) {
      if (selected.length >= maxFiles) break;
      await this.resolveImports(entry, selected, visited, maxFiles, 0);
    }

    return selected;
  }

  /**
   * Quick scan for recently modified source files.
   */
  async getRecentFiles(maxFiles = 5): Promise<SelectedFile[]> {
    const sourceDirs = ['src', 'lib', 'app', 'packages', 'components'];
    const candidates: Array<{ path: string; mtime: number }> = [];

    for (const dir of sourceDirs) {
      await this.collectRecentFiles(join(this.rootDir, dir), candidates, 2);
    }

    candidates.sort((a, b) => b.mtime - a.mtime);

    return candidates.slice(0, maxFiles).map((c) => ({
      path: relative(this.rootDir, c.path),
      reason: 'Recently modified',
      priority: 75,
      tokenEstimate: 500,
    }));
  }

  // ---- Private: File gathering ----

  private async gatherCandidates(includeConfigs: boolean, scanDepth: number): Promise<string[]> {
    const candidates: string[] = [];

    if (includeConfigs) {
      for (const cf of this.CONFIG_FILES) {
        const fullPath = join(this.rootDir, cf);
        if (existsSync(fullPath)) {
          candidates.push(cf);
        }
      }
    }

    // Scan source directories
    const sourceDirs = ['src', 'lib', 'app', 'packages', 'components', 'pages'];
    for (const dir of sourceDirs) {
      await this.collectFiles(join(this.rootDir, dir), candidates, scanDepth);
    }

    return candidates;
  }

  private async collectFiles(
    dir: string,
    files: string[],
    maxDepth: number,
    depth = 0,
  ): Promise<void> {
    if (depth > maxDepth) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, files, maxDepth, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (this.EXT_SCORE[ext]) {
            files.push(relative(this.rootDir, fullPath));
          }
        }
      }
    } catch {
      // Directory doesn't exist or permission denied
    }
  }

  private async collectRecentFiles(
    dir: string,
    candidates: Array<{ path: string; mtime: number }>,
    maxDepth: number,
    depth = 0,
  ): Promise<void> {
    if (depth > maxDepth) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') {
          continue;
        }
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectRecentFiles(fullPath, candidates, maxDepth, depth + 1);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).toLowerCase();
          if (this.EXT_SCORE[ext]) {
            try {
              const s = await stat(fullPath);
              candidates.push({ path: fullPath, mtime: s.mtimeMs });
            } catch {
              // Skip unreadable files
            }
          }
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }

  // ---- Private: Scoring ----

  private async scoreCandidates(
    filePaths: string[],
    taskDescription: string,
  ): Promise<SelectedFile[]> {
    const taskLower = taskDescription.toLowerCase();
    const keywords = taskLower.split(/\s+/).filter((w) => w.length > 3);

    const scored: SelectedFile[] = [];

    for (const filePath of filePaths) {
      const ext = extname(filePath).toLowerCase();
      const base = basename(filePath);
      const baseScore = this.EXT_SCORE[ext] || 30;
      let priority = baseScore;

      // Config files get boost
      if (this.CONFIG_FILES.has(base)) {
        priority += 25;
      }

      // Task keyword matches in filename
      let bestKeywordMatch = '';
      for (const kw of keywords) {
        if (filePath.toLowerCase().includes(kw)) {
          priority += 15;
          bestKeywordMatch = kw;
        }
      }

      // Try to read first few lines for content scoring
      let contentScore = 0;
      try {
        const fullPath = join(this.rootDir, filePath);
        const content = await readFile(fullPath, 'utf-8');
        const contentLower = content.toLowerCase();

        for (const kw of keywords) {
          const matches = (
            contentLower.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []
          ).length;
          contentScore += Math.min(matches * 2, 10);
        }

        // Cap content score
        contentScore = Math.min(contentScore, 30);
        priority += contentScore;
      } catch {
        // Can't read file — score may be lower
      }

      // Token estimate
      const tokenEstimate = Math.ceil((await this.estimateTokenCount(filePath)) / 3) * 3;

      const reason = this.composeReason(baseScore, contentScore, bestKeywordMatch, base);

      scored.push({
        path: filePath,
        reason,
        priority: Math.min(priority, 100),
        tokenEstimate,
      });
    }

    return scored;
  }

  private async resolveImports(
    filePath: string,
    selected: SelectedFile[],
    visited: Set<string>,
    maxFiles: number,
    depth: number,
  ): Promise<void> {
    if (depth > 3 || selected.length >= maxFiles || visited.has(filePath)) return;
    visited.add(filePath);

    try {
      const fullPath = join(this.rootDir, filePath);
      const content = await readFile(fullPath, 'utf-8');

      selected.push({
        path: filePath,
        reason: depth === 0 ? 'Entry point' : `Imported by ${basename(filePath)}`,
        priority: Math.max(80 - depth * 10, 40),
        tokenEstimate: Math.ceil(content.length / 3),
      });

      // Extract import statements — matches both ./ and ../ relative imports
      const importRegex = /from\s+['"](\.\.?\/.+?)['"]|require\(['"](\.\.?\/.+?)['"]\)/g;
      let match: RegExpExecArray | null;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1] || match[2];
        const resolved = this.resolveRelativePath(filePath, importPath);
        if (resolved && !visited.has(resolved)) {
          await this.resolveImports(resolved, selected, visited, maxFiles, depth + 1);
        }
      }
    } catch {
      // Can't read file
    }
  }

  // ---- Private: Helpers ----

  private composeReason(
    baseScore: number,
    contentScore: number,
    keyword: string,
    base: string,
  ): string {
    if (keyword) return `Matches task keyword "${keyword}"`;
    if (this.CONFIG_FILES.has(base)) return 'Configuration file (high priority)';
    if (contentScore > 15) return 'High content relevance';
    if (contentScore > 5) return 'Moderate content relevance';
    if (baseScore >= 80) return 'Source file';
    return 'Supporting file';
  }

  private async estimateTokenCount(filePath: string): Promise<number> {
    try {
      const fullPath = join(this.rootDir, filePath);
      const content = await readFile(fullPath, 'utf-8');
      return Math.ceil(content.length / 3);
    } catch {
      return 500;
    }
  }

  private resolveRelativePath(fromFile: string, importPath: string): string | null {
    const dir = join(this.rootDir, this.getDir(fromFile));
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js'];

    for (const ext of extensions) {
      const resolved = join(dir, `${importPath}${ext}`);
      if (existsSync(resolved)) {
        return relative(this.rootDir, resolved);
      }
    }

    return null;
  }

  private getDir(filePath: string): string {
    const idx = filePath.lastIndexOf('/');
    return idx >= 0 ? filePath.slice(0, idx) : '.';
  }
}

/**
 * RepoChunkingSystem — Scalable repo chunking architecture (#6)
 *
 * Divides source files into modular chunks for efficient retrieval:
 *   - Import blocks, type definitions, implementations, exports
 *   - Dependency-aware chunk boundaries
 *   - Incremental indexing (only re-index changed files)
 *   - Bounded memory usage (max 10,000 chunks)
 *
 * Enables safe scaling to large repositories without loading everything.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, extname } from 'node:path';
import type { FileChunk, ChunkMetadata } from '@autic/shared';
import { generateId } from '@autic/shared';

interface FileIndexEntry {
  path: string;
  lastModified: number;
  chunkIds: string[];
}

export class RepoChunkingSystem {
  private rootDir: string;
  private chunks: Map<string, FileChunk> = new Map();
  private fileIndex: Map<string, FileIndexEntry> = new Map();
  private maxChunks = 10_000;
  private lastFullIndexAt = 0;
  private readonly indexCooldownMs = 30_000;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Index source files and create chunks.
   */
  async index(options: { force?: boolean; maxFiles?: number } = {}): Promise<number> {
    const now = Date.now();
    if (
      !options.force &&
      this.chunks.size > 0 &&
      now - this.lastFullIndexAt < this.indexCooldownMs
    ) {
      return this.chunks.size;
    }

    const maxFiles = options.maxFiles || 500;
    const files: string[] = [];
    await this.collectFiles(this.rootDir, files, maxFiles);

    let chunkCount = 0;
    for (const filePath of files) {
      // Check if file needs re-indexing
      const existing = this.fileIndex.get(filePath);
      const stat = await this.getFileModifiedTime(filePath);
      if (existing && existing.lastModified === stat) continue;

      // Remove old chunks for this file
      if (existing) {
        for (const cid of existing.chunkIds) {
          this.chunks.delete(cid);
        }
      }

      // Create new chunks
      const fileChunks = await this.chunkFile(filePath);
      this.fileIndex.set(filePath, {
        path: filePath,
        lastModified: stat,
        chunkIds: fileChunks.map((c) => c.id),
      });

      for (const chunk of fileChunks) {
        if (this.chunks.size >= this.maxChunks) break;
        this.chunks.set(chunk.id, chunk);
        chunkCount++;
      }
    }

    this.lastFullIndexAt = now;
    return chunkCount;
  }

  /**
   * Get chunks relevant to a set of files.
   */
  getChunksForFiles(filePaths: string[], maxTokens = 16_000): FileChunk[] {
    const result: FileChunk[] = [];
    let tokens = 0;

    for (const fp of filePaths) {
      const entry = this.fileIndex.get(fp);
      if (!entry) continue;

      for (const cid of entry.chunkIds) {
        const chunk = this.chunks.get(cid);
        if (!chunk) continue;
        if (tokens + chunk.tokenCount > maxTokens) continue;
        result.push(chunk);
        tokens += chunk.tokenCount;
      }
    }

    return result.sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Get chunk by ID.
   */
  getChunk(id: string): FileChunk | undefined {
    return this.chunks.get(id);
  }

  /**
   * Search chunks by metadata type.
   */
  searchByType(type: ChunkMetadata['type']): FileChunk[] {
    return Array.from(this.chunks.values())
      .filter((c) => c.metadata.type === type)
      .sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Get indexed file count.
   */
  getIndexedFileCount(): number {
    return this.fileIndex.size;
  }

  /**
   * Get total chunk count.
   */
  getChunkCount(): number {
    return this.chunks.size;
  }

  /**
   * Get index stats.
   */
  getStats(): { files: number; chunks: number; totalTokens: number } {
    const totalTokens = Array.from(this.chunks.values()).reduce((s, c) => s + c.tokenCount, 0);
    return {
      files: this.fileIndex.size,
      chunks: this.chunks.size,
      totalTokens,
    };
  }

  // ---- Private Helpers ----

  private async collectFiles(dir: string, files: string[], maxFiles: number): Promise<void> {
    if (files.length >= maxFiles) return;
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= maxFiles) return;
        if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist')
          continue;
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await this.collectFiles(fullPath, files, maxFiles);
        } else {
          const extName = extname(entry.name).toLowerCase();
          if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs'].includes(extName)) {
            files.push(relative(this.rootDir, fullPath));
          }
        }
      }
    } catch {
      /* skip */
    }
  }

  private async chunkFile(filePath: string): Promise<FileChunk[]> {
    try {
      const content = await readFile(join(this.rootDir, filePath), 'utf-8');
      const lines = content.split('\n');
      const chunks: FileChunk[] = [];

      // Chunk 1: Imports section (first block of import/require statements)
      const importLines: string[] = [];
      let i = 0;
      for (; i < lines.length; i++) {
        if (/^(import|from|require|const\s+\w+\s*=\s*require)/.test(lines[i].trim())) {
          importLines.push(lines[i]);
        } else if (importLines.length > 0 && lines[i].trim() === '') {
          importLines.push(lines[i]);
        } else if (importLines.length > 0 && lines[i].trim() !== '') {
          if (i > 0 && lines[i - 1].trim() === '') {
            break; // Reached end of import block
          }
          importLines.push(lines[i]);
        }
      }

      if (importLines.length > 0) {
        const importDeps = this.extractImportPaths(importLines.join('\n'));
        chunks.push({
          id: generateId(),
          sourceFile: filePath,
          content: importLines.join('\n'),
          startLine: 0,
          endLine: i,
          tokenCount: Math.ceil(importLines.join('\n').length / 3),
          metadata: {
            type: 'imports',
            dependencies: importDeps,
            exports: [],
            priority: 80,
          },
        });
      }

      // Chunk 2: Exports and type definitions
      const exportLines: string[] = [];
      for (const [, line] of lines.entries()) {
        if (/^(export|interface|type\s+\w+\s*=)/.test(line.trim())) {
          exportLines.push(line);
        }
      }

      if (exportLines.length > 0) {
        const exports = exportLines
          .filter((l) => l.includes('export'))
          .map((l) => {
            const m = l.match(
              /export\s+(?:default\s+)?(?:function|class|const|interface|type)\s+(\w+)/,
            );
            return m ? m[1] : '';
          })
          .filter(Boolean);

        chunks.push({
          id: generateId(),
          sourceFile: filePath,
          content: exportLines.join('\n'),
          startLine: 0,
          endLine: lines.length,
          tokenCount: Math.ceil(exportLines.join('\n').length / 3),
          metadata: {
            type: 'exports',
            dependencies: [],
            exports,
            priority: 90,
          },
        });
      }

      // Chunk 3: Main implementation (everything else)
      const implLines = lines.slice(i).filter((l) => l.trim().length > 0);
      if (implLines.length > 0) {
        chunks.push({
          id: generateId(),
          sourceFile: filePath,
          content: implLines.join('\n'),
          startLine: i,
          endLine: lines.length,
          tokenCount: Math.ceil(implLines.join('\n').length / 3),
          metadata: {
            type: 'implementation',
            dependencies: [],
            exports: [],
            priority: 70,
          },
        });
      }

      return chunks;
    } catch {
      return [];
    }
  }

  private extractImportPaths(content: string): string[] {
    const deps: string[] = [];
    const patterns = [/from\s+['"]([^'"]+)['"]/g, /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g];
    for (const pattern of patterns) {
      let m: RegExpExecArray | null;
      while ((m = pattern.exec(content)) !== null) {
        if (!m[1].startsWith('.')) deps.push(m[1]);
      }
    }
    return [...new Set(deps)];
  }

  private async getFileModifiedTime(filePath: string): Promise<number> {
    try {
      const { stat } = await import('node:fs/promises');
      const s = await stat(join(this.rootDir, filePath));
      return s.mtimeMs;
    } catch {
      return 0;
    }
  }
}

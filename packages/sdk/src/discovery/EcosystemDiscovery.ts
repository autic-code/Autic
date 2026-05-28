/**
 * Ecosystem Discovery — local-first extension discovery system.
 *
 * Discovers installed extensions on the local filesystem,
 * reads their manifests, and provides metadata for the
 * extension registry. No mandatory cloud marketplace.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { timestamp } from '@autic/shared';
import type { ExtensionManifest } from '../extension/ExtensionManifest.js';

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  /** Directories to scan for extensions */
  scanPaths: string[];
  /** Maximum depth to scan (default: 3) */
  maxDepth: number;
  /** Manifest file name to look for (default: autic-extension.json) */
  manifestFileName: string;
  /** Whether to scan hidden directories (default: false) */
  scanHidden: boolean;
  /** File patterns to exclude */
  excludePatterns: string[];
}

/**
 * Discovered extension metadata
 */
export interface DiscoveredExtension {
  /** Extension ID from manifest */
  id: string;
  /** Extension name */
  name: string;
  /** Version */
  version: string;
  /** Type */
  type: string;
  /** Description */
  description: string;
  /** Path to extension directory */
  path: string;
  /** Path to manifest file */
  manifestPath: string;
  /** File size of manifest in bytes */
  manifestSize: number;
  /** Timestamp of discovery */
  discoveredAt: number;
  /** Full manifest */
  manifest: ExtensionManifest;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  /** Successfully discovered extensions */
  discovered: DiscoveredExtension[];
  /** Directories that failed to load */
  failed: Array<{ path: string; error: string }>;
  /** Total scan time in ms */
  scanTimeMs: number;
  /** Number of directories scanned */
  scanned: number;
}

/**
 * Default discovery configuration
 */
const DEFAULT_CONFIG: DiscoveryConfig = {
  scanPaths: [],
  maxDepth: 3,
  manifestFileName: 'autic-extension.json',
  scanHidden: false,
  excludePatterns: ['node_modules', 'dist', '.git', '.svn'],
};

/**
 * Ecosystem Discovery — local-first extension discovery
 */
export class EcosystemDiscovery {
  private config: DiscoveryConfig;

  constructor(config?: Partial<DiscoveryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Scan configured paths for extensions
   */
  async scan(): Promise<DiscoveryResult> {
    const startTime = timestamp();
    const discovered: DiscoveredExtension[] = [];
    const failed: Array<{ path: string; error: string }> = [];
    let scanned = 0;

    for (const scanPath of this.config.scanPaths) {
      if (!fs.existsSync(scanPath)) {
        continue;
      }

      const stat = fs.statSync(scanPath);
      if (!stat.isDirectory()) {
        continue;
      }

      const entries = this.scanDirectory(scanPath, 0);
      scanned += entries.length;

      for (const entry of entries) {
        const manifestPath = path.join(entry, this.config.manifestFileName);

        if (!fs.existsSync(manifestPath)) {
          continue;
        }

        try {
          const content = fs.readFileSync(manifestPath, 'utf-8');
          const manifest = JSON.parse(content) as ExtensionManifest;
          const manifestSize = Buffer.byteLength(content, 'utf-8');

          if (!manifest.id || !manifest.name) {
            failed.push({
              path: entry,
              error: 'Invalid manifest: missing id or name',
            });
            continue;
          }

          discovered.push({
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
            type: manifest.type,
            description: manifest.description,
            path: entry,
            manifestPath,
            manifestSize,
            discoveredAt: timestamp(),
            manifest,
          });
        } catch (err) {
          failed.push({
            path: entry,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      discovered,
      failed,
      scanTimeMs: timestamp() - startTime,
      scanned,
    };
  }

  /**
   * Scan a directory recursively for potential extension directories
   */
  private scanDirectory(dirPath: string, depth: number): string[] {
    if (depth > this.config.maxDepth) {
      return [];
    }

    const entries: string[] = [];
    let dirContents: fs.Dirent[];

    try {
      dirContents = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return entries;
    }

    for (const entry of dirContents) {
      if (!entry.isDirectory()) {
        continue;
      }

      // Skip hidden directories
      if (!this.config.scanHidden && entry.name.startsWith('.')) {
        continue;
      }

      // Skip excluded patterns
      if (this.config.excludePatterns.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const manifestPath = path.join(fullPath, this.config.manifestFileName);

      if (fs.existsSync(manifestPath)) {
        entries.push(fullPath);
      }

      // Recurse if we haven't found a manifest here
      if (!fs.existsSync(manifestPath)) {
        entries.push(...this.scanDirectory(fullPath, depth + 1));
      }
    }

    return entries;
  }

  /**
   * Update configuration
   */
  configure(config: Partial<DiscoveryConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

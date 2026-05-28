/**
 * Extension Loader — safely loads extensions from disk,
 * validates manifests, and manages module imports within
 * bounded runtime constraints.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExtensionManifest } from './ExtensionManifest.js';
import { validateManifest } from './ExtensionManifest.js';

/**
 * Extension loading configuration
 */
export interface ExtensionLoaderConfig {
  /** Directories to search for extensions */
  searchPaths: string[];
  /** Maximum extension size in bytes (default: 10MB) */
  maxExtensionSize?: number;
  /** Allowed file extensions for extension entry points */
  allowedExtensions?: string[];
  /** Whether to allow extensions outside search paths */
  restrictToPaths?: boolean;
  /** Maximum number of extensions to load */
  maxExtensions?: number;
}

/**
 * Extension load result
 */
export interface ExtensionLoadResult {
  /** The loaded manifest */
  manifest: ExtensionManifest;
  /** Path to the extension directory */
  extensionPath: string;
  /** Whether the load was successful */
  success: boolean;
  /** Error message if load failed */
  error?: string;
  /** Validation warnings */
  warnings: string[];
}

/**
 * Default extension loader configuration
 */
const DEFAULT_CONFIG: ExtensionLoaderConfig = {
  searchPaths: [],
  maxExtensionSize: 10 * 1024 * 1024, // 10MB
  allowedExtensions: ['.js', '.mjs', '.cjs'],
  restrictToPaths: true,
  maxExtensions: 100,
};

/**
 * Extension Loader — safe, validated extension loading
 */
export class ExtensionLoader {
  private config: ExtensionLoaderConfig;
  private loaded: Map<string, ExtensionLoadResult> = new Map();

  constructor(config?: Partial<ExtensionLoaderConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Load all extensions from configured search paths
   */
  async loadAll(): Promise<ExtensionLoadResult[]> {
    const results: ExtensionLoadResult[] = [];

    for (const searchPath of this.config.searchPaths) {
      if (!fs.existsSync(searchPath)) {
        continue;
      }

      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        if (this.loaded.size >= (this.config.maxExtensions ?? 100)) {
          break;
        }

        const result = await this.loadFromDirectory(path.join(searchPath, entry.name));
        results.push(result);

        if (result.success) {
          this.loaded.set(result.manifest.id, result);
        }
      }
    }

    return results;
  }

  /**
   * Load a single extension from a directory
   */
  async loadFromDirectory(extensionDir: string): Promise<ExtensionLoadResult> {
    const manifestPath = path.join(extensionDir, 'autic-extension.json');
    const warnings: string[] = [];

    // Check extension directory exists
    if (!fs.existsSync(extensionDir)) {
      return {
        manifest: {} as ExtensionManifest,
        extensionPath: extensionDir,
        success: false,
        error: 'Extension directory not found',
        warnings: [],
      };
    }

    // Check manifest exists
    if (!fs.existsSync(manifestPath)) {
      return {
        manifest: {} as ExtensionManifest,
        extensionPath: extensionDir,
        success: false,
        error: 'Extension manifest (autic-extension.json) not found',
        warnings: [],
      };
    }

    // Read manifest
    let manifest: Partial<ExtensionManifest>;
    try {
      const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
      const manifestSize = Buffer.byteLength(manifestContent, 'utf-8');

      if (manifestSize > (this.config.maxExtensionSize ?? 10 * 1024 * 1024)) {
        return {
          manifest: {} as ExtensionManifest,
          extensionPath: extensionDir,
          success: false,
          error: `Extension manifest exceeds size limit (${manifestSize} bytes)`,
          warnings: [],
        };
      }

      manifest = JSON.parse(manifestContent);
    } catch (err) {
      return {
        manifest: {} as ExtensionManifest,
        extensionPath: extensionDir,
        success: false,
        error: `Failed to parse manifest: ${err instanceof Error ? err.message : String(err)}`,
        warnings: [],
      };
    }

    // Validate manifest
    const validation = validateManifest(manifest);
    warnings.push(...validation.warnings);

    if (!validation.valid) {
      return {
        manifest: manifest as ExtensionManifest,
        extensionPath: extensionDir,
        success: false,
        error: `Manifest validation failed: ${validation.errors.join('; ')}`,
        warnings,
      };
    }

    const fullManifest = manifest as ExtensionManifest;

    // Check entry point exists
    const entryPath = path.resolve(extensionDir, fullManifest.entryPoint);
    if (!fs.existsSync(entryPath)) {
      return {
        manifest: fullManifest,
        extensionPath: extensionDir,
        success: false,
        error: `Entry point not found: ${fullManifest.entryPoint}`,
        warnings,
      };
    }

    // Check entry point extension
    const entryExt = path.extname(entryPath);
    if (this.config.allowedExtensions && !this.config.allowedExtensions.includes(entryExt)) {
      return {
        manifest: fullManifest,
        extensionPath: extensionDir,
        success: false,
        error: `Entry point extension '${entryExt}' not allowed (allowed: ${this.config.allowedExtensions.join(', ')})`,
        warnings,
      };
    }

    // Check path restriction
    if (this.config.restrictToPaths) {
      const isInSearchPath = this.config.searchPaths.some((sp) => {
        const resolved = path.resolve(extensionDir);
        return resolved.startsWith(path.resolve(sp));
      });

      if (!isInSearchPath) {
        return {
          manifest: fullManifest,
          extensionPath: extensionDir,
          success: false,
          error: 'Extension is outside allowed search paths',
          warnings,
        };
      }
    }

    return {
      manifest: fullManifest,
      extensionPath: extensionDir,
      success: true,
      warnings,
    };
  }

  /**
   * Get all loaded extensions
   */
  getLoaded(): ExtensionLoadResult[] {
    return Array.from(this.loaded.values());
  }

  /**
   * Get a loaded extension by ID
   */
  get(id: string): ExtensionLoadResult | undefined {
    return this.loaded.get(id);
  }

  /**
   * Unload (remove from cache) an extension
   */
  unload(id: string): boolean {
    return this.loaded.delete(id);
  }

  /**
   * Set search paths
   */
  setSearchPaths(paths: string[]): void {
    this.config.searchPaths = paths;
  }
}

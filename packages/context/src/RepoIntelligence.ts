/**
 * RepoIntelligence — Lightweight repo understanding system.
 *
 * Scans project structure, detects frameworks, maps dependencies,
 * and generates architecture summaries. Designed for low overhead
 * — no expensive indexing, no full AST parsing.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, extname, basename } from 'node:path';
import { existsSync, readFileSync as fsReadFileSync } from 'node:fs';
import type { RepoSummary, FrameworkInfo, FileNode, DependencyInfo } from '@autic/shared';
import { WorkspaceMemory } from '@autic/memory';

// Framework detection signatures
interface FrameworkDetector {
  name: string;
  confidence: number;
  check: (files: string[], configs: Record<string, string>) => boolean;
  indicators: string[];
}

const FRAMEWORK_DETECTORS: FrameworkDetector[] = [
  {
    name: 'Next.js',
    confidence: 0.95,
    indicators: ['next.config', 'next-env.d.ts', 'pages/', 'app/'],
    check: (files, configs) => files.some((f) => f.includes('next.config')) ||
      configs['next-env.d.ts'] !== undefined ||
      files.some((f) => f === 'app/layout.tsx' || f === 'app/layout.jsx'),
  },
  {
    name: 'Express',
    confidence: 0.8,
    indicators: ['express', 'app.listen', 'router.'],
    check: (files, configs) => configs['express'] !== undefined ||
      files.some((f) => f.includes('app.ts') || f.includes('server.ts') || f.includes('index.ts') && f.includes('express')),
  },
  {
    name: 'React',
    confidence: 0.9,
    indicators: ['react', 'jsx', 'tsx', 'components/'],
    check: (files, configs) => configs['react'] !== undefined ||
      files.some((f) => f.endsWith('.tsx') || f.endsWith('.jsx')),
  },
  {
    name: 'Vue',
    confidence: 0.9,
    indicators: ['vue', '.vue'],
    check: (files, configs) => configs['vue'] !== undefined ||
      files.some((f) => f.endsWith('.vue')),
  },
  {
    name: 'Svelte',
    confidence: 0.9,
    indicators: ['svelte', '.svelte'],
    check: (files, configs) => configs['svelte'] !== undefined ||
      files.some((f) => f.endsWith('.svelte')),
  },
  {
    name: 'TypeScript',
    confidence: 0.95,
    indicators: ['tsconfig.json', '.ts', '.tsx'],
    check: (files, configs) => configs['tsconfig'] !== undefined ||
      files.some((f) => f.endsWith('.ts')),
  },
  {
    name: 'Python/Django',
    confidence: 0.85,
    indicators: ['manage.py', 'wsgi.py', 'settings.py', 'urls.py'],
    check: (files, _configs) => files.some((f) => f.endsWith('manage.py') || f.endsWith('wsgi.py') || f.endsWith('settings.py')),
  },
  {
    name: 'Python/Flask',
    confidence: 0.8,
    indicators: ['flask', 'app.run'],
    check: (files, configs) => configs['flask'] !== undefined ||
      files.some((f) => f.endsWith('app.py') && f.includes('flask')),
  },
  {
    name: 'Supabase',
    confidence: 0.8,
    indicators: ['supabase', 'supabase-js', 'supabaseClient'],
    check: (files, configs) => configs['@supabase'] !== undefined ||
      configs['supabase'] !== undefined ||
      files.some((f) => f.includes('supabase')),
  },
  {
    name: 'Prisma',
    confidence: 0.9,
    indicators: ['prisma/schema.prisma', '@prisma/client'],
    check: (files, configs) => configs['@prisma/client'] !== undefined ||
      files.some((f) => f.includes('prisma/schema.prisma')),
  },
];

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export class RepoIntelligence {
  private rootDir: string;
  private cachedFiles: FileNode[] | null = null;
  private lastScanAt = 0;
  private readonly scanCooldownMs = 30_000; // Don't re-scan more than once per 30s

  constructor(rootDir?: string) {
    this.rootDir = rootDir || process.cwd();
  }

  /**
   * Scan the project and generate repo intelligence.
   */
  async scan(options: {
    maxDepth?: number;
    maxFiles?: number;
    includeDirs?: string[];
    force?: boolean;
  } = {}): Promise<RepoSummary> {
    const now = Date.now();
    if (!options.force && this.cachedFiles && now - this.lastScanAt < this.scanCooldownMs) {
      // Return cached if within cooldown
      const cached = await this.getCachedSummary();
      if (cached) return cached;
    }

    const maxDepth = options.maxDepth || 8;
    const maxFiles = options.maxFiles || 500;
    const includeDirs = options.includeDirs || ['src', 'lib', 'app', 'packages', 'components', 'pages'];

    const files: string[] = [];
    const dirs: string[] = [];
    const extensions = new Set<string>();
    const languages = new Set<string>();

    // Scan project
    await this.walkDirectory(this.rootDir, files, dirs, extensions, languages, {
      maxDepth,
      maxFiles,
      includeDirs,
    });

    // Read config files & detect frameworks/language
    const configs = await this.readConfigFiles();
    const frameworks = this.detectFrameworks(files, configs);
    const primaryLanguage = this.detectLanguage(extensions, configs);

    // Build FileNode graph
    this.cachedFiles = files.map((f) => ({
      path: f,
      type: 'file' as const,
      size: 0,
      depth: f.split('/').length,
      imports: [],
      exports: [],
    }));

    this.lastScanAt = now;

    const summary: RepoSummary = {
      name: basename(this.rootDir) || 'unknown',
      rootDir: this.rootDir,
      totalFiles: files.length,
      totalDirs: dirs.length,
      languages: [primaryLanguage, ...Array.from(languages).filter((l) => l !== primaryLanguage)],
      frameworks: frameworks.map((f) => f.name),
      detectedAt: Date.now(),
    };

    return summary;
  }

  /**
   * Get the cached repo summary if available.
   */
  private async getCachedSummary(): Promise<RepoSummary | null> {
    try {
      const memory = new WorkspaceMemory(this.rootDir);
      return await memory.getRepoSummary();
    } catch {
      return null;
    }
  }

  /**
   * Get important files in the project (high-value for context).
   */
  async getImportantFiles(limit = 20): Promise<string[]> {
    const files: string[] = [];

    // Always include config files
    const configFiles = this.getConfigFiles();
    for (const cf of configFiles) {
      if (existsSync(join(this.rootDir, cf))) {
        files.push(cf);
      }
    }

    // Include source entry points
    const entryFiles = [
      'src/index.ts', 'src/index.js', 'src/main.ts', 'src/main.js',
      'src/app.ts', 'src/app.jsx', 'src/server.ts', 'index.ts', 'index.js',
      'app/layout.tsx', 'app/layout.jsx', 'pages/index.tsx',
      'src/App.tsx', 'src/App.jsx',
    ];
    for (const ef of entryFiles) {
      if (files.length >= limit) break;
      if (existsSync(join(this.rootDir, ef))) {
        files.push(ef);
      }
    }

    return files.slice(0, limit);
  }

  /**
   * Build a dependency graph (flat list of all dependencies).
   */
  getDependencyGraph(): DependencyInfo[] {
    return this.extractDependenciesFromDisk();
  }



  /**
   * Detect primary programming language from file extensions and configs.
   */
  private detectLanguage(
    extensions: Set<string>,
    configs: Record<string, string>,
  ): string {
    if (configs['tsconfig'] !== undefined) return 'TypeScript';
    if (extensions.has('.ts') || extensions.has('.tsx')) return 'TypeScript';
    if (extensions.has('.py')) return 'Python';
    if (extensions.has('.go')) return 'Go';
    if (extensions.has('.rs')) return 'Rust';
    if (extensions.has('.java')) return 'Java';
    if (extensions.has('.rb')) return 'Ruby';
    if (extensions.has('.php')) return 'PHP';
    if (extensions.has('.cs')) return 'C#';
    if (extensions.has('.swift')) return 'Swift';
    if (extensions.has('.kt') || extensions.has('.kts')) return 'Kotlin';
    if (extensions.has('.js') || extensions.has('.jsx')) return 'JavaScript';
    return 'unknown';
  }

  /**
   * Walk directory tree collecting files and metadata.
   */
  private async walkDirectory(
    dir: string,
    files: string[],
    dirs: string[],
    extensions: Set<string>,
    _languages: Set<string>,
    options: { maxDepth: number; maxFiles: number; includeDirs: string[] },
    currentDepth = 0,
  ): Promise<void> {
    if (currentDepth > options.maxDepth || files.length >= options.maxFiles) return;

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (files.length >= options.maxFiles) return;

        // Skip hidden, node_modules, dist, .git
        if (entry.name.startsWith('.') || entry.name === 'node_modules' ||
            entry.name === 'dist' || entry.name === '.next' || entry.name === 'build') continue;

        const fullPath = join(dir, entry.name);
        const relPath = relative(this.rootDir, fullPath);

        if (entry.isDirectory()) {
          dirs.push(relPath);
          await this.walkDirectory(fullPath, files, dirs, extensions, _languages, options, currentDepth + 1);
        } else if (entry.isFile()) {
          files.push(relPath);
          const ext = extname(entry.name).toLowerCase();
          if (ext) extensions.add(ext);

          // Map extensions to languages
          const langMap: Record<string, string> = {
            '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript',
            '.py': 'Python', '.go': 'Go', '.rs': 'Rust', '.java': 'Java', '.rb': 'Ruby',
            '.php': 'PHP', '.cs': 'C#', '.swift': 'Swift', '.kt': 'Kotlin', '.kts': 'Kotlin',
            '.scala': 'Scala', '.vue': 'Vue', '.svelte': 'Svelte', '.css': 'CSS',
            '.scss': 'SCSS', '.less': 'Less', '.html': 'HTML', '.json': 'JSON',
            '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.md': 'Markdown',
          };
          const lang = langMap[ext];
          if (lang) _languages.add(lang);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  /**
   * Read relevant config files for framework detection.
   */
  private async readConfigFiles(): Promise<Record<string, string>> {
    const configs: Record<string, string> = {};

    // Read package.json
    try {
      const pkgData = await readFile(join(this.rootDir, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgData) as PkgJson;
      if (pkg.dependencies) {
        for (const [name] of Object.entries(pkg.dependencies)) {
          configs[name] = name;
        }
      }
      if (pkg.devDependencies) {
        for (const [name] of Object.entries(pkg.devDependencies)) {
          configs[name] = name;
        }
      }
      configs['package.json'] = 'present';
    } catch {
      // No package.json
    }

    // Check for tsconfig
    if (existsSync(join(this.rootDir, 'tsconfig.json'))) {
      configs['tsconfig'] = 'present';
    }

    // Check for other config files
    const configFiles = [
      'composer.json', 'Cargo.toml', 'go.mod', 'Gemfile', 'requirements.txt',
      'build.gradle', 'pom.xml', 'project.clj', 'mix.exs',
    ];
    for (const cf of configFiles) {
      if (existsSync(join(this.rootDir, cf))) {
        configs[cf] = 'present';
      }
    }

    return configs;
  }

  /**
   * Run framework detectors against scanned files and configs.
   */
  private detectFrameworks(files: string[], configs: Record<string, string>): FrameworkInfo[] {
    const detected: FrameworkInfo[] = [];

    for (const detector of FRAMEWORK_DETECTORS) {
      if (detector.check(files, configs)) {
        detected.push({
          name: detector.name,
          confidence: detector.confidence,
          indicators: detector.indicators,
        });
      }
    }

    return detected;
  }



  /**
   * Extract dependencies from disk.
   */
  private extractDependenciesFromDisk(): DependencyInfo[] {
    try {
      const pkgPath = join(this.rootDir, 'package.json');
      if (existsSync(pkgPath)) {
        const data = fsReadFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(data) as PkgJson;
        const deps: DependencyInfo[] = [];
        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            deps.push({ name, version, type: 'dependency' });
          }
        }
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            deps.push({ name, version, type: 'devDependency' });
          }
        }
        return deps;
      }
    } catch {
      // Skip
    }
    return [];
  }

  /**
   * Get known config file patterns.
   */
  private getConfigFiles(): string[] {
    return [
      'package.json', 'tsconfig.json', '.env', '.env.example',
      'next.config.js', 'next.config.ts', 'next.config.mjs',
      'vite.config.ts', 'vite.config.js', 'webpack.config.js',
      'tailwind.config.ts', 'tailwind.config.js', 'postcss.config.js',
      'docker-compose.yml', 'Dockerfile', '.gitignore',
      'pnpm-workspace.yaml', 'lerna.json', 'nx.json',
      'turbo.json', 'biome.json', '.prettierrc', '.eslintrc.js',
    ];
  }
}



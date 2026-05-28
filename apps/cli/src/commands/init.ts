/**
 * autic init — Enhanced workspace initialization.
 * Creates .autic directory structure, detects project frameworks,
 * scaffolds configuration, and initializes session storage.
 */

import { mkdir, access, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ConfigManager } from '@autic/config';
import type { WorkspaceConfig } from '@autic/shared';

export async function initCommand(options: { force?: boolean; profile?: string } = {}): Promise<void> {
  const cwd = process.cwd();
  const auticDir = join(cwd, '.autic');

  console.log('❯ Initializing Autic...\n');

  try {
    await access(auticDir);
    if (!options.force) {
      console.log('  Autic is already initialized in this directory.');
      console.log('  Use --force to reinitialize.\n');
      return;
    }
    console.log('  Reinitializing (--force)...\n');
  } catch {
    // Directory doesn't exist, proceed
  }

  // Detect project metadata
  const projectInfo = await detectProjectInfo(cwd);

  if (projectInfo.name) {
    console.log(`  Detected project: ${projectInfo.name}`);
  }
  if (projectInfo.framework) {
    console.log(`  Detected framework: ${projectInfo.framework}`);
  }
  if (projectInfo.packageManager) {
    console.log(`  Detected package manager: ${projectInfo.packageManager}`);
  }
  if (projectInfo.name || projectInfo.framework || projectInfo.packageManager) {
    console.log('');
  }

  // Create directory structure
  const dirs = [
    auticDir,
    join(auticDir, 'sessions'),
    join(auticDir, 'memory'),
    join(auticDir, 'context'),
    join(auticDir, 'tmp'),
    join(auticDir, 'crashes'),
  ];

  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
    console.log(`  ✓ Created ${dir}`);
  }

  // Create workspace config
  const workspaceConfig: WorkspaceConfig = {
    version: '0.1.0',
    schema: 1,
    projectName: projectInfo.name || undefined,
    detectedFramework: projectInfo.framework || undefined,
    detectedPackageManager: projectInfo.packageManager || undefined,
    profile: (options.profile as WorkspaceConfig['profile']) || undefined,
    initCompleted: true,
    initializedAt: Date.now(),
  };

  await writeFile(join(auticDir, 'config.json'), JSON.stringify(workspaceConfig, null, 2));
  console.log('  ✓ Created .autic/config.json (workspace config)\n');

  // Initialize global config if not exists
  const configManager = new ConfigManager();
  await configManager.init();
  if (!configManager.isLoaded()) {
    await configManager.saveGlobalConfig();
    console.log('  ✓ Created global config (~/.autic/config.json)\n');
  }

  console.log('  Autic initialized successfully.\n');

  // Print next steps
  console.log('  Next steps:');
  console.log('    • Configure providers:    autic providers add <name>');
  console.log('    • Set developer profile:  autic profile set <profile>');
  console.log('    • Run diagnostics:        autic doctor');
  console.log('    • Start a session:        autic chat\n');
}

async function detectProjectInfo(cwd: string): Promise<{
  name: string | null;
  framework: string | null;
  packageManager: string | null;
}> {
  const result = { name: null as string | null, framework: null as string | null, packageManager: null as string | null };

  // Detect package.json
  try {
    const pkgContent = await readFile(join(cwd, 'package.json'), 'utf-8');
    const pkg = JSON.parse(pkgContent);
    result.name = pkg.name || null;

    // Detect package manager from lockfile
    try {
      await access(join(cwd, 'pnpm-lock.yaml'));
      result.packageManager = 'pnpm';
    } catch {
      try {
        await access(join(cwd, 'package-lock.json'));
        result.packageManager = 'npm';
      } catch {
        try {
          await access(join(cwd, 'yarn.lock'));
          result.packageManager = 'yarn';
        } catch {
          try {
            await access(join(cwd, 'bun.lockb'));
            result.packageManager = 'bun';
          } catch {
            // Use pnpm as default
            result.packageManager = 'pnpm';
          }
        }
      }
    }

    // Detect framework from dependencies
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps) {
      const depNames = Object.keys(deps);

      if (depNames.some((d) => d.includes('next'))) {
        result.framework = 'Next.js';
      } else if (depNames.some((d) => d.includes('react') || d.includes('react-dom'))) {
        result.framework = 'React';
      } else if (depNames.some((d) => d.includes('vue'))) {
        result.framework = 'Vue.js';
      } else if (depNames.some((d) => d.includes('@angular'))) {
        result.framework = 'Angular';
      } else if (depNames.some((d) => d.includes('svelte'))) {
        result.framework = 'Svelte';
      } else if (depNames.some((d) => d.includes('express'))) {
        result.framework = 'Express';
      } else if (depNames.some((d) => d.includes('nest'))) {
        result.framework = 'NestJS';
      } else if (depNames.some((d) => d.includes('astro'))) {
        result.framework = 'Astro';
      }
    }
  } catch {
    // No package.json — proceed without detection
  }

  // Check for other config files
  try {
    await access(join(cwd, 'Cargo.toml'));
    if (!result.name) result.name = 'Rust project';
    if (!result.framework) result.framework = 'Rust';
  } catch {
    // Not a Rust project
  }

  try {
    await access(join(cwd, 'go.mod'));
    if (!result.name) result.name = 'Go project';
    if (!result.framework) result.framework = 'Go';
  } catch {
    // Not a Go project
  }

  return result;
}

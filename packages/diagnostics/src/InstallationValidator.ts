/**
 * InstallationValidator — First-run validation system.
 *
 * Checks runtime compatibility, dependency verification,
 * provider setup validation, Ollama availability, filesystem permissions.
 * Reduces onboarding failures.
 */

import { execSync } from 'node:child_process';
import { access, mkdir, writeFile, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ConfigManager } from '@autic/config';
import type { InstallationValidation } from '@autic/shared';

export class InstallationValidator {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /** Run full installation validation */
  async validate(): Promise<InstallationValidation> {
    const start = Date.now();
    const checks: InstallationValidation['checks'] = [];

    // System checks
    checks.push(await this.checkNodeVersion());
    checks.push(await this.checkPnpm());
    checks.push(await this.checkPermissions());
    checks.push(await this.checkConfigDir());
    checks.push(await this.checkDataDir());

    // Provider checks
    checks.push(await this.checkOllama());

    const durationMs = Date.now() - start;

    return {
      passed: checks.every((c) => c.status !== 'fail'),
      timestamp: Date.now(),
      durationMs,
      checks,
    };
  }

  /** Validate that the current workspace is properly set up */
  async validateWorkspace(): Promise<InstallationValidation> {
    const start = Date.now();
    const checks: InstallationValidation['checks'] = [];

    const isInit = await this.configManager.isWorkspaceInitialized();
    checks.push({
      name: 'Workspace initialized',
      category: 'permission',
      status: isInit ? 'pass' : 'fail',
      message: isInit ? 'Autic workspace detected' : 'Not initialized',
      details: isInit ? undefined : 'Run: autic init',
    });

    const durationMs = Date.now() - start;
    return {
      passed: checks.every((c) => c.status !== 'fail'),
      timestamp: Date.now(),
      durationMs,
      checks,
    };
  }

  /** Print validation results */
  printValidation(result: InstallationValidation): void {
    const icons: Record<string, string> = { pass: '✓', warn: '○', fail: '✗' };

    console.log('\n  Installation Validation\n');
    for (const check of result.checks) {
      const icon = icons[check.status] || '?';
      console.log(`  ${icon} ${check.name}`);
      console.log(`     ${check.message}`);
      if (check.details) {
        console.log(`     → ${check.details}`);
      }
    }
    console.log(`\n  ${result.passed ? '✓ All checks passed' : '○ Some checks need attention'}\n`);
  }

  // ─── Private Checks ────────────────────────────────────────────────

  private async checkNodeVersion(): Promise<InstallationValidation['checks'][0]> {
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    return {
      name: 'Node.js version',
      category: 'system',
      status: major >= 20 ? 'pass' : 'fail',
      message: `v${version.slice(1)}${major >= 20 ? '' : ' (>=20 required)'}`,
      details: major >= 20 ? undefined : 'Download from https://nodejs.org',
    };
  }

  private async checkPnpm(): Promise<InstallationValidation['checks'][0]> {
    try {
      const output = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
      return {
        name: 'Package manager',
        category: 'dependency',
        status: 'pass',
        message: `pnpm v${output}`,
      };
    } catch {
      return {
        name: 'Package manager',
        category: 'dependency',
        status: 'fail',
        message: 'pnpm not found',
        details: 'Install: npm install -g pnpm',
      };
    }
  }

  private async checkPermissions(): Promise<InstallationValidation['checks'][0]> {
    try {
      const testDir = join(homedir(), '.autic-test');
      await mkdir(testDir, { recursive: true });
      const testFile = join(testDir, 'test.txt');
      await writeFile(testFile, 'test');
      await readFile(testFile, 'utf-8');
      await access(testFile);
      // Cleanup
      const { rm } = await import('node:fs/promises');
      await rm(testDir, { recursive: true });

      return {
        name: 'Filesystem permissions',
        category: 'permission',
        status: 'pass',
        message: 'Read/write access to home directory',
      };
    } catch {
      return {
        name: 'Filesystem permissions',
        category: 'permission',
        status: 'fail',
        message: 'Cannot write to home directory',
        details: 'Check directory permissions',
      };
    }
  }

  private async checkConfigDir(): Promise<InstallationValidation['checks'][0]> {
    try {
      const dir = join(homedir(), '.autic');
      await mkdir(dir, { recursive: true });
      return {
        name: 'Config directory',
        category: 'permission',
        status: 'pass',
        message: `~/.autic is accessible`,
      };
    } catch {
      return {
        name: 'Config directory',
        category: 'permission',
        status: 'fail',
        message: 'Cannot access ~/.autic',
        details: 'Check ~/.autic permissions',
      };
    }
  }

  private async checkDataDir(): Promise<InstallationValidation['checks'][0]> {
    try {
      await access(join(process.cwd(), '.autic'));
      return {
        name: 'Project data directory',
        category: 'permission',
        status: 'pass',
        message: '.autic directory exists',
      };
    } catch {
      return {
        name: 'Project data directory',
        category: 'permission',
        status: 'warn',
        message: '.autic not initialized in current directory',
        details: 'Run: autic init',
      };
    }
  }

  private async checkOllama(): Promise<InstallationValidation['checks'][0]> {
    try {
      const { OllamaProvider } = await import('@autic/providers');
      const provider = new OllamaProvider();
      const connected = await provider.connect();
      return {
        name: 'Ollama availability',
        category: 'provider',
        status: connected ? 'pass' : 'warn',
        message: connected ? 'Ollama is running' : 'Ollama not detected',
        details: connected ? undefined : 'Install from https://ollama.ai',
      };
    } catch {
      return {
        name: 'Ollama availability',
        category: 'provider',
        status: 'warn',
        message: 'Could not check Ollama',
        details: 'Install from https://ollama.ai',
      };
    }
  }
}

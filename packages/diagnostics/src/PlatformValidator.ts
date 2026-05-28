/**
 * PlatformValidator — Cross-platform hardening and compatibility checks.
 *
 * Validates Windows, Linux, and macOS compatibility.
 * Checks shell availability, path normalization, and platform-specific features.
 */

import { execSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { homedir, platform, arch, EOL } from 'node:os';
import { join, sep } from 'node:path';
import type { PlatformInfo } from '@autic/shared';

export class PlatformValidator {
  /** Get comprehensive platform information */
  getPlatformInfo(): PlatformInfo {
    const p = platform();

    return {
      platform: p,
      arch: arch(),
      shell: this.getShell(),
      nodeVersion: process.version,
      npmVersion: this.getVersion('npm --version'),
      pnpmVersion: this.getVersion('pnpm --version'),
      gitVersion: this.getVersion('git --version'),
      terminal: process.env.TERM || 'unknown',
      homeDir: homedir(),
      configDir: join(homedir(), '.autic'),
      dataDir: join(homedir(), '.autic'),
      tempDir: this.getTempDir(),
      pathSeparator: sep,
      lineEnding: EOL,
      isWindows: p === 'win32',
      isMacOS: p === 'darwin',
      isLinux: p === 'linux',
    };
  }

  /** Validate platform compatibility */
  async validateCompatibility(): Promise<{
    compatible: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];
    const p = platform();

    // Check platform support
    const supported = ['darwin', 'linux', 'win32'];
    if (!supported.includes(p)) {
      warnings.push(`Platform "${p}" is not officially supported`);
    }

    // Check path length limits (Windows: MAX_PATH = 260)
    if (p === 'win32') {
      const maxPathExceeded = cwd().length > 240;
      if (maxPathExceeded) {
        issues.push('Current directory path is too long for Windows (max 260 chars)');
      }
    }

    // Check Node.js version
    const major = parseInt(process.version.slice(1).split('.')[0], 10);
    if (major < 20) {
      issues.push(`Node.js ${major}.x is below minimum requirement (20.x)`);
    }

    // Check shell availability
    const shell = this.getShell();
    if (!shell) {
      warnings.push('No shell detected — some features may not work');
    }

    // Check temp directory access
    try {
      await access(this.getTempDir());
    } catch {
      warnings.push('Cannot access system temp directory');
    }

    // Check home directory
    try {
      await access(homedir());
    } catch {
      issues.push('Cannot access home directory');
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
    };
  }

  /** Normalize a path for the current platform */
  normalizePath(input: string): string {
    // Replace forward slashes with platform separator on Windows
    if (platform() === 'win32') {
      return input.replace(/\//g, '\\');
    }
    return input;
  }

  /** Get recommended settings for the current platform */
  getPlatformRecommendations(): string[] {
    const p = platform();
    const recs: string[] = [];

    if (p === 'win32') {
      recs.push('Use PowerShell or Windows Terminal for best experience');
      recs.push('Keep project paths short (< 240 characters)');
      recs.push('Consider using WSL2 for better compatibility');
    }

    if (p === 'darwin') {
      recs.push('Install Xcode Command Line Tools: xcode-select --install');
    }

    if (p === 'linux') {
      recs.push('Ensure libstdc++6 is installed for native modules');
    }

    recs.push('Use a modern terminal emulator with UTF-8 support');

    return recs;
  }

  /** Print platform info summary */
  printPlatformInfo(): void {
    const info = this.getPlatformInfo();
    console.log('\n  Platform Information\n');
    console.log(`  OS:       ${info.platform} (${info.arch})`);
    console.log(`  Node:     ${info.nodeVersion}`);
    console.log(`  Shell:    ${info.shell}`);
    console.log(`  Terminal: ${info.terminal}`);
    console.log(`  Home:     ${info.homeDir}`);
    console.log(`  Config:   ${info.configDir}`);
    console.log(`  Temp:     ${info.tempDir}`);
    console.log(`  Path:     ${info.pathSeparator}`);
    if (info.npmVersion) console.log(`  npm:      ${info.npmVersion}`);
    if (info.pnpmVersion) console.log(`  pnpm:     ${info.pnpmVersion}`);
    if (info.gitVersion) console.log(`  Git:      ${info.gitVersion}`);
    console.log('');
  }

  // ─── Private ───────────────────────────────────────────────────────

  private getShell(): string {
    return process.env.SHELL || process.env.ComSpec || '';
  }

  private getVersion(cmd: string): string | undefined {
    try {
      return execSync(cmd, { encoding: 'utf-8' }).trim();
    } catch {
      return undefined;
    }
  }

  private getTempDir(): string {
    return process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  }
}

function cwd(): string {
  return process.cwd();
}

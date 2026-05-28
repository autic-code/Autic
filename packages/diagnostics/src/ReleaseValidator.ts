/**
 * ReleaseValidator — Release pipeline foundation with semantic versioning.
 *
 * Provides changelog generation, package integrity checks,
 * and pre-release validation hooks. No cloud dependency.
 */

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import type { ReleaseManifest } from '@autic/shared';

export class ReleaseValidator {
  /** Validate the current package for release readiness */
  async validatePackage(packagePath: string): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check package.json exists
    try {
      const content = await readFile(join(packagePath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(content);

      // Verify version
      if (!pkg.version) {
        issues.push('package.json missing version field');
      }

      // Verify required fields
      if (!pkg.name) issues.push('package.json missing name field');
      if (!pkg.main && !pkg.exports) issues.push('package.json missing main/exports field');
      if (!pkg.scripts?.build) warnings.push('No build script defined');

      // Verify dependencies don't use workspace protocol in published packages
      if (pkg.dependencies) {
        for (const [dep, ver] of Object.entries(pkg.dependencies)) {
          if (ver === 'workspace:*' || ver === 'workspace:^' || ver === 'workspace:~') {
            issues.push(
              `Dependency "${dep}" uses workspace protocol — must be replaced for publishing`,
            );
          }
        }
      }
    } catch (error) {
      issues.push(
        `Cannot read package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Check dist directory
    try {
      await access(join(packagePath, 'dist'));
    } catch {
      issues.push('dist/ directory not found — run build first');
    }

    // Check README
    try {
      await access(join(packagePath, 'README.md'));
    } catch {
      warnings.push('No README.md found');
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
    };
  }

  /** Compare two semantic versions */
  compareVersions(a: string, b: string): 'newer' | 'older' | 'equal' {
    const parse = (v: string): number[] =>
      v
        .replace(/[^0-9.]/g, '')
        .split('.')
        .map(Number);

    const aParts = parse(a);
    const bParts = parse(b);

    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal > bVal) return 'newer';
      if (aVal < bVal) return 'older';
    }

    return 'equal';
  }

  /** Generate a changelog entry from git history */
  async generateChangelog(fromVersion: string, toVersion: string): Promise<string> {
    const sections: Record<string, string[]> = {
      '🚀 Features': [],
      '🐛 Bug Fixes': [],
      '🔧 Improvements': [],
      '📦 Dependencies': [],
      '📝 Documentation': [],
      '🧪 Testing': [],
    };

    // Try to parse git log for conventional commits
    try {
      const { execSync } = await import('node:child_process');
      const log = execSync(
        `git log --oneline --format="%s" v${fromVersion}..HEAD 2>/dev/null || git log --oneline --format="%s" -30`,
        { encoding: 'utf-8' },
      );

      for (const line of log.trim().split('\n')) {
        if (!line.trim()) continue;

        if (line.startsWith('feat') || line.startsWith('feature')) {
          sections['🚀 Features'].push(line.replace(/^(feat|feature)[(!:].*?:\s*/, ''));
        } else if (line.startsWith('fix')) {
          sections['🐛 Bug Fixes'].push(line.replace(/^fix[(!:].*?:\s*/, ''));
        } else if (line.startsWith('refactor') || line.startsWith('perf')) {
          sections['🔧 Improvements'].push(line.replace(/^(refactor|perf)[(!:].*?:\s*/, ''));
        } else if (line.startsWith('docs')) {
          sections['📝 Documentation'].push(line.replace(/^docs[(!:].*?:\s*/, ''));
        } else if (line.startsWith('test')) {
          sections['🧪 Testing'].push(line.replace(/^test[(!:].*?:\s*/, ''));
        } else if (line.startsWith('chore(deps)')) {
          sections['📦 Dependencies'].push(line.replace(/^chore\(deps\)[(!:].*?:\s*/, ''));
        } else {
          // Unclassified goes to improvements
          sections['🔧 Improvements'].push(line);
        }
      }
    } catch {
      // No git history available
    }

    // Build changelog string
    const lines: string[] = [
      `## v${toVersion}`,
      '',
      `> Released: ${new Date().toISOString().split('T')[0]}`,
      '',
    ];

    for (const [section, items] of Object.entries(sections)) {
      if (items.length > 0) {
        lines.push(`### ${section}`);
        for (const item of items) {
          lines.push(`- ${item.trim()}`);
        }
        lines.push('');
      }
    }

    if (lines.length <= 3) {
      lines.push('No significant changes recorded.');
    }

    return lines.join('\n');
  }

  /** Generate a release manifest for integrity checking */
  async generateManifest(packagePath: string, version: string): Promise<ReleaseManifest> {
    const { createHash } = await import('node:crypto');
    const { readdir, stat } = await import('node:fs/promises');

    const distPath = join(packagePath, 'dist');
    const files: ReleaseManifest['files'] = [];

    async function walk(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.d.ts') ||
          entry.name.endsWith('.json')
        ) {
          const content = await readFile(fullPath);
          const hash = createHash('sha256').update(content).digest('hex');
          const stats = await stat(fullPath);
          files.push({
            name: fullPath.replace(distPath, '').replace(/^[/\\]/, ''),
            size: stats.size,
            integrity: `sha256-${hash}`,
          });
        }
      }
    }

    await walk(distPath);

    // Hash the manifest itself
    const manifestStr = JSON.stringify({ version, files });
    const hash = createHash('sha256').update(manifestStr).digest('hex');

    return {
      version,
      publishedAt: new Date().toISOString(),
      integrity: {
        algorithm: 'sha256',
        hash,
      },
      files,
    };
  }

  /** Verify a release manifest */
  async verifyManifest(
    manifest: ReleaseManifest,
    distPath: string,
  ): Promise<{
    valid: boolean;
    mismatches: Array<{ file: string; expected: string; actual: string }>;
  }> {
    const { createHash } = await import('node:crypto');
    const mismatches: Array<{ file: string; expected: string; actual: string }> = [];

    for (const file of manifest.files) {
      try {
        const content = await readFile(join(distPath, file.name));
        const actualHash = createHash('sha256').update(content).digest('hex');
        const expectedHash = file.integrity.replace('sha256-', '');

        if (actualHash !== expectedHash) {
          mismatches.push({
            file: file.name,
            expected: expectedHash,
            actual: actualHash,
          });
        }
      } catch {
        mismatches.push({
          file: file.name,
          expected: file.integrity,
          actual: 'FILE_NOT_FOUND',
        });
      }
    }

    return {
      valid: mismatches.length === 0,
      mismatches,
    };
  }
}

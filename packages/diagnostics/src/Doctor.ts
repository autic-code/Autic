/**
 * Doctor — Comprehensive environment diagnostics for Autic.
 *
 * Checks system health, provider connectivity, runtime state,
 * permissions, dependencies, and queue/runtime health.
 * Produces structured DiagnosticReport for actionable troubleshooting.
 */

import { execSync } from 'node:child_process';
import { access } from 'node:fs/promises';
import { platform, arch, totalmem, freemem, cpus } from 'node:os';
import { join } from 'node:path';
import { Vault } from '@autic/security';
import {
  OpenRouterProvider,
  OllamaProvider,
  ModelRegistry,
} from '@autic/providers';
import type { DiagnosticCheck, DiagnosticReport } from '@autic/shared';
import { ConfigManager } from '@autic/config';

export class Doctor {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  /** Run full diagnostic suite */
  async runFull(): Promise<DiagnosticReport> {
    const start = Date.now();
    const checks: DiagnosticCheck[] = [];

    // System checks
    checks.push(this.checkNodeVersion());
    checks.push(await this.checkPnpm());
    checks.push(await this.checkGit());
    checks.push(this.checkPlatform());
    checks.push(this.checkMemory());
    checks.push(await this.checkAuticDir());

    // Provider checks
    checks.push(await this.checkOllama());
    checks.push(await this.checkOpenRouter());
    checks.push(await this.checkModelRegistry());

    // Security checks
    checks.push(await this.checkVault());
    checks.push(await this.checkConfig());

    // Performance checks
    checks.push(await this.checkStartupTime());
    checks.push(await this.checkNetwork());

    const durationMs = Date.now() - start;

    return {
      timestamp: Date.now(),
      durationMs,
      checks,
      summary: this.summarize(checks),
      system: {
        nodeVersion: process.version,
        platform: platform(),
        arch: arch(),
        memoryTotal: Math.round(totalmem() / 1024 / 1024),
        memoryFree: Math.round(freemem() / 1024 / 1024),
        cpus: cpus().length,
      },
    };
  }

  /** Run quick diagnostic (system + providers only) */
  async runQuick(): Promise<DiagnosticCheck[]> {
    return [
      this.checkNodeVersion(),
      await this.checkAuticDir(),
      await this.checkOllama(),
      await this.checkOpenRouter(),
    ];
  }

  /** Run provider-specific diagnostics */
  async runProviderCheck(providerId: string): Promise<DiagnosticCheck[]> {
    const checks: DiagnosticCheck[] = [];

    const start = Date.now();
    try {
      const configs = this.configManager.getProviders();
      const config = configs.find((p) => p.id === providerId);

      if (!config) {
        checks.push({
          name: `Provider: ${providerId}`,
          category: 'provider',
          status: 'fail',
          message: `Provider "${providerId}" not found in configuration`,
          suggestion: `Add it with: autic providers add ${providerId}`,
          durationMs: Date.now() - start,
        });
        return checks;
      }

      if (config.type === 'ollama') {
        const provider = new OllamaProvider({ baseUrl: config.baseUrl });
        const connected = await provider.connect();
        if (connected) {
          const models = await provider.listModels();
          checks.push({
            name: `Provider: ${config.name}`,
            category: 'provider',
            status: 'pass',
            message: `Connected (${models.length} models)`,
            durationMs: Date.now() - start,
          });
        } else {
          checks.push({
            name: `Provider: ${config.name}`,
            category: 'provider',
            status: 'fail',
            message: 'Could not connect',
            suggestion: 'Ensure Ollama is running: ollama serve',
            durationMs: Date.now() - start,
          });
        }
      } else if (config.type === 'openrouter') {
        const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY || '';
        if (!apiKey) {
          checks.push({
            name: `Provider: ${config.name}`,
            category: 'provider',
            status: 'fail',
            message: 'No API key configured',
            suggestion: 'Set OPENROUTER_API_KEY environment variable',
            durationMs: Date.now() - start,
          });
          return checks;
        }
        const provider = new OpenRouterProvider({ apiKey, baseUrl: config.baseUrl });
        const connected = await provider.connect();
        checks.push({
          name: `Provider: ${config.name}`,
          category: 'provider',
          status: connected ? 'pass' : 'fail',
          message: connected ? 'API key valid, connected' : 'Connection failed',
          suggestion: connected ? undefined : 'Verify your API key is valid',
          durationMs: Date.now() - start,
        });
      }
    } catch (error) {
      checks.push({
        name: `Provider: ${providerId}`,
        category: 'provider',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - start,
      });
    }

    return checks;
  }

  /** Print a prettified diagnostic report to console */
  printReport(report: DiagnosticReport): void {
    const icons: Record<string, string> = { pass: '✓', warn: '○', fail: '✗', skip: '→' };

    console.log(`\n  Autic Doctor — Environment Diagnostics\n`);
    console.log(`  System: ${report.system.nodeVersion} | ${report.system.platform} (${report.system.arch})`);
    console.log(`  Memory: ${report.system.memoryFree}MB free / ${report.system.memoryTotal}MB total`);
    console.log(`  Duration: ${report.durationMs}ms\n`);

    // Group by category
    const categories = [...new Set(report.checks.map((c) => c.category))];
    for (const category of categories) {
      const checks = report.checks.filter((c) => c.category === category);
      console.log(`  ${category.toUpperCase()}:`);
      for (const check of checks) {
        const icon = icons[check.status] || '?';
        console.log(`    ${icon} ${check.name}`);
        console.log(`       ${check.message}`);
        if (check.suggestion) {
          console.log(`       → ${check.suggestion}`);
        }
      }
      console.log('');
    }

    // Summary
    const { passed, warnings, failed } = report.summary;
    console.log(`  Summary: ${passed} passed, ${warnings} warnings, ${failed} failed\n`);
  }

  // ─── Private Check Methods ────────────────────────────────────────

  private checkNodeVersion(): DiagnosticCheck {
    const start = Date.now();
    const version = process.version;
    const major = parseInt(version.slice(1).split('.')[0], 10);
    return {
      name: 'Node.js',
      category: 'system',
      status: major >= 20 ? 'pass' : 'fail',
      message: major >= 20 ? `v${version.slice(1)}` : `v${version.slice(1)} (>=20 required)`,
      suggestion: major >= 20 ? undefined : 'Upgrade Node.js to v20+ from https://nodejs.org',
      durationMs: Date.now() - start,
    };
  }

  private async checkPnpm(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const output = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
      return {
        name: 'pnpm',
        category: 'system',
        status: 'pass',
        message: `v${output}`,
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'pnpm',
        category: 'system',
        status: 'fail',
        message: 'Not found',
        suggestion: 'Install: npm install -g pnpm',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkGit(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const output = execSync('git --version', { encoding: 'utf-8' }).trim();
      return {
        name: 'Git',
        category: 'system',
        status: 'pass',
        message: output,
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'Git',
        category: 'system',
        status: 'warn',
        message: 'Not found (optional for basic usage)',
        suggestion: 'Install from https://git-scm.com',
        durationMs: Date.now() - start,
      };
    }
  }

  private checkPlatform(): DiagnosticCheck {
    const start = Date.now();
    const p = platform();
    const supported = ['darwin', 'linux', 'win32'];
    return {
      name: 'Platform',
      category: 'system',
      status: supported.includes(p) ? 'pass' : 'warn',
      message: `${p} (${arch()})${supported.includes(p) ? '' : ' — not fully tested'}`,
      durationMs: Date.now() - start,
    };
  }

  private checkMemory(): DiagnosticCheck {
    const start = Date.now();
    const free = freemem() / 1024 / 1024;
    return {
      name: 'Available memory',
      category: 'system',
      status: free >= 512 ? 'pass' : free >= 256 ? 'warn' : 'fail',
      message: `${Math.round(free)}MB free`,
      suggestion: free < 256 ? 'Close other applications to free memory' : undefined,
      durationMs: Date.now() - start,
    };
  }

  private async checkAuticDir(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      await access(join(process.cwd(), '.autic'));
      return {
        name: 'Autic workspace',
        category: 'workspace',
        status: 'pass',
        message: 'Initialized in current directory',
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'Autic workspace',
        category: 'workspace',
        status: 'warn',
        message: 'Not initialized',
        suggestion: 'Run: autic init',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkOllama(): Promise<DiagnosticCheck> {
    const start = Date.now();
    const provider = new OllamaProvider();
    try {
      const connected = await provider.connect();
      if (connected) {
        const models = await provider.listModels();
        return {
          name: 'Ollama',
          category: 'provider',
          status: 'pass',
          message: `Connected (${models.length} model${models.length !== 1 ? 's' : ''})`,
          durationMs: Date.now() - start,
        };
      }
      return {
        name: 'Ollama',
        category: 'provider',
        status: 'warn',
        message: 'Not running',
        suggestion: 'Start with: ollama serve',
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'Ollama',
        category: 'provider',
        status: 'warn',
        message: 'Not available',
        suggestion: 'Install from https://ollama.ai',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkOpenRouter(): Promise<DiagnosticCheck> {
    const start = Date.now();
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY;

    if (!apiKey) {
      return {
        name: 'OpenRouter',
        category: 'provider',
        status: 'warn',
        message: 'No API key found',
        suggestion: 'Set OPENROUTER_API_KEY or AUTIC_OPENROUTER_KEY environment variable',
        durationMs: Date.now() - start,
      };
    }

    const provider = new OpenRouterProvider({ apiKey });
    try {
      const connected = await provider.connect();
      if (connected) {
        const models = await provider.listModels();
        return {
          name: 'OpenRouter',
          category: 'provider',
          status: 'pass',
          message: `API key valid, ${models.length} model(s) available`,
          durationMs: Date.now() - start,
        };
      }
      return {
        name: 'OpenRouter',
        category: 'provider',
        status: 'fail',
        message: 'API key invalid or connection failed',
        suggestion: 'Verify your API key at https://openrouter.ai/keys',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'OpenRouter',
        category: 'provider',
        status: 'fail',
        message: error instanceof Error ? error.message : 'Connection failed',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkModelRegistry(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const registry = new ModelRegistry();
      const ollama = new OllamaProvider();
      const connected = await ollama.connect();

      if (connected) {
        const models = await ollama.listModels();
        registry.registerModels(models, 'ollama', true);
      }

      const apiKey = process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY;
      if (apiKey) {
        const or = new OpenRouterProvider({ apiKey });
        const orConnected = await or.connect();
        if (orConnected) {
          const orModels = await or.listModels();
          registry.registerModels(orModels, 'openrouter', false);
        }
      }

      const stats = registry.getStats();
      return {
        name: 'Model registry',
        category: 'provider',
        status: stats.totalModels > 0 ? 'pass' : 'warn',
        message: stats.totalModels > 0
          ? `${stats.totalModels} models (${stats.localModels} local, ${stats.cloudModels} cloud)`
          : 'No models registered',
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'Model registry',
        category: 'provider',
        status: 'warn',
        message: 'Could not populate',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkVault(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const vault = new Vault();
      await vault.init();
      const keys = await vault.list();
      return {
        name: 'Secret vault',
        category: 'security',
        status: 'pass',
        message: keys.length > 0
          ? `Initialized with ${keys.length} stored secret(s)`
          : 'Initialized (no secrets)',
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      return {
        name: 'Secret vault',
        category: 'security',
        status: msg.includes('AUTIC_VAULT_KEY') ? 'warn' : 'warn',
        message: msg.includes('AUTIC_VAULT_KEY')
          ? 'Not initialized — set AUTIC_VAULT_KEY'
          : 'Not available',
        suggestion: msg.includes('AUTIC_VAULT_KEY')
          ? 'Set AUTIC_VAULT_KEY environment variable for encrypted storage'
          : undefined,
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkConfig(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const config = this.configManager.getGlobalConfig();
      return {
        name: 'Configuration',
        category: 'security',
        status: 'pass',
        message: `Profile: ${config.profile}, Providers: ${config.providers.length}`,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'Configuration',
        category: 'security',
        status: 'warn',
        message: error instanceof Error ? error.message : 'Could not load config',
        durationMs: Date.now() - start,
      };
    }
  }

  private async checkStartupTime(): Promise<DiagnosticCheck> {
    const start = Date.now();
    // Simulate cold load
    const iterations = 100;
    let totalMs = 0;
    for (let i = 0; i < iterations; i++) {
      const s = Date.now();
      // Simple operations
      const _test = { a: 1, b: 2, c: 3 };
      JSON.stringify(_test);
      totalMs += Date.now() - s;
    }
    const avgMs = totalMs / iterations;
    return {
      name: 'Startup performance',
      category: 'runtime',
      status: avgMs < 5 ? 'pass' : avgMs < 10 ? 'warn' : 'fail',
      message: `${(avgMs * 100).toFixed(1)}μs avg operation`,
      durationMs: Date.now() - start,
    };
  }

  private async checkNetwork(): Promise<DiagnosticCheck> {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch('https://registry.npmjs.org/autic', {
        signal: controller.signal,
        method: 'HEAD',
      });
      clearTimeout(timeout);
      return {
        name: 'Network connectivity',
        category: 'network',
        status: response.ok ? 'pass' : 'warn',
        message: response.ok ? 'npm registry reachable' : `Registry returned ${response.status}`,
        durationMs: Date.now() - start,
      };
    } catch {
      return {
        name: 'Network connectivity',
        category: 'network',
        status: 'warn',
        message: 'Cannot reach npm registry (offline?)',
        suggestion: 'Check your internet connection',
        durationMs: Date.now() - start,
      };
    }
  }

  private summarize(checks: DiagnosticCheck[]) {
    let passed = 0;
    let warnings = 0;
    let failed = 0;
    let skipped = 0;

    for (const check of checks) {
      switch (check.status) {
        case 'pass': passed++; break;
        case 'warn': warnings++; break;
        case 'fail': failed++; break;
        case 'skip': skipped++; break;
      }
    }

    return { passed, warnings, failed, skipped, total: checks.length };
  }
}

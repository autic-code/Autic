/**
 * ResearchAgent — Read-only repository analysis agent.
 *
 * Responsibilities:
 *   - Analyze repository structure (files, directories, config files)
 *   - Detect dependencies and frameworks
 *   - Gather requirements context
 *   - Produce structured ResearchOutput contract
 *
 * Tool scope: read-only (read_file, list_files, search_files)
 *
 * This is a coordinator, not an AI entity. It uses ToolRegistry
 * for deterministic repo interrogation.
 */

import { timestamp } from '@autic/shared';
import type { ResearchOutput, TaskContract, OrchestrationStage } from '@autic/shared';
import { createContract, fulfillContract, rejectContract } from '../contracts.js';

export interface ResearchAgentOptions {
  maxFiles?: number;
  timeoutMs?: number;
}

type ToolRunner = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class ResearchAgent {
  private options: Required<ResearchAgentOptions>;

  constructor(options: ResearchAgentOptions = {}) {
    this.options = {
      maxFiles: options.maxFiles ?? 100,
      timeoutMs: options.timeoutMs ?? 60_000,
    };
  }

  /**
   * Execute a research stage.
   * Returns a fulfilled or rejected task contract.
   */
  async execute(
    goal: string,
    runTool: ToolRunner,
    _previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'research' as OrchestrationStage,
      'planning' as OrchestrationStage,
      'repo_analysis',
      { goal, timestamp: timestamp() },
    );

    try {
      // 1. List root directory
      const listResult = await runTool('list_files', { path: '.' });
      const rootFiles = (listResult.data as string[]) || [];

      // 2. Find config files
      const configPatterns = [
        'package.json',
        'tsconfig.json',
        'Cargo.toml',
        'Gemfile',
        'requirements.txt',
        'Makefile',
        'Dockerfile',
        '.env.example',
        'composer.json',
        'build.gradle',
        'pom.xml',
        'go.mod',
        'pnpm-workspace.yaml',
        'yarn.lock',
        'package-lock.json',
      ];
      const configFiles = rootFiles.filter((f) => configPatterns.includes(f));

      // 3. Read config files for dependency/framework detection
      const dependencies: string[] = [];
      const frameworks: Array<{ name: string; confidence: number }> = [];
      const configContents: string[] = [];

      for (const cfg of configFiles.slice(0, 5)) {
        const readResult = await runTool('read_file', { path: cfg, maxLength: 5000 });
        if (readResult.success && typeof readResult.data === 'string') {
          configContents.push(readResult.data);
          this.extractDepsAndFrameworks(cfg, readResult.data, dependencies, frameworks);
        }
      }

      // 4. Detect directories for structure
      const directories: string[] = [];

      // Check for common source directories
      for (const dir of ['src', 'lib', 'app', 'packages', 'apps', 'components']) {
        const dirResult = await runTool('list_files', { path: dir });
        if (dirResult.success && Array.isArray(dirResult.data)) {
          directories.push(dir);
        }
      }

      // 5. Build summary from findings
      const keyFindings: string[] = [];
      if (dependencies.length > 0) {
        keyFindings.push(`Detected ${dependencies.length} dependencies`);
      }
      if (frameworks.length > 0) {
        keyFindings.push(`Frameworks: ${frameworks.map((f) => f.name).join(', ')}`);
      }
      if (configFiles.length > 0) {
        keyFindings.push(`Config files: ${configFiles.join(', ')}`);
      }
      if (directories.length > 0) {
        keyFindings.push(`Source directories: ${directories.join(', ')}`);
      }

      const summary = this.buildSummary(goal, rootFiles, configFiles, directories, frameworks);

      const output: ResearchOutput = {
        repoStructure: {
          files: rootFiles.slice(0, this.options.maxFiles),
          directories,
          configFiles,
        },
        dependencies,
        frameworks,
        summary,
        keyFindings,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(contract, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Extract dependency names and framework info from config file contents.
   */
  private extractDepsAndFrameworks(
    filename: string,
    content: string,
    deps: string[],
    frameworks: Array<{ name: string; confidence: number }>,
  ): void {
    if (filename === 'package.json') {
      // Parse JSON to extract dependencies
      try {
        const json = JSON.parse(content);
        if (json.dependencies) {
          const names = Object.keys(json.dependencies);
          deps.push(...names);

          // Detect common frameworks
          if (names.some((n) => n.includes('react'))) {
            frameworks.push({ name: 'React', confidence: 0.9 });
          }
          if (names.some((n) => n.includes('express'))) {
            frameworks.push({ name: 'Express', confidence: 0.9 });
          }
          if (names.some((n) => n.includes('next'))) {
            frameworks.push({ name: 'Next.js', confidence: 0.9 });
          }
          if (names.some((n) => n.includes('vue'))) {
            frameworks.push({ name: 'Vue.js', confidence: 0.9 });
          }
          if (names.some((n) => n.includes('typescript') || n === 'typescript')) {
            frameworks.push({ name: 'TypeScript', confidence: 0.8 });
          }
          if (names.some((n) => n === 'commander' || n === 'yargs')) {
            frameworks.push({ name: 'CLI', confidence: 0.7 });
          }
        }
        if (json.devDependencies) {
          deps.push(...Object.keys(json.devDependencies));
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    if (filename === 'tsconfig.json') {
      frameworks.push({ name: 'TypeScript', confidence: 0.9 });
    }

    if (filename === 'Cargo.toml') {
      frameworks.push({ name: 'Rust/Cargo', confidence: 0.9 });
    }

    if (filename === 'go.mod') {
      frameworks.push({ name: 'Go', confidence: 0.9 });
    }
  }

  /**
   * Build a human-readable summary of the repo analysis.
   */
  private buildSummary(
    goal: string,
    rootFiles: string[],
    configFiles: string[],
    directories: string[],
    frameworks: Array<{ name: string; confidence: number }>,
  ): string {
    const parts: string[] = [];
    parts.push(`Repository analysis for: "${goal.slice(0, 60)}"`);
    parts.push(`Root files: ${rootFiles.length}, Source directories: ${directories.length}`);

    if (configFiles.length > 0) {
      parts.push(`Config files detected: ${configFiles.join(', ')}`);
    }

    if (frameworks.length > 0) {
      const names = frameworks.map((f) => `${f.name} (${Math.round(f.confidence * 100)}%)`);
      parts.push(`Frameworks: ${names.join(', ')}`);
    }

    return parts.join(' | ');
  }
}

/**
 * ArchitectureAgent — Modularity, dependency, and folder structure validation.
 *
 * Responsibilities:
 *   - Validate project structure modularity
 *   - Check dependency boundaries
 *   - Detect architectural inconsistencies
 *   - Provide structured recommendations
 *
 * Tool scope: read-only (read_file, list_files, search_files)
 *
 * This agent performs deterministic analysis — no AI reasoning.
 */

import { timestamp } from '@autic/shared';
import type {
  ArchitectureOutput,
  ResearchOutput,
  TaskContract,
  OrchestrationStage,
} from '@autic/shared';
import {
  createContract,
  fulfillContract,
  rejectContract,
  getContractOutput,
} from '../contracts.js';

type ToolRunner = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<{ success: boolean; data?: unknown; error?: string }>;

export class ArchitectureAgent {
  /**
   * Execute an architecture validation stage.
   */
  async execute(
    goal: string,
    runTool: ToolRunner,
    previousContract?: TaskContract,
  ): Promise<TaskContract> {
    const contract = createContract(
      'architecture' as OrchestrationStage,
      'engineering' as OrchestrationStage,
      'architecture_validation',
      { goal, timestamp: timestamp() },
    );

    try {
      // Get research and planning data
      const research = previousContract
        ? getContractOutput<ResearchOutput>(previousContract)
        : undefined;

      const validations: Array<{
        check: string;
        passed: boolean;
        message: string;
      }> = [];
      const recommendations: string[] = [];

      // 1. Validate project structure
      if (research) {
        const structureValid = research.repoStructure.directories.length > 0;
        validations.push({
          check: 'project-structure',
          passed: structureValid,
          message: structureValid
            ? `Found ${research.repoStructure.directories.length} source directories`
            : 'No standard source directories detected (src/, lib/, app/)',
        });

        if (!structureValid) {
          recommendations.push('Consider organizing source code under src/ or lib/ directories');
        }

        // 2. Check config file coverage
        const hasConfig = research.repoStructure.configFiles.length > 0;
        validations.push({
          check: 'config-files',
          passed: hasConfig,
          message: hasConfig
            ? `Found ${research.repoStructure.configFiles.length} configuration files`
            : 'No configuration files detected',
        });

        // 3. Framework consistency
        if (research.frameworks.length > 0) {
          validations.push({
            check: 'framework-detection',
            passed: true,
            message: `Detected: ${research.frameworks.map((f) => f.name).join(', ')}`,
          });
        }
      }

      // 4. Check dependency boundary (look for package coupling)
      try {
        const packageJsonResult = await runTool('read_file', {
          path: 'package.json',
          maxLength: 3000,
        });
        if (packageJsonResult.success && typeof packageJsonResult.data === 'string') {
          try {
            const pkg = JSON.parse(packageJsonResult.data);
            const depCount = Object.keys(pkg.dependencies || {}).length;
            const devDepCount = Object.keys(pkg.devDependencies || {}).length;

            validations.push({
              check: 'dependency-count',
              passed: depCount + devDepCount < 50,
              message: `${depCount} dependencies, ${devDepCount} devDependencies`,
            });

            if (depCount + devDepCount >= 50) {
              recommendations.push('Large dependency footprint — review for unused dependencies');
            }
          } catch {
            // Not valid JSON
          }
        }
      } catch {
        // File not found, skip
      }

      const consistent = validations.every((v) => v.passed);
      const summary = consistent
        ? 'Architecture validation passed — structure is consistent'
        : `Architecture has ${validations.filter((v) => !v.passed).length} issues to address`;

      const output: ArchitectureOutput = {
        validations,
        recommendations,
        consistent,
        summary,
      };

      return fulfillContract(contract, output as unknown as Record<string, unknown>);
    } catch (error) {
      return rejectContract(contract, error instanceof Error ? error.message : String(error));
    }
  }
}

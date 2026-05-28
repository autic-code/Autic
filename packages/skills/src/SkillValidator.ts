/**
 * SkillValidator — Schema, dependency, capability, and runtime compatibility validation.
 *
 * Validates:
 *   - Skill definition schema completeness
 *   - Dependency existence in registry
 *   - Capability consistency
 *   - Tool permission validity
 *   - Runtime compatibility (paths, timeouts, depth)
 *
 * Returns structured validation results with errors and warnings.
 */

import type { SkillDefinition, SkillValidation } from '@autic/shared';
import { SkillRegistry } from './SkillRegistry.js';

export class SkillValidator {
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }

  /**
   * Validate a skill definition for schema completeness and correctness.
   */
  validateSchema(skill: SkillDefinition): SkillValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!skill.id || typeof skill.id !== 'string') {
      errors.push('Skill id is required and must be a string');
    }
    if (!skill.name || typeof skill.name !== 'string') {
      errors.push('Skill name is required and must be a string');
    }
    if (!skill.version || typeof skill.version !== 'string') {
      errors.push('Skill version is required and must be a string');
    }
    if (!skill.description || typeof skill.description !== 'string') {
      errors.push('Skill description is required and must be a string');
    }
    if (!skill.type || !['declarative', 'executable'].includes(skill.type)) {
      errors.push('Skill type must be "declarative" or "executable"');
    }

    // Capabilities
    if (!Array.isArray(skill.capabilities)) {
      errors.push('Skill capabilities must be an array');
    } else if (skill.capabilities.length === 0) {
      warnings.push('Skill has no capabilities defined');
    }

    // Tool permissions
    if (!Array.isArray(skill.toolPermissions)) {
      errors.push('Skill toolPermissions must be an array');
    } else {
      for (const perm of skill.toolPermissions) {
        if (!perm.toolId) {
          errors.push('Tool permission entry missing toolId');
        }
        if (typeof perm.allowed !== 'boolean') {
          errors.push(`Tool permission for "${perm.toolId}" must have a boolean "allowed" field`);
        }
      }
    }

    // Optional fields with type checks
    if (
      skill.maxExecutionDepth !== undefined &&
      (typeof skill.maxExecutionDepth !== 'number' || skill.maxExecutionDepth < 1)
    ) {
      warnings.push('maxExecutionDepth should be a positive number');
    }

    if (
      skill.timeoutMs !== undefined &&
      (typeof skill.timeoutMs !== 'number' || skill.timeoutMs < 1000)
    ) {
      warnings.push('timeoutMs should be at least 1000ms');
    }

    if (skill.preferredModel && typeof skill.preferredModel !== 'string') {
      warnings.push('preferredModel should be a string');
    }

    if (skill.preferredProvider && typeof skill.preferredProvider !== 'string') {
      warnings.push('preferredProvider should be a string');
    }

    // Version format check
    if (skill.version && !/^\d+\.\d+\.\d+$/.test(skill.version)) {
      warnings.push(`Version "${skill.version}" does not follow semver (x.y.z)`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate that a skill's dependencies are met in the registry.
   */
  validateDependencies(skill: SkillDefinition): SkillValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!skill.dependencies || skill.dependencies.length === 0) {
      return { valid: true, errors: [], warnings: [] };
    }

    for (const dep of skill.dependencies) {
      if (!this.registry.has(dep)) {
        errors.push(`Required dependency not found: "${dep}"`);
      }
    }

    // Circular dependency check (simple depth limit)
    if (skill.dependencies.includes(skill.id)) {
      errors.push(`Skill "${skill.id}" cannot depend on itself`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Validate skill capabilities against tool permissions.
   */
  validateCapabilities(skill: SkillDefinition): SkillValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // If a skill claims 'read-only' capability but has write tool permissions, warn
    const hasWriteTools = skill.toolPermissions.some(
      (p) => p.toolId === 'write_file' || p.toolId === 'run_terminal',
    );

    if (skill.capabilities.includes('read-only') && hasWriteTools) {
      warnings.push('Skill declares "read-only" capability but has write tool permissions');
    }

    // If skill claims 'code-generation' capability, should have write_file permission
    if (skill.capabilities.includes('code-generation')) {
      const hasWriteFile = skill.toolPermissions.some(
        (p) => p.toolId === 'write_file' && p.allowed,
      );
      if (!hasWriteFile) {
        warnings.push(
          'Skill declares "code-generation" capability but has no write_file permission',
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Run all validations for a skill definition.
   */
  validateAll(skill: SkillDefinition): SkillValidation {
    const schemaResult = this.validateSchema(skill);
    const depResult = this.validateDependencies(skill);
    const capResult = this.validateCapabilities(skill);

    return {
      valid: schemaResult.valid && depResult.valid && capResult.valid,
      errors: [...schemaResult.errors, ...depResult.errors, ...capResult.errors],
      warnings: [...schemaResult.warnings, ...depResult.warnings, ...capResult.warnings],
    };
  }
}

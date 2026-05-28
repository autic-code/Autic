/**
 * SecurityValidator — Runtime security validation for autonomous workflows.
 *
 * Performs:
 *   - Unsafe workflow detection (patterns that could cause damage)
 *   - Excessive permission escalation checks
 *   - Provider trust validation
 *   - Suspicious execution pattern detection
 *
 * All checks are deterministic and lightweight.
 */

import {
  type SecurityValidation,
  type SecurityValidationCheck,
  type RiskLevel,
  type TrustProfile,
} from '@autic/shared';
import { SecurityEventSystem } from './security-events.js';
import { ExecutionSafetySystem } from './execution-safety.js';

export interface ValidationOptions {
  securityEvents?: SecurityEventSystem;
  executionSafety?: ExecutionSafetySystem;
}

/** Suspicious patterns that warrant validation warnings */
const SUSPICIOUS_PATTERNS = [
  {
    pattern: /rm\s+-rf\s+\S+\s*$/i,
    risk: 'high' as const,
    description: 'Recursive delete targeting specific path',
  },
  {
    pattern: /chmod\s+777/i,
    risk: 'high' as const,
    description: 'Setting world-writable permissions',
  },
  { pattern: /chown\s+-R/i, risk: 'high' as const, description: 'Recursive ownership change' },
  {
    pattern: />(?:\s*\/\w+){2,}/i,
    risk: 'medium' as const,
    description: 'Redirecting to system path',
  },
  { pattern: /\|\s*sudo/i, risk: 'high' as const, description: 'Piped escalation to sudo' },
  { pattern: /eval\s*\(/i, risk: 'high' as const, description: 'Dynamic code evaluation' },
  { pattern: /exec\s*\(/i, risk: 'high' as const, description: 'Command execution from string' },
  { pattern: /process\.env/i, risk: 'low' as const, description: 'Environment variable access' },
];

/** Provider trust levels */
const PROVIDER_TRUST: Record<string, { trusted: boolean; note: string }> = {
  openrouter: { trusted: true, note: 'Established provider routing service' },
  ollama: { trusted: true, note: 'Local provider, full control' },
  openai: { trusted: true, note: 'Established provider' },
  anthropic: { trusted: true, note: 'Established provider' },
};

export class SecurityValidator {
  private securityEvents: SecurityEventSystem;
  private executionSafety: ExecutionSafetySystem;

  constructor(options: ValidationOptions = {}) {
    this.securityEvents = options.securityEvents || new SecurityEventSystem();
    this.executionSafety = options.executionSafety || new ExecutionSafetySystem();
  }

  /**
   * Validate a workflow plan for security issues.
   */
  async validateWorkflow(plan: {
    goal: string;
    steps: Array<{
      description: string;
      type: string;
      toolName?: string;
      toolArgs?: Record<string, unknown>;
    }>;
  }): Promise<SecurityValidation> {
    const checks: SecurityValidationCheck[] = [];

    // Check each step for suspicious patterns
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];

      // Check tool call steps
      if (step.type === 'tool_call' && step.toolName === 'run_terminal') {
        const command = String(step.toolArgs?.command || '');

        // Check for suspicious patterns
        for (const sp of SUSPICIOUS_PATTERNS) {
          if (sp.pattern.test(command)) {
            checks.push({
              type: 'suspicious_pattern',
              name: `Suspicious command in step ${i + 1}`,
              passed: false,
              message: `Step ${i + 1}: ${sp.description}: "${command.slice(0, 100)}"`,
              details: `Risk: ${sp.risk}. Consider using a safer approach.`,
            });
          }
        }

        // Check for dangerous commands
        const safetyCheck = this.executionSafety.checkCommand(command);
        if (!safetyCheck.safe) {
          checks.push({
            type: 'unsafe_workflow',
            name: `Unsafe command in step ${i + 1}`,
            passed: false,
            message: `Step ${i + 1}: ${safetyCheck.reason}`,
            details: safetyCheck.suggestion,
          });
        }
      }
    }

    // Check for excessive permission escalation patterns
    const dangerousSteps = plan.steps.filter(
      (s) => s.type === 'tool_call' && s.toolName === 'run_terminal',
    );
    if (dangerousSteps.length > 5) {
      checks.push({
        type: 'permission_escalation',
        name: 'Excessive terminal execution steps',
        passed: false,
        message: `Workflow contains ${dangerousSteps.length} terminal execution steps`,
        details: 'Consider reducing the number of terminal calls to minimize risk.',
      });
    }

    const allPassed = checks.every((c) => c.passed);

    // Record validation events for failures
    for (const check of checks) {
      if (!check.passed) {
        this.securityEvents.record({
          type: 'validation:warning',
          severity: check.type === 'unsafe_workflow' ? 'critical' : 'warning',
          message: check.message,
          action: 'validation.workflow',
          details: { checkType: check.type, details: check.details },
        });
      }
    }

    return {
      passed: allPassed,
      checks,
      summary: allPassed
        ? 'Workflow validation passed'
        : `${checks.filter((c) => !c.passed).length} security issue(s) found`,
    };
  }

  /**
   * Validate a provider trust level.
   */
  validateProvider(providerType: string, providerId: string): SecurityValidationCheck {
    const trust = PROVIDER_TRUST[providerType];

    if (!trust) {
      this.securityEvents.record({
        type: 'validation:warning',
        severity: 'warning',
        message: `Unknown provider type: ${providerType} (${providerId})`,
        action: 'validation.provider',
        resource: providerId,
      });

      return {
        type: 'provider_trust',
        name: `Provider trust: ${providerId}`,
        passed: false,
        message: `Unknown provider type "${providerType}" — not in trusted provider list`,
        details: 'Only use established providers (openrouter, ollama, openai, anthropic).',
      };
    }

    if (!trust.trusted) {
      return {
        type: 'provider_trust',
        name: `Provider trust: ${providerId}`,
        passed: false,
        message: trust.note,
        details: `Provider ${providerId} is not trusted.`,
      };
    }

    return {
      type: 'provider_trust',
      name: `Provider trust: ${providerId}`,
      passed: true,
      message: trust.note,
    };
  }

  /**
   * Check for permission escalation across a sequence of actions.
   */
  checkPermissionEscalation(
    actions: Array<{ action: string; riskLevel: RiskLevel }>,
    trustProfile: TrustProfile,
  ): SecurityValidation {
    const checks: SecurityValidationCheck[] = [];
    let currentRiskLevel: RiskLevel = 'low';

    for (let i = 0; i < actions.length; i++) {
      const { action, riskLevel } = actions[i];

      // Detect escalation from low -> high
      if (currentRiskLevel === 'low' && riskLevel === 'high') {
        checks.push({
          type: 'permission_escalation',
          name: `Risk escalation at step ${i + 1}`,
          passed: false,
          message: `Escalation from low to high risk: ${action}`,
          details: `Trust profile "${trustProfile}" may not allow this. Consider breaking into smaller steps.`,
        });
      }

      // Update current risk level
      const riskOrder: RiskLevel[] = ['low', 'medium', 'high'];
      if (riskOrder.indexOf(riskLevel) > riskOrder.indexOf(currentRiskLevel)) {
        currentRiskLevel = riskLevel;
      }
    }

    const allPassed = checks.every((c) => c.passed);
    return {
      passed: allPassed,
      checks,
      summary: allPassed
        ? 'No permission escalation detected'
        : `${checks.filter((c) => !c.passed).length} escalation warning(s)`,
    };
  }

  /**
   * Get the list of suspicious patterns for external use.
   */
  static getSuspiciousPatterns(): Array<{ pattern: string; risk: string; description: string }> {
    return SUSPICIOUS_PATTERNS.map((sp) => ({
      pattern: sp.pattern.source,
      risk: sp.risk,
      description: sp.description,
    }));
  }
}

/**
 * Risk classification system for permission-aware execution.
 * Assesses risk levels for tool and system actions.
 * Integrates with the permission system as middleware hooks.
 */

import type { PermissionCheckRequest, PermissionCheckResult, RiskLevel } from '@autic/shared';
import { PermissionManager } from './permissions.js';

export interface RiskAssessmentConfig {
  /** Risk level definitions with rules for determining level */
  overrides?: Array<{
    pattern: string;
    level: RiskLevel;
  }>;
}

/** Default risk rules for common actions */
const DEFAULT_RISK_RULES: Array<{ pattern: string; level: RiskLevel }> = [
  // High risk — can modify system state
  { pattern: 'run_terminal:*', level: 'high' },
  { pattern: 'run_terminal:rm*', level: 'high' },
  { pattern: 'run_terminal:kill*', level: 'high' },
  { pattern: 'run_terminal:docker*', level: 'high' },
  { pattern: 'run_terminal:curl*', level: 'medium' },
  { pattern: 'run_terminal:git:push', level: 'high' },
  { pattern: 'run_terminal:git:commit', level: 'medium' },
  { pattern: 'run_terminal:git:reset', level: 'high' },
  { pattern: 'run_terminal:npm:publish', level: 'high' },
  { pattern: 'run_terminal:pnpm:publish', level: 'high' },

  // Medium risk — modifies project files
  { pattern: 'run_terminal:npm:*', level: 'medium' },
  { pattern: 'run_terminal:pnpm:*', level: 'medium' },
  { pattern: 'run_terminal:yarn:*', level: 'medium' },
  { pattern: 'write_file:*', level: 'medium' },
  { pattern: 'create_file:*', level: 'medium' },
  { pattern: 'modify_config:*', level: 'medium' },
  { pattern: 'run_terminal:mkdir*', level: 'low' },
  { pattern: 'run_terminal:touch*', level: 'low' },
  { pattern: 'run_terminal:mv*', level: 'medium' },
  { pattern: 'run_terminal:cp*', level: 'medium' },

  // Low risk — read-only operations
  { pattern: 'read_file:*', level: 'low' },
  { pattern: 'list_files:*', level: 'low' },
  { pattern: 'search_files:*', level: 'low' },
  { pattern: 'run_terminal:cat*', level: 'low' },
  { pattern: 'run_terminal:ls*', level: 'low' },
  { pattern: 'run_terminal:grep*', level: 'low' },
  { pattern: 'run_terminal:find*', level: 'low' },
  { pattern: 'run_terminal:head*', level: 'low' },
  { pattern: 'run_terminal:tail*', level: 'low' },
  { pattern: 'run_terminal:wc*', level: 'low' },
  { pattern: 'run_terminal:echo*', level: 'low' },
  { pattern: 'run_terminal:pwd*', level: 'low' },
  { pattern: 'run_terminal:which*', level: 'low' },
  { pattern: 'run_terminal:type*', level: 'low' },
  { pattern: 'run_terminal:node*version', level: 'low' },
  { pattern: 'run_terminal:npm*version', level: 'low' },
  { pattern: 'run_terminal:pnpm*version', level: 'low' },
  { pattern: 'run_terminal:pnpm:list*', level: 'low' },
  { pattern: 'run_terminal:npm:list*', level: 'low' },
  { pattern: 'run_terminal:git:status', level: 'low' },
  { pattern: 'run_terminal:git:log', level: 'low' },
  { pattern: 'run_terminal:git:diff', level: 'low' },
  { pattern: 'run_terminal:git:branch', level: 'low' },
];

export class RiskClassifier {
  private rules: Array<{ pattern: string; level: RiskLevel }>;
  private permissionManager: PermissionManager;

  constructor(
    config: RiskAssessmentConfig = {},
    permissionManager?: PermissionManager,
  ) {
    this.rules = [...DEFAULT_RISK_RULES, ...(config.overrides || [])];
    this.permissionManager = permissionManager || new PermissionManager();
  }

  /**
   * Classify the risk level of an action.
   * Returns the assessed risk level and any matching rule.
   */
  classify(action: string, resource: string): {
    level: RiskLevel;
    score: number;
    reasons: string[];
    matchingRule?: string;
  } {
    const actionPattern = `${action}:${resource}`;
    const reasons: string[] = [];

    // Check for exact match first
    for (const rule of this.rules) {
      if (this.patternMatches(rule.pattern, actionPattern)) {
        const score = rule.level === 'high' ? 0.8 : rule.level === 'medium' ? 0.5 : 0.2;
        return {
          level: rule.level,
          score,
          reasons: [`Matched risk rule: ${rule.pattern}`],
          matchingRule: rule.pattern,
        };
      }
    }

    // Check action-level match (e.g., run_terminal:*)
    const actionWildcard = `${action}:*`;
    for (const rule of this.rules) {
      if (this.patternMatches(rule.pattern, actionWildcard)) {
        const score = rule.level === 'high' ? 0.8 : rule.level === 'medium' ? 0.5 : 0.2;
        reasons.push(`Default risk for ${action}: ${rule.level}`);
        return { level: rule.level, score, reasons, matchingRule: rule.pattern };
      }
    }

    // Default: medium risk for unknown actions
    reasons.push(`No risk rule found for ${action}:${resource}, defaulting to medium`);
    return { level: 'medium', score: 0.5, reasons };
  }

  /**
   * Check if an action/resource is permitted based on risk and permissions.
   * Acts as middleware between the runtime and the permission system.
   */
  checkPermission(request: PermissionCheckRequest): PermissionCheckResult {
    const risk = this.classify(request.action, request.resource);
    const permissionCheck = this.permissionManager.can(request.action, request.resource);

    return {
      allowed: permissionCheck,
      riskLevel: risk.level,
      requiresApproval: risk.level === 'high' || (risk.level === 'medium' && !permissionCheck),
      reason: permissionCheck
        ? risk.reasons[0] || 'Permission granted'
        : `Permission denied: ${request.action} on ${request.resource}`,
    };
  }

  setPermissionManager(pm: PermissionManager): void {
    this.permissionManager = pm;
  }

  /**
   * Classify an execution action (broader than a single action/resource pair).
   * Used for batch or compound action assessment.
   */
  classifyExecution(actions: Array<{ action: string; resource: string }>): {
    maxLevel: RiskLevel;
    averageScore: number;
    counts: { low: number; medium: number; high: number };
    recommendations: string[];
  } {
    const counts = { low: 0, medium: 0, high: 0 };
    let totalScore = 0;
    const recommendations: string[] = [];

    for (const { action, resource } of actions) {
      const assessment = this.classify(action, resource);
      counts[assessment.level]++;
      totalScore += assessment.score;
    }

    const maxLevel: RiskLevel = counts.high > 0 ? 'high' : counts.medium > 0 ? 'medium' : 'low';
    const averageScore = actions.length > 0 ? totalScore / actions.length : 0;

    if (counts.high > 0) {
      recommendations.push(`${counts.high} high-risk action(s) detected — consider manual review`);
    }
    if (counts.medium > 3) {
      recommendations.push(`${counts.medium} medium-risk actions — batch may need oversight`);
    }
    if (averageScore > 0.6) {
      recommendations.push('Overall risk score is elevated — proceed with caution');
    }

    return { maxLevel, averageScore, counts, recommendations };
  }

  /**
   * Add custom risk rules at runtime.
   */
  addRule(pattern: string, level: RiskLevel): void {
    this.rules.unshift({ pattern, level });
  }

  /**
   * Simple glob-style pattern matching.
   * Supports * wildcard at any position.
   */
  private patternMatches(pattern: string, target: string): boolean {
    // Exact match
    if (pattern === target) return true;

    // Convert glob pattern to regex
    const regexStr = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\*/g, '.*'); // Convert * to .*

    try {
      return new RegExp(`^${regexStr}$`).test(target);
    } catch {
      return false;
    }
  }
}

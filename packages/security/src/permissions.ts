/**
 * Permission system foundation
 * Manages action/resource permission checks with level-based access control
 * and approval hooks for the runtime.
 */

export type PermissionLevel = 'low' | 'medium' | 'high';

/** Maps action categories to permission levels */
const ACTION_LEVELS: Record<string, PermissionLevel> = {
  read_file: 'low',
  list_files: 'low',
  search_files: 'low',
  write_file: 'medium',
  create_file: 'medium',
  delete_file: 'high',
  modify_config: 'medium',
  run_terminal: 'medium',
  install_dependency: 'medium',
  run_migration: 'high',
  deploy: 'high',
  modify_secret: 'high',
  delete_resource: 'high',
};

export interface PermissionRule {
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
  level?: PermissionLevel;
}

export interface PermissionCheck {
  allowed: boolean;
  rule?: PermissionRule;
  reason?: string;
  level?: PermissionLevel;
  requiresApproval?: boolean;
}

export type ApprovalHandler = (check: PermissionCheck) => Promise<boolean>;

export class PermissionManager {
  private rules: PermissionRule[] = [];
  private approvalHandlers: ApprovalHandler[] = [];

  constructor(rules: PermissionRule[] = []) {
    this.rules = [...rules];
  }

  addRule(rule: PermissionRule): void {
    this.rules.push(rule);
  }

  removeRule(action: string, resource: string): void {
    this.rules = this.rules.filter((r) => !(r.action === action && r.resource === resource));
  }

  /**
   * Register an approval handler that is called when a permission check
   * requires user or external approval.
   */
  addApprovalHandler(handler: ApprovalHandler): void {
    this.approvalHandlers.push(handler);
  }

  /**
   * Check permission for an action/resource pair.
   * Returns the permission check result with level and approval requirements.
   */
  check(action: string, resource: string): PermissionCheck {
    // Deny rules take precedence
    const denyRule = this.rules.find(
      (r) => r.effect === 'deny' && this.matches(r, action, resource),
    );
    if (denyRule) {
      return {
        allowed: false,
        rule: denyRule,
        reason: `Denied by rule: ${denyRule.action} on ${denyRule.resource}`,
        level: denyRule.level || this.resolveLevel(action),
        requiresApproval: false,
      };
    }

    const allowRule = this.rules.find(
      (r) => r.effect === 'allow' && this.matches(r, action, resource),
    );
    if (allowRule) {
      return {
        allowed: true,
        rule: allowRule,
        level: allowRule.level || this.resolveLevel(action),
        requiresApproval: false,
      };
    }

    // No explicit rule — determine by level
    const level = this.resolveLevel(action);
    const requiresApproval = level === 'high';

    return {
      allowed: !requiresApproval,
      reason: requiresApproval
        ? `High-risk action requires approval: ${action} on ${resource}`
        : undefined,
      level,
      requiresApproval,
    };
  }

  /**
   * Check permission with approval flow.
   * Runs approval handlers if the check requires approval.
   */
  async checkWithApproval(action: string, resource: string): Promise<PermissionCheck> {
    const check = this.check(action, resource);

    if (check.requiresApproval && this.approvalHandlers.length > 0) {
      let approved = false;
      for (const handler of this.approvalHandlers) {
        if (await handler(check)) {
          approved = true;
          break;
        }
      }
      return {
        ...check,
        allowed: approved,
        requiresApproval: !approved,
        reason: approved ? `Approved: ${action} on ${resource}` : check.reason,
      };
    }

    return check;
  }

  can(action: string, resource: string): boolean {
    return this.check(action, resource).allowed;
  }

  /**
   * Get the permission level for an action.
   */
  resolveLevel(action: string): PermissionLevel {
    // Check exact match
    if (ACTION_LEVELS[action]) return ACTION_LEVELS[action];

    // Check prefix match (e.g., run_terminal:rm -> medium)
    for (const [key, level] of Object.entries(ACTION_LEVELS)) {
      if (action.startsWith(key)) return level;
    }

    return 'medium';
  }

  clear(): void {
    this.rules = [];
    this.approvalHandlers = [];
  }

  getRules(): PermissionRule[] {
    return [...this.rules];
  }

  private matches(rule: PermissionRule, action: string, resource: string): boolean {
    return (
      (rule.action === '*' || rule.action === action) &&
      (rule.resource === '*' || rule.resource === resource)
    );
  }
}

export function createDefaultPermissions(): PermissionManager {
  const pm = new PermissionManager();
  // Default: allow read operations, deny everything else
  pm.addRule({ action: 'read', resource: '*', effect: 'allow', level: 'low' });
  pm.addRule({ action: 'read_file', resource: '*', effect: 'allow', level: 'low' });
  pm.addRule({ action: 'list_files', resource: '*', effect: 'allow', level: 'low' });
  pm.addRule({ action: 'search_files', resource: '*', effect: 'allow', level: 'low' });
  pm.addRule({ action: '*', resource: '*', effect: 'deny', level: 'medium' });
  return pm;
}

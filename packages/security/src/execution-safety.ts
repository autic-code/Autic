/**
 * ExecutionSafetySystem — Runtime safety middleware for autonomous workflows.
 *
 * Provides:
 *   - Dangerous command detection (rm -rf, recursive deletes, destructive operations)
 *   - Path protection (prevent modifications outside workspace boundaries)
 *   - Recursion protection (limit nested execution depth)
 *   - Destructive action classification
 *   - Sandbox hooks for isolated execution
 *
 * All checks are deterministic and lightweight.
 */

import { type ExecutionSafetyCheck, type RiskLevel, type DangerousPattern } from '@autic/shared';

/** Default dangerous command patterns */
const DESTRUCTIVE_PATTERNS: DangerousPattern[] = [
  {
    pattern: /^rm\s+-rf\s+(?:\/\s*|\.\s*|\*)/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Recursive force delete of root or all files',
  },
  {
    pattern: /^rm\s+-rf/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Recursive force delete',
  },
  {
    pattern: /^rmdir\s+\//i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Delete root directory',
  },
  {
    pattern: /^mkfs/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Format filesystem',
  },
  {
    pattern: /^dd\s+if=/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Raw disk write',
  },
  {
    pattern: /^chmod\s+777/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Make files world-writable',
  },
  {
    pattern: /^chown\s+-R/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Recursive ownership change',
  },
  {
    pattern: /^sudo/i,
    classification: 'system',
    riskLevel: 'high',
    description: 'Superuser command execution',
  },
  { pattern: /^su\s/, classification: 'system', riskLevel: 'high', description: 'Switch user' },
  {
    pattern: /^passwd/i,
    classification: 'system',
    riskLevel: 'high',
    description: 'Password modification',
  },
  {
    pattern: /^docker\s+(rm|kill|stop|system)/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Docker destructive operation',
  },
  {
    pattern: /^npm\s+(publish|unpublish)/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Package publishing',
  },
  {
    pattern: /^pnpm\s+(publish|unpublish)/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Package publishing',
  },
  {
    pattern: /^git\s+push\s+--force/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Force push to git',
  },
  {
    pattern: /^git\s+reset\s+--hard/i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Hard git reset',
  },
  {
    pattern: /^curl\s+.+?--data/i,
    classification: 'network',
    riskLevel: 'medium',
    description: 'HTTP request with data payload',
  },
  {
    pattern: /^wget\s+/i,
    classification: 'network',
    riskLevel: 'medium',
    description: 'File download',
  },
  {
    pattern: /^ssh\s+/i,
    classification: 'network',
    riskLevel: 'medium',
    description: 'SSH connection',
  },
  {
    pattern: />\s*\/dev\//i,
    classification: 'destructive',
    riskLevel: 'high',
    description: 'Write to device file',
  },
  {
    pattern: /\|\s*sudo/i,
    classification: 'system',
    riskLevel: 'high',
    description: 'Piped sudo execution',
  },
];

/** Paths that should never be modified */
const PROTECTED_PATHS = [
  '/etc',
  '/boot',
  '/dev',
  '/proc',
  '/sys',
  '/bin',
  '/sbin',
  '/usr/bin',
  '/usr/sbin',
  '/usr/lib',
  '/lib',
  '/lib64',
  '/opt',
  '/var/log',
  '/var/lib',
];

export interface ExecutionSafetyOptions {
  workspaceDir?: string;
  customPatterns?: DangerousPattern[];
  allowListedPatterns?: RegExp[];
}

export class ExecutionSafetySystem {
  private patterns: DangerousPattern[];
  private allowListedPatterns: RegExp[];
  private workspaceDir: string;

  constructor(options: ExecutionSafetyOptions = {}) {
    this.patterns = [...DESTRUCTIVE_PATTERNS, ...(options.customPatterns || [])];
    this.allowListedPatterns = options.allowListedPatterns || [];
    this.workspaceDir = options.workspaceDir || process.cwd();
  }

  /**
   * Check if a command is safe to execute.
   * Returns a structured safety check result.
   */
  checkCommand(command: string, _cwd?: string): ExecutionSafetyCheck {
    const matchedPatterns: string[] = [];

    // Check allowlist first
    for (const allowed of this.allowListedPatterns) {
      if (allowed.test(command)) {
        return {
          safe: true,
          classification: 'safe',
          riskLevel: 'low',
          matchedPatterns: [],
          reason: 'Command matches allowlist pattern',
        };
      }
    }

    // Check dangerous patterns
    for (const dp of this.patterns) {
      if (dp.pattern.test(command)) {
        matchedPatterns.push(dp.description);

        if (dp.classification === 'destructive') {
          return {
            safe: false,
            classification: 'dangerous',
            riskLevel: 'high',
            matchedPatterns,
            reason: `Destructive command detected: ${dp.description}`,
            suggestion: `Action "${dp.description}" is blocked by execution safety. Set allowDangerousActions=true to enable.`,
          };
        }
      }
    }

    if (matchedPatterns.length > 0) {
      return {
        safe: false,
        classification: 'suspicious',
        riskLevel: 'medium',
        matchedPatterns,
        reason: `Suspicious command patterns detected: ${matchedPatterns.join(', ')}`,
      };
    }

    return {
      safe: true,
      classification: 'safe',
      riskLevel: 'low',
      matchedPatterns: [],
    };
  }

  /**
   * Check if a file path is within the workspace boundary.
   * Prevents accidental modification of system files.
   */
  checkPathSafety(targetPath: string): ExecutionSafetyCheck {
    const normalizedPath = targetPath.replace(/\\/g, '/');

    // Check for protected paths
    for (const protectedPath of PROTECTED_PATHS) {
      if (normalizedPath.startsWith(protectedPath)) {
        return {
          safe: false,
          classification: 'dangerous',
          riskLevel: 'high',
          matchedPatterns: [`Protected path: ${protectedPath}`],
          reason: `Cannot modify protected system path: ${protectedPath}`,
          suggestion: 'Only modify files within the workspace directory.',
        };
      }
    }

    // Check if path is within workspace
    const workspaceNormalized = this.workspaceDir.replace(/\\/g, '/');
    if (!normalizedPath.startsWith(workspaceNormalized)) {
      return {
        safe: false,
        classification: 'suspicious',
        riskLevel: 'medium',
        matchedPatterns: ['Path outside workspace'],
        reason: `Target path is outside workspace boundary: ${targetPath}`,
        suggestion: 'Operation restricted to workspace directory.',
      };
    }

    return {
      safe: true,
      classification: 'safe',
      riskLevel: 'low',
      matchedPatterns: [],
    };
  }

  /**
   * Classify an action into its safety category.
   */
  classifyAction(action: string): {
    category: 'destructive' | 'network' | 'system' | 'read' | 'write' | 'unknown';
    riskLevel: RiskLevel;
  } {
    const writeActions = [
      'write_file',
      'create_file',
      'delete_file',
      'modify_config',
      'install',
      'mv',
      'cp',
    ];
    const destructiveActions = ['rm', 'rmdir', 'chmod', 'chown', 'mkfs', 'dd'];
    const networkActions = ['curl', 'wget', 'ssh', 'docker'];
    const systemActions = ['sudo', 'su', 'passwd', 'service', 'systemctl'];
    const readActions = [
      'read_file',
      'list_files',
      'search_files',
      'cat',
      'ls',
      'grep',
      'head',
      'tail',
      'wc',
    ];

    if (destructiveActions.some((a) => action.startsWith(a))) {
      return { category: 'destructive', riskLevel: 'high' };
    }
    if (networkActions.some((a) => action.startsWith(a))) {
      return { category: 'network', riskLevel: 'medium' };
    }
    if (systemActions.some((a) => action.startsWith(a))) {
      return { category: 'system', riskLevel: 'high' };
    }
    if (writeActions.some((a) => action.startsWith(a))) {
      return { category: 'write', riskLevel: 'medium' };
    }
    if (readActions.some((a) => action.startsWith(a))) {
      return { category: 'read', riskLevel: 'low' };
    }

    return { category: 'unknown', riskLevel: 'medium' };
  }

  /**
   * Check execution depth recursion protection.
   */
  checkRecursion(depth: number, maxDepth: number): ExecutionSafetyCheck {
    if (depth > maxDepth) {
      return {
        safe: false,
        classification: 'dangerous',
        riskLevel: 'high',
        matchedPatterns: ['Recursion limit exceeded'],
        reason: `Execution depth (${depth}) exceeds maximum allowed (${maxDepth})`,
        suggestion: 'Increase maxExecutionDepth or reduce workflow complexity.',
      };
    }

    return {
      safe: true,
      classification: 'safe',
      riskLevel: 'low',
      matchedPatterns: [],
    };
  }

  /**
   * Add a custom dangerous pattern at runtime.
   */
  addPattern(pattern: DangerousPattern): void {
    this.patterns.push(pattern);
  }

  /**
   * Add an allowlisted pattern (overrides dangerous pattern matching).
   */
  addAllowlistedPattern(pattern: RegExp): void {
    this.allowListedPatterns.push(pattern);
  }
}

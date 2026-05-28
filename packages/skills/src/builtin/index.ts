/**
 * Built-in skills registration.
 * Exports a function to register all production skills into a SkillRegistry.
 */

import { SkillRegistry } from '../SkillRegistry.js';
import type { SkillDefinition, AgentDefinition } from '@autic/shared';

/** All built-in skill definitions */
const BUILTIN_SKILLS: SkillDefinition[] = [
  // ---- code-fixer ----
  {
    id: 'code-fixer',
    name: 'Code Fixer',
    version: '1.0.0',
    description: 'Detect, patch, verify, and retry code fixes with bounded repair loops',
    type: 'executable',
    capabilities: ['code-fixing', 'bug-fixing', 'patch-generation', 'static-analysis'],
    preferredModel: 'claude-3.5-sonnet',
    preferredProvider: 'openrouter',
    toolPermissions: [
      { toolId: 'read_file', allowed: true },
      { toolId: 'write_file', allowed: true },
      { toolId: 'search_files', allowed: true },
      { toolId: 'list_files', allowed: true },
      {
        toolId: 'run_terminal',
        allowed: true,
        resourcePattern: 'npm test|pnpm test|tsc|build|lint',
      },
    ],
    maxExecutionDepth: 10,
    timeoutMs: 300_000,
    workflowPipeline: ['analyze', 'plan', 'tool_call', 'verify', 'repair', 'verify'],
  },

  // ---- repo-analyzer ----
  {
    id: 'repo-analyzer',
    name: 'Repository Analyzer',
    version: '1.0.0',
    description:
      'Analyze repository structure, dependencies, and architecture. Read-only by default.',
    type: 'executable',
    capabilities: ['read-only', 'repo-analysis', 'dependency-analysis', 'architecture-detection'],
    preferredModel: 'claude-3-haiku',
    preferredProvider: 'openrouter',
    toolPermissions: [
      { toolId: 'read_file', allowed: true },
      { toolId: 'search_files', allowed: true },
      { toolId: 'list_files', allowed: true },
      { toolId: 'run_terminal', allowed: true, resourcePattern: 'ls|cat|head|tail|wc|grep|find' },
    ],
    maxExecutionDepth: 5,
    timeoutMs: 120_000,
    workflowPipeline: ['analyze', 'tool_call', 'plan', 'tool_call'],
  },

  // ---- typescript-engineer ----
  {
    id: 'typescript-engineer',
    name: 'TypeScript Engineer',
    version: '1.0.0',
    description:
      'TypeScript-specific engineering: types, generics, refactoring, and strict-mode fixes',
    type: 'executable',
    capabilities: ['code-generation', 'typescript', 'type-fixing', 'refactoring', 'code-fixing'],
    preferredModel: 'claude-3.5-sonnet',
    preferredProvider: 'openrouter',
    toolPermissions: [
      { toolId: 'read_file', allowed: true },
      { toolId: 'write_file', allowed: true },
      { toolId: 'search_files', allowed: true },
      { toolId: 'list_files', allowed: true },
      {
        toolId: 'run_terminal',
        allowed: true,
        resourcePattern: 'tsc|pnpm build|npm run build|npx tsc',
      },
    ],
    maxExecutionDepth: 15,
    timeoutMs: 300_000,
    workflowPipeline: [
      'analyze',
      'tool_call',
      'plan',
      'tool_call',
      'verify',
      'repair',
      'verify',
      'complete',
    ],
  },

  // ---- debugging-specialist ----
  {
    id: 'debugging-specialist',
    name: 'Debugging Specialist',
    version: '1.0.0',
    description: 'Systematic debugging: reproduce, isolate, diagnose, fix, and verify',
    type: 'executable',
    capabilities: ['debugging', 'bug-fixing', 'diagnosis', 'error-analysis'],
    preferredModel: 'claude-3.5-sonnet',
    preferredProvider: 'openrouter',
    toolPermissions: [
      { toolId: 'read_file', allowed: true },
      { toolId: 'search_files', allowed: true },
      { toolId: 'list_files', allowed: true },
      { toolId: 'run_terminal', allowed: true },
    ],
    maxExecutionDepth: 10,
    timeoutMs: 300_000,
    workflowPipeline: [
      'analyze',
      'tool_call',
      'tool_call',
      'plan',
      'tool_call',
      'verify',
      'repair',
      'verify',
    ],
  },

  // ---- startup-builder ----
  {
    id: 'startup-builder',
    name: 'Startup Builder',
    version: '1.0.0',
    description:
      'Full project scaffolding: analyze requirements, scaffold structure, configure, verify',
    type: 'executable',
    capabilities: ['code-generation', 'scaffolding', 'project-setup', 'architecture-design'],
    preferredModel: 'claude-3.5-sonnet',
    preferredProvider: 'openrouter',
    toolPermissions: [
      { toolId: 'read_file', allowed: true },
      { toolId: 'write_file', allowed: true },
      { toolId: 'list_files', allowed: true },
      { toolId: 'search_files', allowed: true },
      {
        toolId: 'run_terminal',
        allowed: true,
        resourcePattern: 'pnpm|npm|npx|mkdir|git init|tsc|build',
      },
    ],
    maxExecutionDepth: 20,
    timeoutMs: 600_000,
    workflowPipeline: [
      'analyze',
      'tool_call',
      'plan',
      'tool_call',
      'tool_call',
      'tool_call',
      'verify',
      'complete',
    ],
  },
];

/**
 * Register all built-in skills into a SkillRegistry.
 * Also registers corresponding agents for each skill.
 */
export function registerBuiltinSkills(
  skillRegistry: SkillRegistry,
  agentRegistry?: { register: (a: AgentDefinition) => void },
): void {
  for (const skill of BUILTIN_SKILLS) {
    skillRegistry.register(skill);

    // Register a matching agent for each skill
    if (agentRegistry) {
      agentRegistry.register({
        id: `agent-${skill.id}`,
        name: `${skill.name} Agent`,
        description: `Specialized execution coordinator for ${skill.name}`,
        capabilities: skill.capabilities,
        maxDepth: skill.maxExecutionDepth || 10,
        timeoutMs: skill.timeoutMs || 300_000,
        allowedTools: skill.toolPermissions.filter((p) => p.allowed).map((p) => p.toolId),
        preferredModel: skill.preferredModel,
        preferredProvider: skill.preferredProvider,
        defaultPipeline: skill.workflowPipeline,
      });
    }
  }
}

/** Individual skill access for direct use */
export const BUILTIN_SKILL_DEFINITIONS = BUILTIN_SKILLS;

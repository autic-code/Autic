/**
 * @autic/skills — Modular skills and agent architecture for specialized execution.
 *
 * Skills are reusable engineering workflows (code-fixer, repo-analyzer, etc.).
 * Agents are bounded execution coordinators with scoped tool/memory access.
 *
 * All execution is:
 *   - Bounded by depth, timeouts, and recursion limits
 *   - Isolated with scoped tool permissions
 *   - Inspectable via agent context snapshots
 *   - Deterministic and safe
 */

export { SkillRegistry } from './SkillRegistry.js';
export type { SkillRegistryOptions } from './SkillRegistry.js';

export { AgentRegistry } from './AgentRegistry.js';
export type { AgentRegistryOptions } from './AgentRegistry.js';

export { SkillExecutor } from './SkillExecutor.js';
export type { SkillExecutorOptions, ExecutionReport } from './SkillExecutor.js';

export { SkillValidator } from './SkillValidator.js';

export { registerBuiltinSkills, BUILTIN_SKILL_DEFINITIONS } from './builtin/index.js';

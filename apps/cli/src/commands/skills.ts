/**
 * autic skills — Skills and agent management command.
 *
 * Subcommands:
 *   list      — List installed skills with agent info
 *   install   — Install a skill from an inline definition (stub for future file loading)
 *   remove    — Remove an installed skill
 *   run       — Run a skill as an agent-driven workflow with real-time UI
 */

import { SkillRegistry, AgentRegistry, SkillExecutor, SkillValidator, registerBuiltinSkills, BUILTIN_SKILL_DEFINITIONS } from '@autic/skills';
import { colorText, heading, agentSummary } from '@autic/ui';
import type { AgentDisplay } from '@autic/ui';
import { ToolRegistry, readFileTool, writeFileTool, listFilesTool, searchFilesTool, runTerminalTool } from '@autic/tools';

// Lazy singletons
let _skillRegistry: SkillRegistry | null = null;
let _agentRegistry: AgentRegistry | null = null;
let _skillExecutor: SkillExecutor | null = null;
let _skillValidator: SkillValidator | null = null;

function getSkillRegistry(): SkillRegistry {
  if (!_skillRegistry) {
    _skillRegistry = new SkillRegistry();
    _agentRegistry = new AgentRegistry();
    registerBuiltinSkills(_skillRegistry, _agentRegistry);
    _skillValidator = new SkillValidator(_skillRegistry);
    _skillExecutor = new SkillExecutor(_skillRegistry, _agentRegistry, {
      maxDepth: 10,
      defaultTimeoutMs: 120_000,
      maxSteps: 20,
      maxRetries: 3,
    });
  }
  return _skillRegistry;
}

function getAgentRegistry(): AgentRegistry {
  getSkillRegistry(); // ensures init
  return _agentRegistry!;
}

function getSkillExecutor(): SkillExecutor {
  getSkillRegistry(); // ensures init
  return _skillExecutor!;
}

function getSkillValidator(): SkillValidator {
  getSkillRegistry(); // ensures init
  return _skillValidator!;
}

/** Tool handler mapping: string IDs to actual async functions.
 * Functions are cast since they accept specific arg shapes at runtime. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TOOL_HANDLERS: Record<string, (args: any) => Promise<{ success: boolean; data?: unknown; error?: string }>> = {
  readFileTool,
  writeFileTool,
  listFilesTool,
  searchFilesTool,
  runTerminalTool,
};

/** Build a tool executor from ToolRegistry */
function buildToolExecutor() {
  const toolRegistry = new ToolRegistry();
  return async (toolName: string, args: Record<string, unknown>) => {
    const tool = toolRegistry.get(toolName);
    if (!tool) {
      return { success: false, data: undefined, error: `Tool not found: ${toolName}` };
    }
    const handler = TOOL_HANDLERS[tool.handler];
    if (!handler) {
      return { success: false, data: undefined, error: `Tool handler not found: ${tool.handler}` };
    }
    try {
      const result = await handler(args);
      return { success: result.success, data: result.data, error: result.error };
    } catch (err) {
      return { success: false, data: undefined, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

/**
 * autic skills list
 */
export async function skillsListCommand(): Promise<void> {
  const registry = getSkillRegistry();
  const agents = getAgentRegistry();
  const skills = registry.list();

  if (skills.length === 0) {
    console.log(heading('No skills installed'));
    return;
  }

  console.log(heading(`Installed Skills (${skills.length})`));

  for (const skill of skills) {
    const agent = agents.get(`agent-${skill.id}`);
    const icon = skill.type === 'executable' ? '⚡' : '📋';
    const providerLine = skill.preferredProvider
      ? ` ${colorText(`via ${skill.preferredProvider}`, 'dim')}`
      : '';
    const modelLine = skill.preferredModel
      ? ` ${colorText(`[${skill.preferredModel}]`, 'dim')}`
      : '';
    const pipeline = skill.workflowPipeline?.join(' → ') || '—';

    console.log(`  ${icon} ${colorText(skill.name, 'primary')}${colorText(` v${skill.version}`, 'dim')}`);
    console.log(`     ${skill.description}`);
    console.log(`     ${colorText('Capabilities:', 'dim')} ${skill.capabilities.join(', ')}`);
    console.log(`     ${colorText('Pipeline:', 'dim')} ${pipeline}`);
    if (agent) {
      console.log(`     ${colorText('Agent:', 'dim')} ${agent.id} (max depth: ${agent.maxDepth}, timeout: ${agent.timeoutMs}ms)`);
      console.log(`     ${colorText('Tools:', 'dim')} ${agent.allowedTools.join(', ')}`);
    }
    console.log(`     ${providerLine}${modelLine}`);
    console.log('');
  }
}

/**
 * autic skills install <name>
 */
export async function skillsInstallCommand(name: string): Promise<void> {
  const registry = getSkillRegistry();

  // Check if already installed
  if (registry.findByName(name).length > 0) {
    console.log(`  ${colorText('!', 'warning')} Skill matching "${name}" is already installed`);
    return;
  }

  // For Phase 7, we only support builtin skills and inline definitions
  // Try to find a built-in skill matching the name
  const match = BUILTIN_SKILL_DEFINITIONS.find(
    (s) => s.id === name || s.name.toLowerCase() === name.toLowerCase(),
  );

  if (match) {
    // Register manually (if not already via registerBuiltinSkills)
    try {
      const validator = getSkillValidator();
      const validation = validator.validateAll(match);
      if (!validation.valid) {
        console.log(`  ${colorText('✗', 'error')} Validation failed for "${name}":`);
        for (const err of validation.errors) {
          console.log(`    ${colorText('•', 'error')} ${err}`);
        }
        return;
      }
      registry.register(match);
      const agentRegistry = getAgentRegistry();
      agentRegistry.register({
        id: `agent-${match.id}`,
        name: `${match.name} Agent`,
        description: `Specialized execution coordinator for ${match.name}`,
        capabilities: match.capabilities,
        maxDepth: match.maxExecutionDepth || 10,
        timeoutMs: match.timeoutMs || 300_000,
        allowedTools: match.toolPermissions.filter((p) => p.allowed).map((p) => p.toolId),
        preferredModel: match.preferredModel,
        preferredProvider: match.preferredProvider,
        defaultPipeline: match.workflowPipeline,
      });
      console.log(`  ${colorText('✓', 'success')} Installed skill: ${colorText(match.name, 'primary')} v${match.version}`);
    } catch (err) {
      console.log(`  ${colorText('✗', 'error')} Failed to install "${name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    console.log(`  ${colorText('!', 'warning')} Skill "${name}" not found. Available built-in skills:`);
    for (const s of BUILTIN_SKILL_DEFINITIONS) {
      console.log(`    ${colorText('•', 'primary')} ${s.id} — ${s.description}`);
    }
  }
}

/**
 * autic skills remove <name>
 */
export async function skillsRemoveCommand(name: string): Promise<void> {
  const registry = getSkillRegistry();
  const agents = getAgentRegistry();

  const skills = registry.findByName(name);
  if (skills.length === 0) {
    console.log(`  ${colorText('!', 'warning')} No skill found matching "${name}"`);
    return;
  }

  for (const skill of skills) {
    registry.unregister(skill.id);
    agents.unregister(`agent-${skill.id}`);
    console.log(`  ${colorText('✓', 'success')} Removed skill: ${colorText(skill.name, 'primary')}`);
  }
}

/**
 * autic skills run <name> [goal]
 */
export async function skillsRunCommand(name: string, goal?: string): Promise<void> {
  const registry = getSkillRegistry();
  const skills = registry.findByName(name);

  if (skills.length === 0) {
    console.log(`  ${colorText('✗', 'error')} Skill "${name}" not found. Use ${colorText('autic skills list', 'primary')} to see available skills.`);
    return;
  }

  const skill = skills[0];
  const defaultGoal = goal || `Execute ${skill.name}: ${skill.description}`;

  console.log(`  ${colorText('⟳', 'primary')} Starting ${colorText(skill.name, 'primary')}...`);
  console.log(`  ${colorText('Goal:', 'dim')} ${defaultGoal}`);
  console.log('');

  // Set up tool executor
  const toolExec = buildToolExecutor();
  const executor = getSkillExecutor();
  executor.setToolExecutor(toolExec);

  // Run the skill (SkillExecutor creates its own internal coordinator)
  // Note: Real-time event streaming will be wired when SkillExecutor gains event exposure
  const report = await executor.executeSkill({
    skillId: skill.id,
    goal: defaultGoal,
    sessionId: 'skills-cli',
  });

  // Build summary from execution report
  const agentDisplay: AgentDisplay = {
    agentId: `agent-${skill.id}`,
    skillName: skill.name,
    goal: defaultGoal,
    status: report.success ? 'completed' : 'failed',
    steps: [],
    depth: 0,
    maxDepth: skill.maxExecutionDepth || 10,
    durationMs: report.durationMs,
    error: report.error,
  };

  console.log('');
  console.log(colorText('─'.repeat(48), 'dim'));
  const summary = agentSummary(agentDisplay);
  for (const line of summary) {
    console.log(`  ${line}`);
  }
  console.log('');
}

/**
 * Main skills command dispatcher
 */
export async function skillsCommand(
  action?: string,
  name?: string,
  options?: Record<string, string>,
): Promise<void> {
  switch (action) {
    case 'list':
    case undefined:
      await skillsListCommand();
      break;

    case 'install':
      if (!name) {
        console.log(`${colorText('Usage:', 'primary')} autic skills install <name>`);
        return;
      }
      await skillsInstallCommand(name);
      break;

    case 'remove':
      if (!name) {
        console.log(`${colorText('Usage:', 'primary')} autic skills remove <name>`);
        return;
      }
      await skillsRemoveCommand(name);
      break;

    case 'run':
      if (!name) {
        console.log(`${colorText('Usage:', 'primary')} autic skills run <name> [goal]`);
        return;
      }
      await skillsRunCommand(name, options?.goal);
      break;

    default:
      console.log(`${colorText('Unknown action:', 'error')} ${action}`);
      console.log(`  ${colorText('Usage:', 'primary')} autic skills <list|install|remove|run> [args]`);
  }
}

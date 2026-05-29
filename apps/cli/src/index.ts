#!/usr/bin/env node

/**
 * Autic — CLI-native autonomous AI engineering runtime.
 *
 * Main entry point with commander-based command structure.
 */

import { Command } from 'commander';
import { CLI_NAME, CLI_VERSION, CLI_DESCRIPTION } from './constants.js';
import { renderError, colorText } from '@autic/ui';
import {
  dashboardCommand,
  initCommand,
  buildCommand,
  chatCommand,
  fixCommand,
  runCommand,
  providersCommand,
  modelsCommand,
  sessionsCommand,
  doctorCommand,
  workflowCommand,
  securityCommand,
  privacyCommand,
  skillsCommand,
  orchestrateCommand,
  stabilityCommand,
  learningCommand,
  swarmCommand,
  contextCommand,
  configCommand,
  profileCommand,
  updateCommand,
  debugCommand,
  helpCommand,
  // Phase 14 — Production Hardening
  auditCommand,
  stressCommand,
  protectCommand,
  memoryCommand,
  validateCommand,
  diagnoseCommand,
  systemCommand,
  swarmHardeningCommand,
  fsCommand,
  recoveryCommand,
  // Phase 15 — Final Production Polish + Ecosystem Foundation
  docsCommand,
  observabilityCommand,
  templateCommand,
  releaseCommand,
  validateSecurityCommand,
  // Phase 16 — Real-World Operational Validation + Post-Release Engineering
  workflowValidateCommand,
  chaosCommand,
  longrunCommand,
  governanceCommand,
  regressionCommand,
  telemetryCommand,
  profilingCommand,
  securityAuditCommand,
  ecosystemCommand,
  platformCertifyCommand,
} from './commands/index.js';

const program = new Command();

program.name(CLI_NAME).version(CLI_VERSION).description(CLI_DESCRIPTION);

// autic init
program
  .command('init')
  .description('Initialize Autic in the current directory')
  .option('--force', 'Force reinitialization')
  .action(async (options) => {
    await initCommand(options);
  });

// autic build
program
  .command('build')
  .description('Build the current Autic workspace')
  .option('--watch', 'Watch for changes')
  .option('--clean', 'Clean previous build first')
  .action(async (options) => {
    await buildCommand(options);
  });

// autic chat
program
  .command('chat')
  .description('Start an interactive chat session')
  .option('-m, --model <model>', 'Model to use')
  .option('-p, --provider <provider>', 'Provider to use')
  .option('-s, --session <session>', 'Session ID to restore')
  .option('-f, --file <file>', 'Context file to load')
  .action(async (options) => {
    await chatCommand(options);
  });

// autic fix
program
  .command('fix')
  .description('Run autonomous fix workflow on target')
  .option('-t, --target <path>', 'Target directory or file')
  .option('-m, --model <model>', 'Model to use')
  .option('--dry-run', 'Preview changes without applying')
  .action(async (options) => {
    await fixCommand(options);
  });

// autic run
program
  .command('run')
  .description('Execute a task or script')
  .argument('[script]', 'Script or task to run')
  .option('-m, --model <model>', 'Model to use')
  .action(async (script, options) => {
    await runCommand(script, options);
  });

// autic providers
program
  .command('providers')
  .description('List and manage LLM providers')
  .argument('[action]', 'Action: list (default), check, add, or remove')
  .argument('[name]', 'Provider name (for add/remove)')
  .option('-k, --key <key>', 'API key (for add)')
  .option('-u, --url <url>', 'Base URL (for add)')
  .action(async (action, name, options) => {
    await providersCommand(action, name, options || {});
  });

// autic models
program
  .command('models')
  .description('Search, install, list models, and show capabilities')
  .argument('[action]', 'Action: list (default), search, install, or capabilities')
  .argument('[name]', 'Model name or search query')
  .action(async (action, name) => {
    await modelsCommand(action, name);
  });

// autic sessions
program
  .command('sessions')
  .description('Create, list, and restore sessions')
  .argument('[action]', 'Action: list (default), create, restore')
  .argument('[name]', 'Session name or ID')
  .action(async (action, name) => {
    await sessionsCommand(action, name);
  });

// autic doctor
program
  .command('doctor')
  .description('Run environment diagnostics')
  .action(async () => {
    await doctorCommand();
  });

// autic workflow
program
  .command('workflow')
  .description('Run an autonomous engineering workflow')
  .argument('[goal]', 'High-level goal to accomplish')
  .option('--steps <n>', 'Max execution steps', '20')
  .option('--timeout <ms>', 'Workflow timeout in ms', '300000')
  .option('--allow-dangerous', 'Allow potentially dangerous operations')
  .option('--verbose', 'Show detailed execution events')
  .action(async (goal, options) => {
    await workflowCommand(goal, options || {});
  });

// autic security
program
  .command('security')
  .description('View and manage security settings, trust profiles, and permissions')
  .argument('[action]', 'Action: status (default), profile, permissions, events, vault')
  .argument('[sub]', 'Sub-argument (e.g., profile name, subcommand)')
  .option('--limit <n>', 'Event limit (for events action)', '20')
  .action(async (action, sub, options) => {
    await securityCommand(action, sub, options || {});
  });

// autic skills
program
  .command('skills')
  .description('List, install, remove, and run skills')
  .argument('[action]', 'Action: list (default), install, remove, or run')
  .argument('[name]', 'Skill name or ID')
  .option('-g, --goal <goal>', 'Goal for run action')
  .action(async (action, name, options) => {
    await skillsCommand(action, name, options || {});
  });

// autic orchestrate
program
  .command('orchestrate')
  .description(
    'Run the full R&D pipeline system (Research → Plan → Architect → Engineer → Verify → Repair → Final Review)',
  )
  .argument('[goal]', 'High-level goal for the pipeline')
  .option('--pipeline <id>', 'Pipeline to use (full-development, analysis-only, engineering-only)')
  .option('--stage <name>', 'Execute a single pipeline stage')
  .option('--verbose', 'Show detailed execution events')
  .action(async (goal, options) => {
    await orchestrateCommand(goal, options || {});
  });

// autic stability
program
  .command('stability')
  .description('Monitor runtime health, performance, and stability')
  .argument(
    '[action]',
    'Action: status (default), health, resources, metrics, loops, processes, or cleanup',
  )
  .action(async (action) => {
    await stabilityCommand(action);
  });

// autic learning
program
  .command('learning')
  .description('Engineering learning and operational intelligence system')
  .argument('[action]', 'Action: status (default), inspect, clear, disable, or enable')
  .action(async (action) => {
    await learningCommand(action);
  });

// autic swarm
program
  .command('swarm')
  .description('Controlled multi-agent swarm orchestration and coordination')
  .argument(
    '[action]',
    'Action: status (default), inspect, pipelines, safety, start, stop, pause, or resume',
  )
  .action(async (action) => {
    await swarmCommand(action);
  });

// autic context
program
  .command('context')
  .description('Advanced context engineering and token optimization system')
  .argument('[action]', 'Action: status (default), inspect, optimize, safety, cache, or reset')
  .option('-t, --target <path>', 'Target for optimize action')
  .action(async (action, options) => {
    await contextCommand(action, options || {});
  });

// autic privacy
program
  .command('privacy')
  .description('Configure privacy mode: normal, local_only, or offline')
  .argument('[action]', 'Action: status (default), set, help')
  .argument('[mode]', 'Mode: normal, local_only, or offline (for set action)')
  .action(async (action, mode) => {
    await privacyCommand(action, mode);
  });

// autic config
program
  .command('config')
  .description('Manage Autic configuration (global, workspace, and profile overrides)')
  .argument('[action]', 'Action: status (default), get, set, or list')
  .argument('[key]', 'Config key (for get/set)')
  .argument('[value]', 'Config value (for set)')
  .action(async (action, key, value) => {
    await configCommand(action, key, value);
  });

// autic profile
program
  .command('profile')
  .description('Manage developer profiles: safe, balanced, full_auto, local_only')
  .argument('[action]', 'Action: status (default), list, set, or describe')
  .argument('[profile]', 'Profile name')
  .action(async (action, profile) => {
    await profileCommand(action, profile);
  });

// autic update
program
  .command('update')
  .description('Check for Autic updates and manage versions')
  .argument('[action]', 'Action: check (default), info, or version')
  .action(async (action) => {
    await updateCommand(action);
  });

// autic debug
program
  .command('debug')
  .description('Debugging, tracing, and platform information utilities')
  .argument('[action]', 'Action: mode (default), platform, or trace')
  .argument('[value]', 'Value for action (on/off for mode)')
  .action(async (action, value) => {
    await debugCommand(action, value);
  });

// autic help
program
  .command('help')
  .description('Show detailed help and documentation for Autic commands')
  .argument('[topic]', 'Command topic to get help on (e.g., providers, profile, doctor)')
  .action(async (topic) => {
    await helpCommand(topic);
  });

// ═══════════════════════════════════════════════════════════════
// Phase 14 — Production Hardening + Reliability Validation
// ═══════════════════════════════════════════════════════════════

// autic audit (#1) — Full Runtime Audit
program
  .command('audit')
  .description(
    'Run comprehensive runtime audit — health, orchestration, queue, provider, memory, and safety checks',
  )
  .argument('[action]', 'Action: run (default) or health')
  .action(async (action) => {
    await auditCommand(action);
  });

// autic stress (#2) — Long-Workflow Stress Testing
program
  .command('stress')
  .description(
    'Run long-workflow stress tests — multi-hour simulation, queue saturation, provider outages',
  )
  .argument('[action]', 'Action: run (default)')
  .action(async (action) => {
    await stressCommand(action);
  });

// autic protect (#3, #5, #6, #11) — Provider Hardening + Safety
program
  .command('protect')
  .description(
    'Manage provider hardening, execution safety, security posture, and deadlock/stall protection',
  )
  .argument('[action]', 'Action: providers (default), safety, security, or stall')
  .action(async (action) => {
    await protectCommand(action);
  });

// autic memory (#4) — Memory Leak Detection
program
  .command('memory')
  .description(
    'Detect memory leaks — worker leak detection, orphan tracking, suspicious growth analysis',
  )
  .argument('[action]', 'Action: check (default) or start (continuous monitoring)')
  .action(async (action) => {
    await memoryCommand(action);
  });

// autic validate (#15, #16) — Production Validation + Release Readiness
program
  .command('validate')
  .description('Run production validation suite or release readiness checks')
  .argument('[action]', 'Action: all (default), suite, or release')
  .action(async (action) => {
    await validateCommand(action);
  });

// autic diagnose (#13, #17) — Error Diagnostics + CLI UX
program
  .command('diagnose')
  .description('View error diagnostics reports and CLI UX hardening status')
  .argument('[action]', 'Action: errors (default) or ux')
  .action(async (action) => {
    await diagnoseCommand(action);
  });

// autic system (#7, #12, #14) — Performance, Resilience, Context
program
  .command('system')
  .description('View performance metrics, CLI resilience status, and context hardening')
  .argument('[action]', 'Action: perf (default), resilience, or context')
  .action(async (action) => {
    await systemCommand(action);
  });

// autic swarm-hardening (#8) — Swarm Stability
program
  .command('swarm-hardening')
  .description('Validate swarm stability — delegation bounds, concurrency limits, worker balancing')
  .argument('[action]', 'Action: check (default)')
  .action(async (action) => {
    await swarmHardeningCommand(action);
  });

// autic fs (#10) — Filesystem Safety
program
  .command('fs')
  .description('Validate filesystem safety — path checks, workspace boundary enforcement')
  .argument('[action]', 'Action: check (default) or path <target>')
  .argument('[path]', 'Path to check (for path action)')
  .action(async (action, path) => {
    await fsCommand(action, path);
  });

// autic recovery (#9) — Crash Recovery Hardening
program
  .command('recovery')
  .description(
    'Validate crash recovery capabilities — interrupted workflows, corrupted sessions, queue restoration',
  )
  .argument('[action]', 'Action: check (default)')
  .action(async (action) => {
    await recoveryCommand(action);
  });

// ═══════════════════════════════════════════════════════════════
// Phase 15 — Final Production Polish + Ecosystem Foundation
// ═══════════════════════════════════════════════════════════════

// autic docs — Documentation Generation
program
  .command('docs')
  .description('Generate command documentation, provider guides, and troubleshooting docs')
  .argument(
    '[action]',
    'Action: all (default), commands, providers, troubleshooting, examples, or single',
  )
  .action(async (action) => {
    await docsCommand(action);
  });

// autic observability — System Observability
program
  .command('observability')
  .description(
    'View system observability snapshots — runtime health, orchestration, queue, provider, context, learning',
  )
  .argument(
    '[action]',
    'Action: health (default), orchestration, queue, provider, context, learning, or events',
  )
  .action(async (action) => {
    await observabilityCommand(action);
  });

// autic template — Workspace Template System
program
  .command('template')
  .description('Scaffold a new project from a built-in template')
  .argument(
    '[template]',
    'Template name (saas-starter, cli-starter, api-starter, ai-tool-starter, or list)',
  )
  .argument('[target]', 'Target directory for the new project')
  .action(async (template, target) => {
    await templateCommand(template, target);
  });

// autic release — Release Channel System
program
  .command('release')
  .description('Manage release channels (stable, beta, dev) and check for updates')
  .argument('[action]', 'Action: status (default), check, channel, or versions')
  .argument('[value]', 'Channel value (for channel action: stable, beta, dev)')
  .action(async (action, value) => {
    await releaseCommand(action, value);
  });

// autic validate-security — Security Validation
program
  .command('validate-security')
  .description(
    'Run final security validation — vault, sanitization, permissions, extensions, providers, local-first guarantees',
  )
  .action(async () => {
    await validateSecurityCommand();
  });

// ═══════════════════════════════════════════════════════════════
// Phase 16 — Real-World Operational Validation + Post-Release Engineering
// ═══════════════════════════════════════════════════════════════

// autic workflow-validate (#1) — Real-World Workflow Validation
program
  .command('workflow-validate')
  .description(
    'Validate workflows against real project types — TypeScript, Next.js, Python, SaaS, monorepo, CLI',
  )
  .argument(
    '[action]',
    'Project type: all (default), typescript, nextjs, python, saas, monorepo, or cli',
  )
  .action(async (action) => {
    await workflowValidateCommand(action);
  });

// autic chaos (#2) — Provider Chaos Testing
program
  .command('chaos')
  .description(
    'Run provider chaos testing — simulate outages, invalid auth, slow streaming, rate limits, partial failures, degraded responses',
  )
  .argument(
    '[action]',
    'Scenario: all (default), outage, auth, slow, rate-limit, partial, or degraded',
  )
  .action(async (action) => {
    await chaosCommand(action);
  });

// autic longrun (#3) — Long-Run Autonomous Testing
program
  .command('longrun')
  .description(
    'Run long-running autonomous tests — multi-hour workflows, repair cycles, queue saturation, orchestration stress, memory pressure',
  )
  .argument('[action]', 'Test: all (default), workflow, repair, queue, orchestration, or memory')
  .action(async (action) => {
    await longrunCommand(action);
  });

// autic governance (#4) — Extension Governance
program
  .command('governance')
  .description(
    'Manage extension governance — trust metadata, permission auditing, compatibility scoring, unsafe detection, runtime isolation',
  )
  .argument('[action]', 'Action: all (default), trust, permissions, compat, unsafe, or isolation')
  .action(async (action) => {
    await governanceCommand(action);
  });

// autic regression (#5) — Regression Prevention
program
  .command('regression')
  .description(
    'Run regression prevention checks — architecture, orchestration, provider, memory, security regression detection',
  )
  .argument(
    '[action]',
    'Check: all (default), architecture, orchestration, provider, memory, or security',
  )
  .action(async (action) => {
    await regressionCommand(action);
  });

// autic telemetry (#6) — Safe Optional Telemetry
program
  .command('telemetry')
  .description(
    'Manage safe optional telemetry — opt-in anonymized runtime metrics. Never collects secrets, source code, prompts, or credentials',
  )
  .argument('[action]', 'Action: status (default), enable, disable, report, or clear')
  .action(async (action) => {
    await telemetryCommand(action);
  });

// autic profiling (#7) — Runtime Profiling System
program
  .command('profiling')
  .description(
    'Run runtime profiling — CPU, memory, queue latency, provider latency, orchestration profiling, and performance baselines',
  )
  .argument(
    '[action]',
    'Action: all (default), cpu, memory, queue, provider, orchestration, baseline, or compare',
  )
  .action(async (action) => {
    await profilingCommand(action);
  });

// autic security-audit (#9) — Security Audit Framework
program
  .command('security-audit')
  .description(
    'Run comprehensive security audit — permission bypass detection, vault isolation, sanitization integrity, unsafe commands, extension boundaries',
  )
  .argument(
    '[action]',
    'Audit: all (default), permissions, vault, sanitization, commands, or boundaries',
  )
  .action(async (action) => {
    await securityAuditCommand(action);
  });

// autic ecosystem (#10) — Ecosystem Maintenance Tooling
program
  .command('ecosystem')
  .description(
    'Ecosystem maintenance — extension diagnostics, compatibility inspection, runtime audit, plugin lifecycle management',
  )
  .argument('[action]', 'Action: all (default), diagnostics, compat, audit, or plugins')
  .action(async (action) => {
    await ecosystemCommand(action);
  });

// autic platform-certify (#15) — Final Platform Certification
program
  .command('platform-certify')
  .description(
    'Run platform certification — validates local-first integrity, BYOK guarantees, offline-safe workflows, orchestration stability, security boundaries, ecosystem safety',
  )
  .argument(
    '[action]',
    'Certification: all (default), local-first, byok, offline, orchestration, security, or ecosystem',
  )
  .action(async (action) => {
    await platformCertifyCommand(action);
  });

// Global error handling — structured error experience
process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const errorLines = renderError({
    title: 'Unhandled Error',
    message,
    level: 'error',
    causes: ['An unexpected error occurred during execution', 'A promise rejection was not caught'],
    actions: ['Run autic doctor to verify environment', 'Try the command again with --verbose'],
    docs: 'https://autic.dev/docs/troubleshooting',
    recoverable: false,
  });
  for (const line of errorLines) {
    console.error(line);
  }
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  const errorLines = renderError({
    title: 'Fatal Error',
    message: error.message,
    level: 'error',
    causes: ['A critical runtime error occurred', 'The application state may be corrupted'],
    actions: [
      'Run autic doctor to verify environment',
      'Restart the session',
      'Check for updates: autic update',
    ],
    docs: 'https://autic.dev/docs/troubleshooting',
    recoverable: false,
  });
  for (const line of errorLines) {
    console.error(line);
  }
  process.exit(1);
});

// Launchpad dashboard — show when no command is provided
const args = process.argv.slice(2);
if (args.length === 0) {
  await dashboardCommand();
} else {
  // Parse and execute
  program.parse(process.argv);
}

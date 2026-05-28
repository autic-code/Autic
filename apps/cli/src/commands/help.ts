/**
 * autic help — CLI Help + Documentation System (#11)
 *
 * Integrated help system providing:
 *   - Command overview and usage
 *   - Provider setup guidance
 *   - Runtime explanations
 *   - Troubleshooting help
 *   - Workflow examples
 *   - Profile descriptions
 */

import { CLI_NAME, CLI_VERSION, CLI_DESCRIPTION } from '../constants.js';

export interface HelpSection {
  title: string;
  items: Array<{ cmd: string; desc: string }>;
}

const COMMAND_GROUPS: HelpSection[] = [
  {
    title: 'Getting Started',
    items: [
      { cmd: 'init', desc: 'Initialize Autic in the current workspace' },
      { cmd: 'doctor', desc: 'Run environment diagnostics and health checks' },
      { cmd: 'providers setup', desc: 'Guided provider onboarding wizard' },
      { cmd: 'profile', desc: 'Manage developer profiles (safe, balanced, full_auto)' },
    ],
  },
  {
    title: 'Core Commands',
    items: [
      { cmd: 'chat', desc: 'Start an interactive AI engineering session' },
      { cmd: 'fix', desc: 'Run autonomous fix workflow on a target' },
      { cmd: 'build', desc: 'Build the current Autic workspace' },
      { cmd: 'run', desc: 'Execute a task or script' },
    ],
  },
  {
    title: 'Provider & Model Management',
    items: [
      { cmd: 'providers', desc: 'List, add, remove, and check providers' },
      { cmd: 'providers add', desc: 'Add a provider (openrouter, ollama)' },
      { cmd: 'providers check', desc: 'Test provider connectivity and key validation' },
      { cmd: 'providers setup', desc: 'Guided onboarding with API verification and model discovery' },
      { cmd: 'models', desc: 'Search, list, and install models' },
    ],
  },
  {
    title: 'Configuration & Profiles',
    items: [
      { cmd: 'config', desc: 'View and modify configuration (global, workspace, overrides)' },
      { cmd: 'profile', desc: 'Set developer profile: safe, balanced, full_auto, local_only' },
      { cmd: 'privacy', desc: 'Configure privacy mode: normal, local_only, offline' },
    ],
  },
  {
    title: 'Runtime & Orchestration',
    items: [
      { cmd: 'workflow', desc: 'Run an autonomous engineering workflow' },
      { cmd: 'orchestrate', desc: 'Full R&D pipeline (Research → Plan → Engineer → Verify)' },
      { cmd: 'stability', desc: 'Monitor runtime health, resources, and performance' },
      { cmd: 'swarm', desc: 'Multi-agent swarm orchestration and coordination' },
      { cmd: 'context', desc: 'Context engineering and token optimization' },
    ],
  },
  {
    title: 'Security & Learning',
    items: [
      { cmd: 'security', desc: 'Trust profiles, permissions, vault, and audit events' },
      { cmd: 'learning', desc: 'Engineering learning and operational intelligence' },
      { cmd: 'skills', desc: 'List, install, remove, and run skills' },
    ],
  },
  {
    title: 'Maintenance & Diagnostics',
    items: [
      { cmd: 'doctor', desc: 'Full environment diagnostics and provider health' },
      { cmd: 'doctor quick', desc: 'Quick system + provider check' },
      { cmd: 'doctor validate', desc: 'Installation validation' },
      { cmd: 'debug', desc: 'Debugging modes, platform info, and execution tracing' },
      { cmd: 'update', desc: 'Check for updates and version information' },
      { cmd: 'sessions', desc: 'Create, list, and restore sessions' },
    ],
  },
];

export async function helpCommand(topic?: string): Promise<void> {
  if (topic) {
    await showTopicHelp(topic);
    return;
  }

  printGeneralHelp();
}

function printGeneralHelp(): void {
  console.log('');
  console.log(`  ${CLI_NAME} v${CLI_VERSION}`);
  console.log(`  ${CLI_DESCRIPTION}`);
  console.log('');

  // Usage
  console.log('  USAGE');
  console.log('    autic <command> [action] [options]');
  console.log('');

  // Command groups
  for (const group of COMMAND_GROUPS) {
    console.log(`  ${group.title}`);
    console.log(`  ${'─'.repeat(36)}`);
    for (const item of group.items) {
      const cmd = item.cmd.padEnd(22);
      console.log(`    ${cmd} ${item.desc}`);
    }
    console.log('');
  }

  // Quick examples
  console.log('  QUICK START');
  console.log(`  ${'─'.repeat(36)}`);
  console.log('    # Initialize Autic in your project');
  console.log('    autic init');
  console.log('');
  console.log('    # Run diagnostics to check environment');
  console.log('    autic doctor');
  console.log('');
  console.log('    # Set up a provider');
  console.log('    autic providers setup openrouter');
  console.log('');
  console.log('    # Start a chat session');
  console.log('    autic chat');
  console.log('');

  console.log('  For detailed help on a specific command:');
  console.log('    autic help <command>');
  console.log('    autic <command> --help');
  console.log('');
}

async function showTopicHelp(topic: string): Promise<void> {
  // Normalize topic
  const t = topic.toLowerCase().trim();

  switch (t) {
    case 'init':
      printInitHelp();
      break;
    case 'providers':
    case 'provider':
      printProvidersHelp();
      break;
    case 'profile':
      printProfileHelp();
      break;
    case 'doctor':
      printDoctorHelp();
      break;
    case 'chat':
      printChatHelp();
      break;
    case 'fix':
      printFixHelp();
      break;
    case 'workflow':
      printWorkflowHelp();
      break;
    case 'orchestrate':
      printOrchestrateHelp();
      break;
    case 'config':
      printConfigHelp();
      break;
    case 'security':
      printSecurityHelp();
      break;
    case 'privacy':
      printPrivacyHelp();
      break;
    case 'debug':
      printDebugHelp();
      break;
    case 'update':
      printUpdateHelp();
      break;
    case 'stability':
      printStabilityHelp();
      break;
    case 'swarm':
      printSwarmHelp();
      break;
    case 'context':
      printContextHelp();
      break;
    case 'learning':
      printLearningHelp();
      break;
    case 'skills':
      printSkillsHelp();
      break;
    case 'sessions':
      printSessionsHelp();
      break;
    case 'models':
      printModelsHelp();
      break;
    case 'local':
    case 'offline':
      printLocalHelp();
      break;
    default:
      console.log(`\n  No detailed help available for "${topic}".`);
      console.log('  Try: autic help\n');
  }
}

function printInitHelp(): void {
  console.log('');
  console.log('  autic init — Initialize Autic workspace');
  console.log('  ─────────────────────────────────────');
  console.log('');
  console.log('  Creates the .autic directory structure and workspace configuration.');
  console.log('  Detects project metadata (name, framework, package manager).');
  console.log('');
  console.log('  Usage:');
  console.log('    autic init');
  console.log('    autic init --force       Reinitialize');
  console.log('');
  console.log('  Created structure:');
  console.log('    .autic/');
  console.log('    .autic/sessions/');
  console.log('    .autic/memory/');
  console.log('    .autic/context/');
  console.log('    .autic/tmp/');
  console.log('    .autic/crashes/');
  console.log('    .autic/config.json');
  console.log('');
  console.log('  Next steps after init:');
  console.log('    autic providers setup    Set up an LLM provider');
  console.log('    autic profile set safe   Set developer profile');
  console.log('    autic doctor             Verify everything works');
  console.log('');
}

function printProvidersHelp(): void {
  console.log('');
  console.log('  autic providers — Provider management and guided onboarding');
  console.log('  ──────────────────────────────────────────────────────────');
  console.log('');
  console.log('  Autic supports two provider types:');
  console.log('');
  console.log('  OpenRouter (Cloud)');
  console.log('    API-based access to 200+ models. Requires an API key.');
  console.log('    Get a key: https://openrouter.ai/keys');
  console.log('');
  console.log('  Ollama (Local)');
  console.log('    Run models locally on your machine. Free and offline.');
  console.log('    Install: https://ollama.ai');
  console.log('');
  console.log('  Commands:');
  console.log('    autic providers                  List registered providers');
  console.log('    autic providers check            Test provider connectivity');
  console.log('    autic providers add openrouter   Add OpenRouter (--key)');
  console.log('    autic providers add ollama       Add Ollama (--url)');
  console.log('    autic providers remove <name>    Remove a provider');
  console.log('    autic providers setup openrouter Guided OpenRouter setup');
  console.log('    autic providers setup ollama     Guided Ollama setup');
  console.log('');
  console.log('  Setup Wizard covers:');
  console.log('    1. API key verification');
  console.log('    2. Connection testing');
  console.log('    3. Model discovery & categorization');
  console.log('    4. Runtime recommendations');
  console.log('');
  console.log('  Environment variables:');
  console.log('    OPENROUTER_API_KEY        OpenRouter API key');
  console.log('    AUTIC_OPENROUTER_KEY      Alternative OpenRouter key');
  console.log('    AUTIC_DEFAULT_MODEL       Default model for sessions');
  console.log('');
}

function printProfileHelp(): void {
  console.log('');
  console.log('  autic profile — Developer profiles for runtime behavior');
  console.log('  ──────────────────────────────────────────────────────');
  console.log('');
  console.log('  Profiles control provider restrictions, execution behavior,');
  console.log('  permission policies, and safety limits.');
  console.log('');
  console.log('  Profiles:');
  console.log('');
  console.log('    safe        Maximum safety. Local-only models, restricted');
  console.log('                filesystem, read-only operations. Best for');
  console.log('                learning and exploration.');
  console.log('');
  console.log('    balanced    Default profile. Balanced safety and autonomy.');
  console.log('                Allows cloud models with permission prompts.');
  console.log('                File writes require confirmation.');
  console.log('');
  console.log('    full_auto   Maximum autonomy. Assumes user intent. Allows');
  console.log('                any provider, automatic file operations, no');
  console.log('                confirmation prompts. Best for experienced users.');
  console.log('');
  console.log('    local_only  Offline-safe profile. Only local providers');
  console.log('                (Ollama). No cloud API calls. Best for air-gapped');
  console.log('                environments or privacy-sensitive work.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic profile                Show current profile');
  console.log('    autic profile list           List available profiles');
  console.log('    autic profile set balanced   Set active profile');
  console.log('    autic profile describe safe  Describe a profile');
  console.log('');
}

function printDoctorHelp(): void {
  console.log('');
  console.log('  autic doctor — Environment diagnostics and health');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Runs comprehensive diagnostics across system, providers,');
  console.log('  security, network, and runtime subsystems.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic doctor              Quick check (system + providers)');
  console.log('    autic doctor full         Full comprehensive diagnostics');
  console.log('    autic doctor validate     Installation validation');
  console.log('');
  console.log('  Checks performed:');
  console.log('    • Node.js version compatibility');
  console.log('    • npm/pnpm installation and version');
  console.log('    • Filesystem permissions (.autic directory)');
  console.log('    • Workspace configuration status');
  console.log('    • Provider connectivity (OpenRouter, Ollama)');
  console.log('    • Secret vault status');
  console.log('    • Network connectivity');
  console.log('    • Disk space availability');
  console.log('    • Shell compatibility');
  console.log('    • Runtime health metrics');
  console.log('');
}

function printChatHelp(): void {
  console.log('');
  console.log('  autic chat — Interactive AI engineering session');
  console.log('  ──────────────────────────────────────────────');
  console.log('');
  console.log('  Start an interactive session with an AI engineering agent.');
  console.log('  Supports multi-turn conversations, context loading, and');
  console.log('  session persistence.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic chat                    Start with default model');
  console.log('    autic chat -m gpt-4o          Use specific model');
  console.log('    autic chat -p openrouter      Use specific provider');
  console.log('    autic chat -s session-123     Restore a session');
  console.log('    autic chat -f context.md      Load context file');
  console.log('');
}

function printFixHelp(): void {
  console.log('');
  console.log('  autic fix — Autonomous fix workflow');
  console.log('  ──────────────────────────────────');
  console.log('');
  console.log('  Analyzes and fixes issues in the target directory or file.');
  console.log('  Supports dry-run preview and model selection.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic fix                     Fix current directory');
  console.log('    autic fix -t src/             Fix specific directory');
  console.log('    autic fix -t src/app.ts       Fix specific file');
  console.log('    autic fix --dry-run           Preview changes');
  console.log('    autic fix -m gpt-4o           Use specific model');
  console.log('');
}

function printWorkflowHelp(): void {
  console.log('');
  console.log('  autic workflow — Autonomous engineering workflow');
  console.log('  ────────────────────────────────────────────────');
  console.log('');
  console.log('  Runs an end-to-end engineering workflow to accomplish a goal.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic workflow "Add user authentication"');
  console.log('    autic workflow "Fix TypeScript errors" --steps 10');
  console.log('    autic workflow "Refactor API routes" --allow-dangerous');
  console.log('    autic workflow "Update tests" --verbose');
  console.log('');
  console.log('  Options:');
  console.log('    --steps <n>             Max execution steps (default: 20)');
  console.log('    --timeout <ms>          Timeout in ms (default: 300000)');
  console.log('    --allow-dangerous       Allow potentially dangerous ops');
  console.log('    --verbose               Show detailed execution events');
  console.log('');
}

function printOrchestrateHelp(): void {
  console.log('');
  console.log('  autic orchestrate — Full R&D pipeline');
  console.log('  ─────────────────────────────────────');
  console.log('');
  console.log('  Runs the complete pipeline: Research → Plan → Architect →');
  console.log('  Engineer → Verify → Repair → Final Review');
  console.log('');
  console.log('  Usage:');
  console.log('    autic orchestrate "Build CLI tool"');
  console.log('    autic orchestrate "Add tests" --pipeline engineering-only');
  console.log('    autic orchestrate "Design API" --stage architect');
  console.log('    autic orchestrate "Fix bugs" --pipeline analysis-only --verbose');
  console.log('');
}

function printConfigHelp(): void {
  console.log('');
  console.log('  autic config — Configuration management');
  console.log('  ──────────────────────────────────────');
  console.log('');
  console.log('  Layered configuration: defaults → global → workspace → env → CLI');
  console.log('');
  console.log('  Usage:');
  console.log('    autic config               Show current config');
  console.log('    autic config get <key>     Get a config value');
  console.log('    autic config set <k> <v>   Set a config value');
  console.log('    autic config list          List all config keys');
  console.log('');
}

function printSecurityHelp(): void {
  console.log('');
  console.log('  autic security — Security management');
  console.log('  ────────────────────────────────────');
  console.log('');
  console.log('  Manage trust profiles, permissions, audit events, and vault.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic security                    Security status');
  console.log('    autic security profile            Trust profile info');
  console.log('    autic security permissions        List permissions');
  console.log('    autic security events             View audit events');
  console.log('    autic security vault              Secret vault status');
  console.log('');
}

function printPrivacyHelp(): void {
  console.log('');
  console.log('  autic privacy — Privacy mode configuration');
  console.log('  ─────────────────────────────────────────');
  console.log('');
  console.log('  Controls network access and data handling.');
  console.log('');
  console.log('  Modes:');
  console.log('    normal       Default. All providers available.');
  console.log('    local_only   Only local providers (Ollama). No cloud calls.');
  console.log('    offline      No network access. Local-only mode + offline.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic privacy               Check current privacy mode');
  console.log('    autic privacy set local_only  Enable local-only mode');
  console.log('    autic privacy help            Extended privacy guide');
  console.log('');
}

function printDebugHelp(): void {
  console.log('');
  console.log('  autic debug — Debugging and tracing utilities');
  console.log('  ──────────────────────────────────────────────');
  console.log('');
  console.log('  Usage:');
  console.log('    autic debug                    Current debug mode status');
  console.log('    autic debug mode on            Enable verbose debug mode');
  console.log('    autic debug mode off           Disable debug mode');
  console.log('    autic debug platform           Show platform information');
  console.log('    autic debug trace              Start execution tracing');
  console.log('');
}

function printUpdateHelp(): void {
  console.log('');
  console.log('  autic update — Version management and updates');
  console.log('  ──────────────────────────────────────────────');
  console.log('');
  console.log('  Checks for updates without auto-installing.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic update                 Check for updates');
  console.log('    autic update info            Show detailed version info');
  console.log('    autic update version         Show current version');
  console.log('');
  console.log('  No forced auto-updates. All update checks are opt-in.');
  console.log('');
}

function printStabilityHelp(): void {
  console.log('');
  console.log('  autic stability — Runtime health monitoring');
  console.log('  ───────────────────────────────────────────');
  console.log('');
  console.log('  Monitor runtime health, performance, and system stability.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic stability              Runtime status overview');
  console.log('    autic stability health       Health check details');
  console.log('    autic stability resources    Resource utilization');
  console.log('    autic stability metrics      Performance metrics');
  console.log('    autic stability cleanup      Clean up stale resources');
  console.log('');
}

function printSwarmHelp(): void {
  console.log('');
  console.log('  autic swarm — Multi-agent swarm orchestration');
  console.log('  ─────────────────────────────────────────────');
  console.log('');
  console.log('  Controlled multi-agent coordination with delegation chains,');
  console.log('  pipeline execution, and safety throttling.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic swarm                  Swarm status');
  console.log('    autic swarm inspect          Detailed inspection');
  console.log('    autic swarm start            Start swarm');
  console.log('    autic swarm stop             Stop swarm');
  console.log('    autic swarm pause            Pause swarm');
  console.log('    autic swarm resume           Resume swarm');
  console.log('');
}

function printContextHelp(): void {
  console.log('');
  console.log('  autic context — Context engineering and token optimization');
  console.log('  ──────────────────────────────────────────────────────────');
  console.log('');
  console.log('  Advanced token budgeting, file retrieval, compression, and');
  console.log('  safety systems for efficient context management.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic context                Context status overview');
  console.log('    autic context inspect        Detailed inspection');
  console.log('    autic context optimize       Run context optimization');
  console.log('    autic context safety         Safety system status');
  console.log('    autic context cache          Cache effectiveness');
  console.log('');
}

function printLearningHelp(): void {
  console.log('');
  console.log('  autic learning — Engineering learning system');
  console.log('  ────────────────────────────────────────────');
  console.log('');
  console.log('  Tracks engineering patterns, tool usage, and operational');
  console.log('  intelligence for continuous improvement.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic learning               Learning system status');
  console.log('    autic learning inspect       Inspect learned patterns');
  console.log('    autic learning clear         Clear learning data');
  console.log('    autic learning disable       Disable learning');
  console.log('');
}

function printSkillsHelp(): void {
  console.log('');
  console.log('  autic skills — Skill management');
  console.log('  ───────────────────────────────');
  console.log('');
  console.log('  List, install, remove, and run reusable skills.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic skills                 List installed skills');
  console.log('    autic skills install <name>  Install a skill');
  console.log('    autic skills remove <name>   Remove a skill');
  console.log('    autic skills run <name>      Run a skill with a goal');
  console.log('');
}

function printSessionsHelp(): void {
  console.log('');
  console.log('  autic sessions — Session management');
  console.log('  ───────────────────────────────────');
  console.log('');
  console.log('  Create, list, and restore interactive sessions.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic sessions               List saved sessions');
  console.log('    autic sessions create        Create new session');
  console.log('    autic sessions restore <id>  Restore a session');
  console.log('');
}

function printModelsHelp(): void {
  console.log('');
  console.log('  autic models — Model management');
  console.log('  ───────────────────────────────');
  console.log('');
  console.log('  Search, list, install, and view model capabilities.');
  console.log('');
  console.log('  Usage:');
  console.log('    autic models                 List all models');
  console.log('    autic models search <query>  Search models');
  console.log('    autic models install <name>  Install a model via Ollama');
  console.log('    autic models capabilities    Show capability coverage');
  console.log('');
}

function printLocalHelp(): void {
  console.log('');
  console.log('  Autic Local Mode — Offline-first development');
  console.log('  ──────────────────────────────────────────────');
  console.log('');
  console.log('  Autic supports fully offline operation with local models.');
  console.log('  No cloud dependencies, no telemetry, no vendor lock-in.');
  console.log('');
  console.log('  Setup:');
  console.log('    1. Install Ollama: https://ollama.ai');
  console.log('    2. Pull a model:   ollama pull deepseek-coder');
  console.log('    3. Set local mode: autic privacy set local_only');
  console.log('    4. Start:          autic chat');
  console.log('');
  console.log('  Recommended local models:');
  console.log('    deepseek-coder    Excellent for coding tasks');
  console.log('    llama3.2          General-purpose chat');
  console.log('    mistral           Fast and capable');
  console.log('    codellama         Specialized for code');
  console.log('');
}

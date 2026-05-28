/**
 * autic docs — Documentation generation command.
 *
 * Generates command reference docs, provider setup guides,
 * troubleshooting docs, workflow examples, architecture docs,
 * subsystem contracts, SDK docs, security docs, and core concepts.
 */

import { DocumentationGenerator, type CommandDoc, type DocPage } from '@autic/diagnostics';
import * as path from 'node:path';

/**
 * Generate and write command documentation
 */
export async function docsCommand(action?: string): Promise<void> {
  const gen = new DocumentationGenerator({
    outputDir: path.join(process.cwd(), 'docs'),
    singleFile: action === 'single',
    includeExamples: true,
    includeTroubleshooting: true,
    version: '0.1.0',
  });

  const commands = getCommandDocs();
  const pages: DocPage[] = [];

  switch (action ?? 'all') {
    case 'commands': {
      const cmdPages = gen.generateCommandDocs(commands);
      pages.push(...cmdPages);
      break;
    }
    case 'providers': {
      pages.push(gen.generateProviderDocs());
      break;
    }
    case 'troubleshooting': {
      pages.push(gen.generateTroubleshootingDocs());
      break;
    }
    case 'examples': {
      pages.push(gen.generateWorkflowExamples());
      break;
    }
    case 'architecture': {
      pages.push(gen.generateArchitectureDocs());
      break;
    }
    case 'contracts': {
      pages.push(gen.generateSubsystemContractsDocs());
      break;
    }
    case 'sdk': {
      pages.push(gen.generateExtensionSdkDocs());
      break;
    }
    case 'security': {
      pages.push(gen.generateSecurityDocs());
      break;
    }
    case 'concepts': {
      pages.push(gen.generateCoreConceptsDocs());
      break;
    }
    case 'all':
    default: {
      const cmdPages = gen.generateCommandDocs(commands);
      pages.push(...cmdPages);
      pages.push(gen.generateProviderDocs());
      pages.push(gen.generateTroubleshootingDocs());
      pages.push(gen.generateWorkflowExamples());
      pages.push(gen.generateArchitectureDocs());
      pages.push(gen.generateSubsystemContractsDocs());
      pages.push(gen.generateExtensionSdkDocs());
      pages.push(gen.generateSecurityDocs());
      pages.push(gen.generateCoreConceptsDocs());
      break;
    }
  }

  gen.writeDocs(pages);

  console.log(`\n  ✓ Generated ${pages.length} documentation page(s) in docs/`);
  const uniquePaths = new Set<string>();
  for (const page of pages) {
    if (!uniquePaths.has(page.path)) {
      uniquePaths.add(page.path);
      console.log(`    → ${page.path}`);
    }
  }
}

/**
 * Get command documentation definitions
 */
function getCommandDocs(): CommandDoc[] {
  return [
    {
      name: 'init',
      description: 'Initialize Autic in the current directory',
      usage: 'autic init [--force]',
      arguments: [],
      options: [{ flag: '--force', description: 'Force reinitialization' }],
      examples: ['autic init', 'autic init --force'],
    },
    {
      name: 'chat',
      description: 'Start an interactive chat session',
      usage: 'autic chat [options]',
      arguments: [],
      options: [
        { flag: '-m, --model <model>', description: 'Model to use' },
        { flag: '-p, --provider <provider>', description: 'Provider to use' },
        { flag: '-s, --session <session>', description: 'Session ID to restore' },
        { flag: '-f, --file <file>', description: 'Context file to load' },
      ],
      examples: ['autic chat', 'autic chat --model gpt-4o', 'autic chat --session my-session'],
    },
    {
      name: 'fix',
      description: 'Run autonomous fix workflow on target',
      usage: 'autic fix [options]',
      arguments: [],
      options: [
        { flag: '-t, --target <path>', description: 'Target directory or file' },
        { flag: '-m, --model <model>', description: 'Model to use' },
        { flag: '--dry-run', description: 'Preview changes without applying' },
      ],
      examples: ['autic fix --target src/', 'autic fix --target src/index.ts --dry-run'],
    },
    {
      name: 'providers',
      description: 'List and manage LLM providers',
      usage: 'autic providers [action] [name] [options]',
      arguments: [
        {
          name: 'action',
          description: 'Action: list (default), check, add, or remove',
          required: false,
        },
        { name: 'name', description: 'Provider name (for add/remove)', required: false },
      ],
      options: [
        { flag: '-k, --key <key>', description: 'API key (for add)' },
        { flag: '-u, --url <url>', description: 'Base URL (for add)' },
      ],
      examples: [
        'autic providers',
        'autic providers add openrouter --key sk-...',
        'autic providers check',
      ],
    },
    {
      name: 'doctor',
      description: 'Run comprehensive environment diagnostics',
      usage: 'autic doctor',
      arguments: [],
      options: [],
      examples: ['autic doctor'],
    },
    {
      name: 'orchestrate',
      description: 'Run the full R&D pipeline system',
      usage: 'autic orchestrate <goal> [options]',
      arguments: [
        { name: 'goal', description: 'High-level goal for the pipeline', required: true },
      ],
      options: [
        { flag: '--pipeline <id>', description: 'Pipeline to use', default: 'full-development' },
        { flag: '--stage <name>', description: 'Execute a single pipeline stage' },
        { flag: '--verbose', description: 'Show detailed execution events' },
      ],
      examples: [
        'autic orchestrate "Build a REST API"',
        'autic orchestrate "Review architecture" --pipeline analysis-only',
      ],
    },
    {
      name: 'security',
      description: 'View and manage security settings',
      usage: 'autic security [action] [sub] [options]',
      arguments: [
        {
          name: 'action',
          description: 'Action: status (default), profile, permissions, events, vault',
          required: false,
        },
        { name: 'sub', description: 'Sub-argument', required: false },
      ],
      options: [{ flag: '--limit <n>', description: 'Event limit', default: '20' }],
      examples: [
        'autic security',
        'autic security profile set safe',
        'autic security events --limit 50',
      ],
    },
    {
      name: 'docs',
      description:
        'Generate command documentation and guides (architecture, SDK, security, contracts, concepts)',
      usage: 'autic docs [action]',
      arguments: [
        {
          name: 'action',
          description:
            'Action: all (default), commands, providers, troubleshooting, examples, architecture, contracts, sdk, security, concepts, single',
          required: false,
        },
      ],
      options: [],
      examples: [
        'autic docs',
        'autic docs architecture',
        'autic docs sdk',
        'autic docs security',
        'autic docs concepts',
        'autic docs contracts',
      ],
    },
    {
      name: 'observability',
      description: 'View system observability snapshots',
      usage: 'autic observability [action]',
      arguments: [
        {
          name: 'action',
          description:
            'Action: health (default), orchestration, queue, provider, context, learning, events',
          required: false,
        },
      ],
      options: [],
      examples: [
        'autic observability',
        'autic observability events',
        'autic observability provider',
      ],
    },
    {
      name: 'validate-security',
      description: 'Run security validation checks',
      usage: 'autic validate-security',
      arguments: [],
      options: [],
      examples: ['autic validate-security'],
    },
    {
      name: 'template',
      description: 'Scaffold a new project from a template',
      usage: 'autic template <template> [target]',
      arguments: [
        {
          name: 'template',
          description: 'Template name (saas-starter, cli-starter, api-starter, ai-tool-starter)',
          required: true,
        },
        {
          name: 'target',
          description: 'Target directory (defaults to project name)',
          required: false,
        },
      ],
      options: [],
      examples: [
        'autic template cli-starter my-cli',
        'autic template api-starter my-api',
        'autic template list',
      ],
    },
    {
      name: 'release',
      description: 'Manage release channels and updates',
      usage: 'autic release [action]',
      arguments: [
        {
          name: 'action',
          description: 'Action: status (default), check, channel, versions',
          required: false,
        },
      ],
      options: [],
      examples: ['autic release', 'autic release check', 'autic release channel beta'],
    },
  ];
}

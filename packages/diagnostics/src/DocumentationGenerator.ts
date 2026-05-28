/**
 * Documentation Generator — auto-generates command docs,
 * runtime diagnostics docs, provider setup docs, troubleshooting
 * guides, and workflow examples.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';


/**
 * Documentation section
 */
export interface DocSection {
  /** Section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section content (markdown) */
  content: string;
  /** Section level (1 = h1, 2 = h2, etc.) */
  level: number;
  /** Child sections */
  children: DocSection[];
}

/**
 * Documentation page
 */
export interface DocPage {
  /** Page ID */
  id: string;
  /** Page title */
  title: string;
  /** Page path (relative to output dir) */
  path: string;
  /** Page content (markdown) */
  content: string;
  /** Sections in this page */
  sections: DocSection[];
}

/**
 * Command documentation
 */
export interface CommandDoc {
  /** Command name */
  name: string;
  /** Command description */
  description: string;
  /** Usage string */
  usage: string;
  /** Arguments */
  arguments: Array<{ name: string; description: string; required: boolean }>;
  /** Options */
  options: Array<{ flag: string; description: string; default?: string }>;
  /** Examples */
  examples: string[];
  /** Subcommands */
  subcommands?: CommandDoc[];
}

/**
 * Documentation generation options
 */
export interface DocGenOptions {
  /** Output directory for generated docs */
  outputDir: string;
  /** Whether to generate a single file or multiple files */
  singleFile: boolean;
  /** Whether to include examples */
  includeExamples: boolean;
  /** Whether to include troubleshooting guides */
  includeTroubleshooting: boolean;
  /** Project version */
  version: string;
}

/**
 * Default documentation options
 */
const DEFAULT_OPTIONS: DocGenOptions = {
  outputDir: './docs',
  singleFile: false,
  includeExamples: true,
  includeTroubleshooting: true,
  version: '0.1.0',
};

/**
 * Documentation Generator
 */
export class DocumentationGenerator {
  private options: DocGenOptions;

  constructor(options?: Partial<DocGenOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Generate command documentation
   */
  generateCommandDocs(commands: CommandDoc[]): DocPage[] {
    const pages: DocPage[] = [];

    if (this.options.singleFile) {
      // Generate single comprehensive file
      const content = this.renderCommandPage(commands);
      pages.push({
        id: 'commands',
        title: 'Command Reference',
        path: path.join(this.options.outputDir, 'commands.md'),
        content,
        sections: this.extractSections(content),
      });
    } else {
      // Generate one file per command
      for (const cmd of commands) {
        const content = this.renderSingleCommandDoc(cmd);
        pages.push({
          id: `cmd-${cmd.name}`,
          title: `${cmd.name} Command`,
          path: path.join(this.options.outputDir, 'commands', `${cmd.name}.md`),
          content,
          sections: this.extractSections(content),
        });

        // Generate subcommand docs
        if (cmd.subcommands) {
          for (const sub of cmd.subcommands) {
            const subContent = this.renderSingleCommandDoc(sub, cmd.name);
            pages.push({
              id: `cmd-${cmd.name}-${sub.name}`,
              title: `${cmd.name} ${sub.name} Command`,
              path: path.join(this.options.outputDir, 'commands', `${cmd.name}-${sub.name}.md`),
              content: subContent,
              sections: this.extractSections(subContent),
            });
          }
        }
      }
    }

    return pages;
  }

  /**
   * Generate provider setup documentation
   */
  generateProviderDocs(): DocPage {
    const content = `# Provider Setup Guide

## Overview

Autic supports multiple LLM providers. Configure providers using \`autic providers add\`.

## Supported Providers

### OpenRouter

\`\`\`bash
autic providers add openrouter --key YOUR_API_KEY
\`\`\`

**Environment Variable:** \`AUTIC_OPENROUTER_KEY\` or \`OPENROUTER_API_KEY\`

**Models available:**
- GPT-4, GPT-4o, GPT-4o-mini (OpenAI)
- Claude 3.5 Sonnet, Claude 3 Opus (Anthropic)
- Gemini Pro, Gemini Ultra (Google)
- Llama 3, Mixtral (Open-source)

### Ollama (Local)

\`\`\`bash
autic providers add ollama --url http://localhost:11434
\`\`\`

**Environment Variable:** \`AUTIC_OLLAMA_URL\`

**Requirements:** Ollama installed and running locally.

### OpenAI (Direct)

\`\`\`bash
autic providers add openai --key YOUR_API_KEY
\`\`\`

**Environment Variable:** \`AUTIC_OPENAI_KEY\` or \`OPENAI_API_KEY\`

### Anthropic (Direct)

\`\`\`bash
autic providers add anthropic --key YOUR_API_KEY
\`\`\`

**Environment Variable:** \`AUTIC_ANTHROPIC_KEY\` or \`ANTHROPIC_API_KEY\`

## Provider Verification

\`\`\`bash
# List configured providers
autic providers

# Check provider health
autic providers check

# Test a provider
autic chat --provider openrouter --model gpt-4o
\`\`\`

## Multiple Providers

Configure multiple providers and Autic will route requests intelligently:

\`\`\`bash
autic providers add openrouter --key sk-...
autic providers add ollama --url http://localhost:11434
autic providers list
\`\`\`
`;

    return {
      id: 'provider-setup',
      title: 'Provider Setup Guide',
      path: path.join(this.options.outputDir, 'provider-setup.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate troubleshooting documentation
   */
  generateTroubleshootingDocs(): DocPage {
    const content = `# Troubleshooting Guide

## Common Issues

### Provider Connection Failures

**Symptoms:** Provider errors, timeouts, "no provider available"

**Solutions:**
1. Check provider configuration: \`autic providers check\`
2. Verify API keys are set: \`autic security status\`
3. Check network connectivity
4. Try a different provider: \`autic providers add <provider>\`

### Memory Issues

**Symptoms:** Slow performance, crashes, out of memory errors

**Solutions:**
1. Run diagnostics: \`autic doctor\`
2. Check memory usage: \`autic stability resources\`
3. Clear session cache: \`autic context reset\`
4. Reduce concurrent workflow count

### Session Problems

**Symptoms:** Session not found, session corruption, context loss

**Solutions:**
1. List active sessions: \`autic sessions\`
2. Check session storage location
3. Restore from session history: \`autic sessions restore <id>\`
4. Run recovery: \`autic recovery check\`

### Permission Errors

**Symptoms:** "Permission denied", "Access denied", security warnings

**Solutions:**
1. Check security status: \`autic security status\`
2. View trust profile: \`autic security profile\`
3. Review security events: \`autic security events\`
4. Adjust security settings: \`autic security profile set <profile>\`

### Extension/Plugin Issues

**Symptoms:** Extension load failures, plugin errors, compatibility warnings

**Solutions:**
1. Check extension SDK compatibility
2. Verify extension manifest (\`autic-extension.json\`)
3. Run validation: \`autic validate\`
4. Review extension permissions

## Diagnostic Commands

\`\`\`bash
# Full environment diagnostics
autic doctor

# Runtime health
autic stability health

# System resources
autic stability resources

# Security check
autic security status

# Performance validation
autic validate all
\`\`\`

## Getting Help

- Run \`autic doctor\` for comprehensive diagnostics
- Check version: \`autic update info\`
- Enable verbose mode with \`--verbose\` flag
`;

    return {
      id: 'troubleshooting',
      title: 'Troubleshooting Guide',
      path: path.join(this.options.outputDir, 'troubleshooting.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate workflow examples documentation
   */
  generateWorkflowExamples(): DocPage {
    const content = `# Workflow Examples

## Basic Autonomous Fix

\`\`\`bash
# Fix a TypeScript file
autic fix --target src/index.ts

# Fix with specific model
autic fix --target src/index.ts --model gpt-4o

# Preview changes
autic fix --target src/index.ts --dry-run
\`\`\`

## Interactive Chat

\`\`\`bash
# Start a new chat session
autic chat

# Start with a specific model
autic chat --model claude-3.5-sonnet

# Restore a previous session
autic chat --session <session-id>

# Load context from a file
autic chat --file CONTEXT.md
\`\`\`

## R&D Pipeline

\`\`\`bash
# Full development pipeline
autic orchestrate "Build a REST API"

# Analysis only
autic orchestrate "Review architecture" --pipeline analysis-only

# Engineering only
autic orchestrate "Implement feature" --pipeline engineering-only

# Single stage
autic orchestrate "Design system" --stage plan
\`\`\`

## Multi-Agent Swarm

\`\`\`bash
# Check swarm status
autic swarm status

# Run with swarm coordination
autic swarm start --goal "Refactor codebase"

# Stop swarm
autic swarm stop
\`\`\`

## Provider Management

\`\`\`bash
# List providers
autic providers

# Add provider
autic providers add openrouter --key sk-...

# Check all providers
autic providers check

# View models
autic models
\`\`\`

## Security and Privacy

\`\`\`bash
# Check security status
autic security status

# Set privacy mode
autic privacy set local_only

# View vault status
autic security vault
\`\`\`

## Diagnostics and Health

\`\`\`bash
# Run full diagnostics
autic doctor

# Check runtime stability
autic stability health

# View system metrics
autic stability resources

# Run production validation
autic validate all
\`\`\`
`;

    return {
      id: 'workflow-examples',
      title: 'Workflow Examples',
      path: path.join(this.options.outputDir, 'workflow-examples.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Write generated documentation to disk
   */
  writeDocs(pages: DocPage[]): void {
    for (const page of pages) {
      const dir = path.dirname(page.path);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(page.path, page.content, 'utf-8');
    }
  }

  /**
   * Generate architecture documentation
   */
  generateArchitectureDocs(): DocPage {
    const content = `# Autic Architecture

> Version: ${this.options.version} | System architecture overview.

## Overview

Autic is a production-grade CLI-native autonomous AI engineering runtime. It provides a deterministic, local-first platform for AI-assisted software engineering with a modular layered architecture.

### Layer Architecture

1. **CLI Layer** — Commander-based CLI with 40+ commands
2. **Orchestration Layer** — Neuro Brain, role agents, pipeline execution
3. **Execution Runtime** — Workflow engine, provider routing, context management
4. **Security & Privacy Layer** — Encrypted vault, permissions, sanitization
5. **Stability & Hardening** — Watchdog, recovery, deadlock protection
6. **Diagnostics & Observability** — Doctor, observability, audit, profiling
7. **Validation & Certification** — Workflow validation, chaos testing, regression
8. **Ecosystem & Extensibility** — SDK, extension registry, governance
9. **Release & Distribution** — Release channels, update management

### Key Design Decisions

- **Local-first** — All processing on-device. No cloud dependency.
- **BYOK** — Users bring their own API keys.
- **Deterministic orchestration** — Predictable, auditable execution flows.
- **Modular packages** — Independent packages with clear interfaces.

For the full architecture document, see \`docs/ARCHITECTURE.md\`.
`;

    return {
      id: 'architecture',
      title: 'Architecture Overview',
      path: path.join(this.options.outputDir, 'architecture.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate subsystem contracts documentation
   */
  generateSubsystemContractsDocs(): DocPage {
    const content = `# Subsystem Contracts

> Version: ${this.options.version} | Public API contracts between Autic subsystems.

## Provider Layer

- \`ProviderRouter\` — Routes requests to the appropriate provider
- \`ProviderRegistry\` — Manages registered providers
- \`ProviderHealthCheck\` — Validates provider connectivity

## Orchestration Layer

- \`NeuroBrain\` — Central orchestration intelligence
- \`PipelineExecutor\` — Executes staged pipelines
- \`SwarmCoordinator\` — Manages multi-agent coordination

## Security Layer

- \`Vault\` — Encrypted secret storage with AES-256-GCM
- \`SecretSanitizer\` — Automatic output sanitization
- \`PermissionManager\` — Granular permission enforcement

## Validation Layer

- \`WorkflowValidator\` — Validates workflows against project types
- \`ChaosSimulator\` — Provider failure simulation
- \`RegressionPreventer\` — Regression detection across subsystems
- \`PlatformCertifier\` — Platform certification checks

## SDH Layer

- \`ExtensionManifest\` — Extension metadata and permissions
- \`ExtensionLifecycleManager\` — Extension lifecycle management
- \`PluginSandbox\` — Isolated plugin execution

For the full contracts document, see \`docs/SUBSYSTEM_CONTRACTS.md\`.
`;

    return {
      id: 'subsystem-contracts',
      title: 'Subsystem Contracts',
      path: path.join(this.options.outputDir, 'subsystem-contracts.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate extension SDK documentation
   */
  generateExtensionSdkDocs(): DocPage {
    const content = `# Extension SDK Guide

> Version: ${this.options.version} | Building extensions for Autic.

## Overview

The \`@autic/sdk\` provides a safe, sandboxed framework for building third-party extensions.

### Creating an Extension

1. Create an \`autic-extension.json\` manifest:
\`\`\`json
{
  "name": "my-extension",
  "version": "1.0.0",
  "permissions": ["runtime:read", "context:read"],
  "hooks": ["runtime:init", "runtime:destroy"]
}
\`\`\`

2. Implement hooks using the SDK:
\`\`\`typescript
import { RuntimeHooks, RuntimeHookEvent } from '@autic/sdk';
const hooks = new RuntimeHooks();
hooks.on(RuntimeHookEvent.INIT, async (ctx) => {
  console.log(\`Extension initialized: \${ctx.sessionId}\`);
});
export default hooks;
\`\`\`

### Available Hooks

- **Runtime Hooks** — \`INIT\`, \`DESTROY\`, \`ERROR\`
- **Provider Hooks** — \`BEFORE_REQUEST\`, \`AFTER_REQUEST\`, \`ON_ERROR\`
- **Workflow Hooks** — \`BEFORE_STEP\`, \`AFTER_STEP\`, \`ON_COMPLETE\`, \`ON_ERROR\`
- **Orchestration Hooks** — \`BEFORE_PIPELINE\`, \`AFTER_PIPELINE\`, \`ON_STAGE_START\`, \`ON_STAGE_COMPLETE\`
- **Context Hooks** — \`BEFORE_BUILD\`, \`AFTER_BUILD\`, \`BEFORE_OPTIMIZE\`, \`AFTER_OPTIMIZE\`

For the full SDK guide, see \`docs/EXTENSION_SDK.md\`.
`;

    return {
      id: 'extension-sdk',
      title: 'Extension SDK Guide',
      path: path.join(this.options.outputDir, 'extension-sdk.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate security documentation
   */
  generateSecurityDocs(): DocPage {
    const content = `# Security Architecture

> Version: ${this.options.version} | Security overview for Autic.

## Security Layers

1. **Encrypted Vault** — AES-256-GCM encrypted secret storage
2. **Secret Sanitization** — Automatic redaction from all output
3. **Permission Management** — Granular permission controls
4. **Security Profiles** — \`safe\`, \`balanced\`, \`full_auto\`, \`local_only\`
5. **Runtime Validation** — Continuous security boundary enforcement
6. **Extension Governance** — Trust metadata, permission auditing, unsafe detection

### Telemetry Security

Telemetry is strictly opt-in and privacy-safe:
- ✅ Anonymized runtime metrics (aggregate only)
- ✅ Crash categories (type, count — no stack traces)
- ✅ Provider reliability stats (success rate, avg latency)
- ❌ NEVER: source code, file contents, prompts, API keys, credentials

For the full security document, see \`docs/SECURITY.md\`.
`;

    return {
      id: 'security',
      title: 'Security Guide',
      path: path.join(this.options.outputDir, 'security.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Generate core concepts documentation
   */
  generateCoreConceptsDocs(): DocPage {
    const content = `# Core Concepts

> Version: ${this.options.version} | Essential concepts for using Autic.

## Key Concepts

### Providers

LLM services that power Autic's AI capabilities:
- **OpenRouter** — 200+ models through a single API
- **Ollama** — Local models for offline/private use
- **OpenAI / Anthropic** — Direct API access

### Sessions

Sessions maintain context across interactions. Each chat or workflow creates a session.

### Workflows

Autonomous execution sequences that accomplish engineering goals.

### Orchestration Pipelines

Multi-stage execution flows: Research → Plan → Architect → Engineer → Verify → Repair → Final Review

### Security Profiles

\`safe\` (read-only), \`balanced\` (workspace, default), \`full_auto\` (any), \`local_only\` (offline)

## First Steps

1. \`autic init\` — Initialize workspace
2. \`autic providers add openrouter --key YOUR_KEY\` — Add a provider
3. \`autic doctor\` — Verify setup
4. \`autic chat\` — Start chatting

For the full concepts guide, see \`docs/CORE_CONCEPTS.md\`.
`;

    return {
      id: 'core-concepts',
      title: 'Core Concepts',
      path: path.join(this.options.outputDir, 'core-concepts.md'),
      content,
      sections: this.extractSections(content),
    };
  }

  /**
   * Update output configuration
   */
  setOptions(options: Partial<DocGenOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * Render a comprehensive command page from multiple commands
   */
  private renderCommandPage(commands: CommandDoc[]): string {
    let content = '# Command Reference\n\n';

    for (const cmd of commands) {
      content += this.renderSingleCommandDoc(cmd);
      content += '\n---\n\n';

      if (cmd.subcommands) {
        for (const sub of cmd.subcommands) {
          content += this.renderSingleCommandDoc(sub, cmd.name);
          content += '\n---\n\n';
        }
      }
    }

    return content;
  }

  /**
   * Render a single command documentation block
   */
  private renderSingleCommandDoc(cmd: CommandDoc, parent?: string): string {
    const fullName = parent ? `${parent} ${cmd.name}` : cmd.name;
    let content = `## ${fullName}\n\n${cmd.description}\n\n`;

    // Usage
    content += `### Usage\n\n\`\`\`bash\n${cmd.usage}\n\`\`\`\n\n`;

    // Arguments
    if (cmd.arguments.length > 0) {
      content += '### Arguments\n\n';
      content += '| Name | Description | Required |\n';
      content += '|------|-------------|----------|\n';
      for (const arg of cmd.arguments) {
        content += `| \`${arg.name}\` | ${arg.description} | ${arg.required ? 'Yes' : 'No'} |\n`;
      }
      content += '\n';
    }

    // Options
    if (cmd.options.length > 0) {
      content += '### Options\n\n';
      content += '| Flag | Description | Default |\n';
      content += '|------|-------------|---------|\n';
      for (const opt of cmd.options) {
        content += `| \`${opt.flag}\` | ${opt.description} | ${opt.default ?? '-'} |\n`;
      }
      content += '\n';
    }

    // Examples
    if (this.options.includeExamples && cmd.examples.length > 0) {
      content += '### Examples\n\n';
      for (const example of cmd.examples) {
        content += `\`\`\`bash\n${example}\n\`\`\`\n\n`;
      }
    }

    return content;
  }

  /**
   * Extract sections from markdown content
   */
  private extractSections(content: string): DocSection[] {
    const sections: DocSection[] = [];
    const lines = content.split('\n');
    let current: DocSection | null = null;

    for (const line of lines) {
      const h1Match = line.match(/^# (.+)$/);
      const h2Match = line.match(/^## (.+)$/);
      const h3Match = line.match(/^### (.+)$/);

      if (h1Match) {
        current = {
          id: h1Match[1].toLowerCase().replace(/\s+/g, '-'),
          title: h1Match[1],
          content: '',
          level: 1,
          children: [],
        };
        sections.push(current);
      } else if (h2Match && current) {
        const section: DocSection = {
          id: h2Match[1].toLowerCase().replace(/\s+/g, '-'),
          title: h2Match[1],
          content: '',
          level: 2,
          children: [],
        };
        current.children.push(section);
      } else if (h3Match && current) {
        const section: DocSection = {
          id: h3Match[1].toLowerCase().replace(/\s+/g, '-'),
          title: h3Match[1],
          content: '',
          level: 3,
          children: [],
        };
        (current.children.length > 0
          ? current.children[current.children.length - 1].children
          : current.children
        ).push(section);
      }
    }

    return sections;
  }
}

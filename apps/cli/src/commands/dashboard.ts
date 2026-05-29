/**
 * autic — Launchpad Dashboard
 *
 * Professional terminal dashboard shown when running `autic` with no arguments.
 * Dynamically detects workspace state, provider status, and health.
 *
 * Premium blue-themed terminal output using @autic/ui components.
 */

import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { colorText, startupHeader, divider, heading } from '@autic/ui';

export async function dashboardCommand(): Promise<void> {
  const cwd = process.cwd();
  const auticDir = join(cwd, '.autic');
  const configPath = join(auticDir, 'config.json');

  // Detect workspace state
  let workspaceInitialized = false;
  try {
    await access(configPath);
    workspaceInitialized = true;
  } catch {
    // Not initialized
  }

  // Detect provider environment
  const hasOpenRouterKey = !!(process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY);

  // ── Header ──────────────────────────────────────────────────
  const headerLines = startupHeader('Autic', '0.1.0', workspaceInitialized ? 'ready' : 'loading');
  console.log('');
  for (const line of headerLines) {
    console.log(line);
  }
  console.log('');

  // ── Workspace Section ────────────────────────────────────────
  console.log(`  ${heading('Workspace')}`);
  console.log(`  ${divider(40)}`);
  console.log(`    ${colorText('Directory:', 'dim')}  ${cwd}`);

  if (workspaceInitialized) {
    console.log(`    ${colorText('Status:', 'dim')}    ${colorText('✓ Initialized', 'success')}`);
    console.log(
      `    ${colorText('→', 'dim')} ${colorText('autic doctor', 'primary')}    ${colorText('Run diagnostics', 'muted')}`,
    );
  } else {
    console.log(
      `    ${colorText('Status:', 'dim')}    ${colorText('○ Not initialized', 'warning')}`,
    );
    console.log(
      `    ${colorText('→', 'dim')} ${colorText('autic init', 'primary')}      ${colorText('Initialize workspace', 'muted')}`,
    );
  }
  console.log('');

  // ── Provider Status ──────────────────────────────────────────
  console.log(`  ${heading('Provider Status')}`);
  console.log(`  ${divider(40)}`);
  if (hasOpenRouterKey) {
    console.log(
      `    ${colorText('●', 'success')} ${colorText('OpenRouter', 'bold')}  ${colorText('API key found in environment', 'dim')}`,
    );
  } else {
    console.log(
      `    ${colorText('○', 'muted')} ${colorText('OpenRouter', 'bold')}  ${colorText('Not configured', 'dim')}`,
    );
  }
  console.log(
    `    ${colorText('○', 'muted')} ${colorText('Ollama', 'bold')}      ${colorText('Check with autic doctor', 'dim')}`,
  );
  console.log('');
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic providers setup openrouter', 'primary')}  ${colorText('Set up a cloud provider', 'muted')}`,
  );
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic providers setup ollama', 'primary')}      ${colorText('Set up a local provider', 'muted')}`,
  );
  console.log('');

  // ── Quick Commands ──────────────────────────────────────────
  console.log(`  ${heading('Quick Start')}`);
  console.log(`  ${divider(40)}`);
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic profile set balanced', 'primary')}        ${colorText('Set developer profile', 'muted')}`,
  );
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic chat', 'primary')}                        ${colorText('Start a chat session', 'muted')}`,
  );
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic fix --target .', 'primary')}               ${colorText('Run autonomous fix on project', 'muted')}`,
  );
  console.log(
    `    ${colorText('→', 'dim')} ${colorText('autic workflow', 'primary')}                     ${colorText('Run an engineering workflow', 'muted')}`,
  );
  console.log('');

  // ── Command Categories ──────────────────────────────────────
  console.log(`  ${heading('Command Categories')}`);
  console.log(`  ${divider(40)}`);
  console.log('');
  console.log(`    ${colorText('Core', 'bold')}`);
  console.log(
    `      ${colorText('chat', 'primary').padEnd(22)} ${colorText('Interactive AI engineering session', 'dim')}`,
  );
  console.log(
    `      ${colorText('fix', 'primary').padEnd(22)} ${colorText('Autonomous fix workflow', 'dim')}`,
  );
  console.log(
    `      ${colorText('workflow', 'primary').padEnd(22)} ${colorText('End-to-end engineering workflow', 'dim')}`,
  );
  console.log(
    `      ${colorText('run', 'primary').padEnd(22)} ${colorText('Execute a task or script', 'dim')}`,
  );
  console.log('');

  console.log(`    ${colorText('Providers & Models', 'bold')}`);
  console.log(
    `      ${colorText('providers', 'primary').padEnd(22)} ${colorText('List, add, and manage LLM providers', 'dim')}`,
  );
  console.log(
    `      ${colorText('models', 'primary').padEnd(22)} ${colorText('Search, install, and list models', 'dim')}`,
  );
  console.log('');

  console.log(`    ${colorText('Sessions & Memory', 'bold')}`);
  console.log(
    `      ${colorText('sessions', 'primary').padEnd(22)} ${colorText('Create, list, and restore sessions', 'dim')}`,
  );
  console.log(
    `      ${colorText('config', 'primary').padEnd(22)} ${colorText('View and modify configuration', 'dim')}`,
  );
  console.log('');

  console.log(`    ${colorText('Advanced', 'bold')}`);
  console.log(
    `      ${colorText('orchestrate', 'primary').padEnd(22)} ${colorText('Full R&D pipeline execution', 'dim')}`,
  );
  console.log(
    `      ${colorText('swarm', 'primary').padEnd(22)} ${colorText('Multi-agent swarm orchestration', 'dim')}`,
  );
  console.log(
    `      ${colorText('security', 'primary').padEnd(22)} ${colorText('Security management and vault', 'dim')}`,
  );
  console.log(
    `      ${colorText('skills', 'primary').padEnd(22)} ${colorText('Skill management and execution', 'dim')}`,
  );
  console.log('');

  // ── Help line ───────────────────────────────────────────────
  console.log(`  ${divider(40)}`);
  console.log(
    `  ${colorText('For detailed help:', 'dim')}  ${colorText('autic help', 'primary')}  ${colorText('or', 'dim')}  ${colorText('autic <command> --help', 'primary')}`,
  );
  console.log('');
}

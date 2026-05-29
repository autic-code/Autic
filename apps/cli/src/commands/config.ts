/**
 * autic config — Manage Autic configuration.
 *
 * Supports: status, get, set, list, edit
 * Integrates with ConfigManager for layered config resolution.
 */

import { ConfigManager } from '@autic/config';
import type { RuntimePreferences, ProviderConfig } from '@autic/shared';
import { colorText, heading, divider } from '@autic/ui';

let configManager: ConfigManager | null = null;

async function getConfigManager(): Promise<ConfigManager> {
  if (!configManager) {
    configManager = new ConfigManager();
    await configManager.init();
  }
  return configManager;
}

export async function configCommand(action?: string, key?: string, value?: string): Promise<void> {
  await handleConfig(action, key, value);
}

async function handleConfig(action?: string, key?: string, value?: string): Promise<void> {
  const cm = await getConfigManager();

  if (!action || action === 'status') {
    await showConfigStatus(cm);
    return;
  }

  if (action === 'get') {
    await getConfigValue(cm, key);
    return;
  }

  if (action === 'set') {
    await setConfigValue(cm, key, value);
    return;
  }

  if (action === 'list') {
    await listAllConfig(cm);
    return;
  }

  // Help
  console.log(`\n  ${heading('Configuration Management')}`);
  console.log(`  ${divider(48)}\n`);
  console.log(
    `  ${colorText('Usage:', 'primary')} ${colorText('autic config <action> [key] [value]', 'dim')}\n`,
  );
  console.log(`  ${colorText('Actions:', 'bold')}`);
  console.log(
    `    ${colorText('status', 'primary').padEnd(14)} ${colorText('Show current configuration status', 'dim')}`,
  );
  console.log(
    `    ${colorText('get <key>', 'primary').padEnd(14)} ${colorText('Get a configuration value', 'dim')}`,
  );
  console.log(
    `    ${colorText('set <kv>', 'primary').padEnd(14)} ${colorText('Set a configuration key=value', 'dim')}`,
  );
  console.log(
    `    ${colorText('list', 'primary').padEnd(14)} ${colorText('List all configuration values', 'dim')}`,
  );
  console.log('');
  console.log(`  ${colorText('Examples:', 'dim')}\n`);
  console.log(`    ${colorText('autic config', 'primary')}`);
  console.log(`    ${colorText('autic config status', 'primary')}`);
  console.log(`    ${colorText('autic config get defaultModel', 'primary')}`);
  console.log(`    ${colorText('autic config set defaultModel=gpt-4o', 'primary')}`);
  console.log(`    ${colorText('autic config list', 'primary')}`);
  console.log(`  ${divider(48)}\n`);
}

async function showConfigStatus(cm: ConfigManager): Promise<void> {
  const config = cm.getGlobalConfig();
  const workspace = cm.getWorkspaceConfig();
  const prefs = cm.getPreferences();

  console.log('\n  Autic Configuration\n');
  console.log(`  Global Config:  ~/.autic/config.json`);
  console.log(`  Version:        ${config.version}`);
  console.log(`  Profile:        ${config.profile}`);
  console.log(`  Providers:      ${config.providers.length} configured`);
  console.log(`  Last Updated:   ${new Date(config.lastUpdated).toISOString()}\n`);

  console.log('  Preferences:');
  for (const [k, v] of Object.entries(prefs)) {
    console.log(`    ${k}: ${JSON.stringify(v)}`);
  }

  if (workspace) {
    console.log(`\n  Workspace Config:  .autic/config.json`);
    console.log(`  Project:           ${workspace.projectName || '(not set)'}`);
    console.log(`  Profile:           ${workspace.profile || '(inheriting global)'}`);
    console.log(`  Init Completed:    ${workspace.initCompleted}`);
  }

  console.log('');
}

async function getConfigValue(cm: ConfigManager, key?: string): Promise<void> {
  if (!key) {
    console.log('\n  Usage: autic config get <key>\n');
    console.log('  Examples: autic config get defaultModel\n');
    return;
  }

  const prefs = cm.getPreferences();
  const prefKey = key as keyof RuntimePreferences;

  if (prefKey in prefs) {
    console.log(`\n  ${key} = ${JSON.stringify(prefs[prefKey])}\n`);
    return;
  }

  console.log(`\n  Unknown key: ${key}\n`);
}

async function setConfigValue(cm: ConfigManager, key?: string, value?: string): Promise<void> {
  if (!key || !value) {
    console.log('\n  Usage: autic config set <key>=<value>\n');
    console.log('  Examples:');
    console.log('    autic config set defaultModel=gpt-4o');
    console.log('    autic config set verbose=true\n');
    return;
  }

  // Support key=value format
  let actualKey = key;
  let actualValue = value;

  if (key.includes('=')) {
    const parts = key.split('=');
    actualKey = parts[0];
    actualValue = parts.slice(1).join('=');
  }

  // Coerce types
  const prefKey = actualKey as keyof RuntimePreferences;
  const allowedKeys: Array<keyof RuntimePreferences> = [
    'defaultModel',
    'defaultProvider',
    'maxTokens',
    'temperature',
    'verbose',
    'debug',
    'logLevel',
    'outputFormat',
  ];

  if (!allowedKeys.includes(prefKey)) {
    console.log(`\n  Unknown preference: ${actualKey}\n`);
    console.log('  Allowed keys:', allowedKeys.join(', '));
    console.log('');
    return;
  }

  let typedValue: string | number | boolean = actualValue;

  // Type coercion
  if (actualValue === 'true') typedValue = true;
  else if (actualValue === 'false') typedValue = false;
  else if (/^\d+$/.test(actualValue)) typedValue = parseInt(actualValue, 10);
  else if (/^\d+\.\d+$/.test(actualValue)) typedValue = parseFloat(actualValue);

  await cm.setPreference(prefKey, typedValue as never);
  console.log(`\n  ✓ ${actualKey} = ${JSON.stringify(typedValue)}\n`);
}

async function listAllConfig(cm: ConfigManager): Promise<void> {
  const global = cm.getGlobalConfig();
  const workspace = cm.getWorkspaceConfig();
  const prefs = cm.getPreferences();

  console.log('\n  Global Config');
  console.log('  ─────────────');
  console.log(JSON.stringify(global, null, 2));

  if (workspace) {
    console.log('\n  Workspace Config');
    console.log('  ────────────────');
    console.log(JSON.stringify(workspace, null, 2));
  }

  console.log('\n  Resolved Preferences');
  console.log('  ────────────────────');
  console.log(JSON.stringify(prefs, null, 2));
  console.log('');
}

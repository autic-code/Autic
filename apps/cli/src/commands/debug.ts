/**
 * autic debug — Debugging and tracing utilities.
 *
 * Supports: mode, trace, logs, inspect, platform
 * Integrates with logging system, execution tracing, provider tracing.
 */

import { ConfigManager } from '@autic/config';
import { PlatformValidator } from '@autic/diagnostics';

let configManager: ConfigManager | null = null;

async function getConfigManager(): Promise<ConfigManager> {
  if (!configManager) {
    configManager = new ConfigManager();
    await configManager.init();
  }
  return configManager;
}

export async function debugCommand(action?: string, sub?: string): Promise<void> {
  if (!action || action === 'mode') {
    await debugMode(sub);
    return;
  }

  if (action === 'platform') {
    await showPlatformInfo();
    return;
  }

  if (action === 'trace') {
    await showTraceInfo();
    return;
  }

  // Help
  console.log('\n  Usage: autic debug <action> [value]\n');
  console.log('  Actions:');
  console.log('    mode [on|off]    Enable or disable debug mode');
  console.log('    platform         Show platform information');
  console.log('    trace            Show execution tracing info\n');
  console.log('  Also available:');
  console.log('    autic doctor     Run full diagnostics\n');
}

async function debugMode(mode?: string): Promise<void> {
  const cm = await getConfigManager();

  if (!mode) {
    const prefs = cm.getPreferences();
    console.log(`\n  Debug mode: ${prefs.debug ? 'ON' : 'OFF'}`);
    console.log(`  Verbose:    ${prefs.verbose ? 'ON' : 'OFF'}`);
    console.log(`  Log level:  ${prefs.logLevel}\n`);
    console.log('  Set mode: autic debug mode on | autic debug mode off\n');
    return;
  }

  if (mode === 'on') {
    await cm.setPreference('debug', true);
    await cm.setPreference('logLevel', 'debug');
    console.log('\n  ✓ Debug mode enabled\n');
    console.log('  All debug and verbose output will be shown.');
    console.log('  Set AUTIC_DEBUG=true environment variable to persist.\n');
  } else if (mode === 'off') {
    await cm.setPreference('debug', false);
    await cm.setPreference('logLevel', 'info');
    console.log('\n  ✓ Debug mode disabled\n');
  } else {
    console.log('\n  Usage: autic debug mode [on|off]\n');
  }
}

async function showPlatformInfo(): Promise<void> {
  const validator = new PlatformValidator();
  validator.printPlatformInfo();

  const compat = await validator.validateCompatibility();
  if (compat.issues.length > 0) {
    console.log('  Issues:');
    for (const issue of compat.issues) {
      console.log(`    ✗ ${issue}`);
    }
    console.log('');
  }
  if (compat.warnings.length > 0) {
    for (const warn of compat.warnings) {
      console.log(`    ○ ${warn}`);
    }
    console.log('');
  }
  if (compat.compatible) {
    console.log('  ✓ Platform is compatible\n');
  }

  const recs = validator.getPlatformRecommendations();
  if (recs.length > 0) {
    console.log('  Recommendations:');
    for (const rec of recs) {
      console.log(`    → ${rec}`);
    }
    console.log('');
  }
}

async function showTraceInfo(): Promise<void> {
  console.log('\n  Execution Tracing\n');
  console.log('  Tracing is available in debug mode:\n');
  console.log('    autic debug mode on\n');
  console.log('  When enabled, the following are traced:');
  console.log('    • Runtime execution events');
  console.log('    • Provider/model selection');
  console.log('    • Tool calls and results');
  console.log('    • Queue operations');
  console.log('    • Workflow steps\n');
  console.log('  Traces are sent to stdout in debug mode.\n');
}

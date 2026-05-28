/**
 * CLI command: autic telemetry
 * Safe optional telemetry — opt-in, local-first, privacy-safe runtime metrics.
 * Never collects secrets, source code, prompts, or credentials.
 */

import { TelemetryCollector } from '@autic/telemetry';
import { colorText, heading, divider } from '@autic/ui';

export async function telemetryCommand(action?: string): Promise<void> {
  const collector = new TelemetryCollector();

  console.log(heading('Telemetry'));
  console.log(divider());

  switch (action) {
    case 'status': {
      const config = collector.getConfig();
      console.log(`  ${colorText('Telemetry Status', 'bold')}`);
      console.log(`  Enabled: ${config.enabled ? colorText('✓', 'success') : colorText('✗', 'dim')}`);
      console.log(`  Privacy mode: ${colorText(config.privacyMode, 'primary')}`);
      console.log(`  Data retention: ${config.retentionDays} days`);
      if (config.anonymizedOnly) {
        console.log(`  ${colorText('✓ All data is anonymized', 'success')}`);
      }
      break;
    }
    case 'enable': {
      collector.enable();
      console.log(`  ${colorText('✓ Telemetry enabled', 'success')}`);
      console.log(`  ${colorText('Only anonymized runtime metrics are collected.', 'dim')}`);
      console.log(`  ${colorText('Secrets, source code, prompts, and credentials are NEVER collected.', 'dim')}`);
      break;
    }
    case 'disable': {
      collector.disable();
      console.log(`  ${colorText('✗ Telemetry disabled', 'dim')}`);
      break;
    }
    case 'report': {
      console.log(`  ${colorText('Generating telemetry report...', 'primary')}`);
      const summary = await collector.getSummary();
      console.log(`\n  ${colorText('Runtime Metrics (anonymized)', 'bold')}`);
      console.log(`  Sessions: ${summary.sessions}`);
      console.log(`  Workflows: ${summary.workflows}`);
      console.log(`  Providers used: ${summary.providers.join(', ')}`);
      console.log(`  Avg workflow duration: ${summary.avgWorkflowDuration}ms`);
      console.log(`  Error rate: ${(summary.errorRate * 100).toFixed(1)}%`);
      if (summary.crashCategories.length > 0) {
        console.log(`\n  ${colorText('Crash Categories', 'bold')}`);
        for (const cat of summary.crashCategories) {
          console.log(`  • ${cat}`);
        }
      }
      break;
    }
    case 'clear': {
      await collector.clear();
      console.log(`  ${colorText('✓ Telemetry data cleared', 'success')}`);
      break;
    }
    default: {
      console.log(`  ${colorText('Usage:', 'bold')} autic telemetry [action]`);
      console.log(`\n  ${colorText('Actions:', 'bold')}`);
      console.log(`    ${colorText('status', 'primary')}    Show telemetry configuration`);
      console.log(`    ${colorText('enable', 'success')}   Enable anonymized telemetry`);
      console.log(`    ${colorText('disable', 'error')}   Disable telemetry collection`);
      console.log(`    ${colorText('report', 'primary')}   View anonymized runtime metrics`);
      console.log(`    ${colorText('clear', 'warning')}    Clear collected telemetry data`);
      console.log(`\n  ${colorText('Privacy Guarantee:', 'bold')}`);
      console.log(`  ${colorText('• Anonymized only — no personal data', 'dim')}`);
      console.log(`  ${colorText('• No source code or secrets ever collected', 'dim')}`);
      console.log(`  ${colorText('• No prompts or credentials', 'dim')}`);
      console.log(`  ${colorText('• Opt-in by default (disabled)', 'dim')}`);
      break;
    }
  }
}

/**
 * CLI command: autic ecosystem
 * Ecosystem maintenance — extension diagnostics, compatibility inspectors,
 * runtime audit tools, plugin lifecycle tooling
 */

import { EcosystemMaintenance } from '@autic/governance';
import { colorText, heading, divider } from '@autic/ui';

export async function ecosystemCommand(action?: string): Promise<void> {
  const maintenance = new EcosystemMaintenance();

  console.log(heading('Ecosystem Maintenance'));
  console.log(divider());

  switch (action) {
    case 'diagnostics':
    case 'diag': {
      console.log(`  ${colorText('Running extension diagnostics...', 'primary')}\n`);
      const results = await maintenance.runExtensionDiagnostics();
      for (const r of results) {
        const icon = r.healthy ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${r.name} (${r.type})`);
        console.log(`    Status: ${r.healthy ? colorText('Healthy', 'success') : colorText('Unhealthy', 'error')}`);
        if (r.issues.length > 0) {
          for (const issue of r.issues) {
            console.log(`    ${colorText('⚠', 'warning')} ${issue}`);
          }
        }
      }
      break;
    }
    case 'compat':
    case 'compatibility': {
      console.log(`  ${colorText('Running compatibility inspection...', 'primary')}\n`);
      const inspections = await maintenance.inspectCompatibility();
      for (const i of inspections) {
        const icon = i.compatible ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${i.name}`);
        console.log(`    Compatible: ${i.compatible ? colorText('Yes', 'success') : colorText('No', 'error')}`);
        console.log(`    Runtime API version: ${i.runtimeApiVersion}`);
        console.log(`    Required API version: ${i.requiredApiVersion}`);
      }
      break;
    }
    case 'audit':
    case 'runtime': {
      console.log(`  ${colorText('Running runtime audit...', 'primary')}\n`);
      const audit = await maintenance.auditRuntime();
      for (const a of audit) {
        const icon = a.passed ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${a.category}`);
        console.log(`    ${a.detail}`);
        if (a.recommendations.length > 0) {
          for (const rec of a.recommendations) {
            console.log(`    ${colorText('→', 'primary')} ${rec}`);
          }
        }
      }
      break;
    }
    case 'plugins':
    case 'lifecycle': {
      console.log(`  ${colorText('Managing plugin lifecycle...', 'primary')}\n`);
      const lifecycle = await maintenance.managePluginLifecycle();
      for (const p of lifecycle) {
        const icon = p.healthy ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${p.name}`);
        console.log(`    State: ${colorText(p.state, p.healthy ? 'success' : 'warning')}`);
        console.log(`    Version: ${p.version}`);
        console.log(`    Uptime: ${p.uptime}s`);
      }
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full ecosystem maintenance...', 'primary')}\n`);

      // Diagnostics
      console.log(`  ${colorText('▸ Extension Diagnostics', 'bold')}`);
      const diag = await maintenance.runExtensionDiagnostics();
      const healthyCount = diag.filter(d => d.healthy).length;
      console.log(`    ${healthyCount}/${diag.length} extensions healthy\n`);

      // Compatibility
      console.log(`  ${colorText('▸ Compatibility Inspection', 'bold')}`);
      const compat = await maintenance.inspectCompatibility();
      const compatCount = compat.filter(c => c.compatible).length;
      console.log(`    ${compatCount}/${compat.length} compatible\n`);

      // Runtime Audit
      console.log(`  ${colorText('▸ Runtime Audit', 'bold')}`);
      const audit = await maintenance.auditRuntime();
      const passed = audit.filter(a => a.passed).length;
      console.log(`    ${passed}/${audit.length} checks passed\n`);

      // Plugin Lifecycle
      console.log(`  ${colorText('▸ Plugin Lifecycle', 'bold')}`);
      const lifecycle = await maintenance.managePluginLifecycle();
      const healthyPlugins = lifecycle.filter(p => p.healthy).length;
      console.log(`    ${healthyPlugins}/${lifecycle.length} plugins healthy\n`);

      console.log(divider());
      const allHealthy = diag.every(d => d.healthy) && compat.every(c => c.compatible) && audit.every(a => a.passed);
      console.log(`  ${allHealthy ? colorText('ECOSYSTEM HEALTHY', 'success') : colorText('ISSUES FOUND', 'warning')}`);
      break;
    }
  }
}

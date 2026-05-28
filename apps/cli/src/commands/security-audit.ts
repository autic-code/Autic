/**
 * CLI command: autic security-audit
 * Security audit framework — permission bypass detection,
 * vault isolation, sanitization integrity, unsafe command handling,
 * extension boundary enforcement
 */

import { SecurityAuditor } from '@autic/governance';
import { colorText, heading, divider } from '@autic/ui';

export async function securityAuditCommand(action?: string): Promise<void> {
  const auditor = new SecurityAuditor();

  console.log(heading('Security Audit'));
  console.log(divider());

  switch (action) {
    case 'permissions':
    case 'perms': {
      console.log(`  ${colorText('Checking for permission bypass attempts...', 'primary')}\n`);
      const results = await auditor.checkPermissionBypass();
      printAuditResults(results);
      break;
    }
    case 'vault': {
      console.log(`  ${colorText('Validating vault isolation...', 'primary')}\n`);
      const results = await auditor.validateVaultIsolation();
      printAuditResults(results);
      break;
    }
    case 'sanitization':
    case 'sanitize': {
      console.log(`  ${colorText('Verifying sanitization integrity...', 'primary')}\n`);
      const results = await auditor.verifySanitization();
      printAuditResults(results);
      break;
    }
    case 'commands':
    case 'cmd': {
      console.log(`  ${colorText('Auditing unsafe command handling...', 'primary')}\n`);
      const results = await auditor.auditUnsafeCommands();
      printAuditResults(results);
      break;
    }
    case 'boundaries':
    case 'bounds': {
      console.log(`  ${colorText('Enforcing extension boundaries...', 'primary')}\n`);
      const results = await auditor.enforceExtensionBoundaries();
      printAuditResults(results);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full security audit...', 'primary')}\n`);

      const audits = [
        { name: 'Permission Bypass Detection', fn: () => auditor.checkPermissionBypass() },
        { name: 'Vault Isolation Validation', fn: () => auditor.validateVaultIsolation() },
        { name: 'Sanitization Integrity', fn: () => auditor.verifySanitization() },
        { name: 'Unsafe Command Audit', fn: () => auditor.auditUnsafeCommands() },
        { name: 'Extension Boundary Enforcement', fn: () => auditor.enforceExtensionBoundaries() },
      ];

      let totalPassed = 0;
      let totalFailed = 0;

      for (const audit of audits) {
        console.log(`  ${colorText('⟳', 'primary')} ${audit.name}...`);
        const results = await audit.fn();
        const passed = results.filter((r) => r.passed).length;
        const failed = results.filter((r) => !r.passed).length;
        totalPassed += passed;
        totalFailed += failed;
        const icon = failed === 0 ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${passed}/${results.length} passed\n`);
        for (const r of results) {
          if (!r.passed) {
            console.log(`     ${colorText('⚠', 'warning')} ${r.name}: ${r.detail}`);
          }
        }
        if (failed > 0) console.log('');
      }

      console.log(divider());
      console.log(`  ${colorText('Audit Summary', 'bold')}`);
      console.log(`  Passed: ${colorText(totalPassed.toString(), 'success')}`);
      console.log(
        `  Failed: ${colorText(totalFailed.toString(), totalFailed > 0 ? 'error' : 'success')}`,
      );
      const secure = totalFailed === 0;
      console.log(
        `  Status: ${secure ? colorText('SECURE — All checks passed', 'success') : colorText('ISSUES DETECTED', 'error')}`,
      );
      break;
    }
  }
}

function printAuditResults(
  results: Array<{ name: string; passed: boolean; detail?: string; severity?: string }>,
): void {
  for (const r of results) {
    const icon = r.passed ? colorText('✓', 'success') : colorText('✗', 'error');
    console.log(`  ${icon} ${r.name}`);
    if (!r.passed && r.detail) {
      console.log(`     ${colorText(r.detail, 'dim')}`);
    }
  }
}

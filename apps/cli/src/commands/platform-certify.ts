/**
 * CLI command: autic platform-certify
 * Platform certification — validates:
 * - local-first integrity
 * - BYOK guarantees
 * - offline-safe workflows
 * - orchestration stability
 * - security boundaries
 * - ecosystem safety
 */

import { PlatformCertifier } from '@autic/validation';
import { colorText, heading, divider } from '@autic/ui';

export async function platformCertifyCommand(action?: string): Promise<void> {
  const certifier = new PlatformCertifier();

  console.log(heading('Platform Certification'));
  console.log(divider());

  switch (action) {
    case 'local-first':
    case 'local': {
      console.log(`  ${colorText('Validating local-first integrity...', 'primary')}\n`);
      const results = await certifier.validateLocalFirst();
      printCertificationResults(results);
      break;
    }
    case 'byok': {
      console.log(`  ${colorText('Validating BYOK guarantees...', 'primary')}\n`);
      const results = await certifier.validateBYOK();
      printCertificationResults(results);
      break;
    }
    case 'offline': {
      console.log(`  ${colorText('Validating offline-safe workflows...', 'primary')}\n`);
      const results = await certifier.validateOfflineSafe();
      printCertificationResults(results);
      break;
    }
    case 'orchestration':
    case 'orch': {
      console.log(`  ${colorText('Validating orchestration stability...', 'primary')}\n`);
      const results = await certifier.validateOrchestrationStability();
      printCertificationResults(results);
      break;
    }
    case 'security': {
      console.log(`  ${colorText('Validating security boundaries...', 'primary')}\n`);
      const results = await certifier.validateSecurityBoundaries();
      printCertificationResults(results);
      break;
    }
    case 'ecosystem':
    case 'eco': {
      console.log(`  ${colorText('Validating ecosystem safety...', 'primary')}\n`);
      const results = await certifier.validateEcosystemSafety();
      printCertificationResults(results);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full platform certification...', 'primary')}\n`);

      const validations = [
        { name: 'Local-First Integrity', fn: () => certifier.validateLocalFirst() },
        { name: 'BYOK Guarantees', fn: () => certifier.validateBYOK() },
        { name: 'Offline-Safe Workflows', fn: () => certifier.validateOfflineSafe() },
        { name: 'Orchestration Stability', fn: () => certifier.validateOrchestrationStability() },
        { name: 'Security Boundaries', fn: () => certifier.validateSecurityBoundaries() },
        { name: 'Ecosystem Safety', fn: () => certifier.validateEcosystemSafety() },
      ];

      let totalPassed = 0;
      let totalFailed = 0;
      let totalChecks = 0;

      for (const v of validations) {
        console.log(`  ${colorText('⟳', 'primary')} ${v.name}...`);
        const results = await v.fn();
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        totalPassed += passed;
        totalFailed += failed;
        totalChecks += results.length;

        const icon = failed === 0 ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${passed}/${results.length} passed\n`);

        if (failed > 0) {
          for (const r of results) {
            if (!r.passed) {
              console.log(`     ${colorText('⚠', 'warning')} ${r.name}: ${r.detail}`);
            }
          }
          console.log('');
        }
      }

      console.log(divider());
      console.log(`  ${colorText('Certification Summary', 'bold')}`);
      console.log(`  Total checks: ${totalChecks}`);
      console.log(`  Passed: ${colorText(totalPassed.toString(), 'success')}`);
      console.log(`  Failed: ${colorText(totalFailed.toString(), totalFailed > 0 ? 'error' : 'success')}`);
      console.log(`  Pass rate: ${((totalPassed / totalChecks) * 100).toFixed(1)}%`);

      const certified = totalFailed === 0;
      if (certified) {
        console.log(`\n  ${colorText('═══════════════════════════════════════', 'success')}`);
        console.log(`  ${colorText('  PLATFORM CERTIFIED ✓', 'success')}`);
        console.log(`  ${colorText('═══════════════════════════════════════', 'success')}`);
      } else {
        console.log(`\n  ${colorText('  Platform certification requires all checks to pass', 'warning')}`);
      }
      break;
    }
  }
}

function printCertificationResults(results: Array<{ name: string; passed: boolean; detail?: string; severity?: string }>): void {
  for (const r of results) {
    const icon = r.passed ? colorText('✓', 'success') : colorText('✗', 'error');
    console.log(`  ${icon} ${r.name}`);
    if (!r.passed && r.detail) {
      console.log(`     ${colorText(r.detail, 'dim')}`);
    }
  }
}

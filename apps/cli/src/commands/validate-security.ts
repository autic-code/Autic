/**
 * autic validate-security — Security validation command.
 *
 * Performs final validation of vault isolation, secret sanitization,
 * permission boundaries, extension safety, provider isolation,
 * and local-first guarantees.
 */

import { SecurityValidator } from '@autic/diagnostics';

/**
 * Run validate-security command
 */
export async function validateSecurityCommand(): Promise<void> {
  const validator = new SecurityValidator();
  const report = validator.validateAll();

  console.log('\n  ╭─── Security Validation ────────────────────╮');

  for (const result of report.results) {
    const icon = result.passed ? '✓' : '✗';
    const severity = result.passed ? '' : ` [${result.severity?.toUpperCase()}]`;
    console.log(`  ${icon} ${result.check.padEnd(34)}${severity}`);

    if (!result.passed && result.recommendation) {
      console.log(`    ${result.recommendation}`);
    }
  }

  console.log('  ╰──────────────────────────────────────────────╯');
  console.log('\n  Summary:');
  console.log(`    Passed:  ${report.summary.passed}`);
  console.log(`    Warnings: ${report.summary.warnings}`);
  console.log(`    Errors:  ${report.summary.errors}`);
  console.log(`    Critical: ${report.summary.critical}`);

  if (report.overallPass) {
    console.log('\n  ✓ All security checks passed.');
  } else {
    console.log('\n  ⚠ Some security checks require attention.');
  }
}

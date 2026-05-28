/**
 * autic doctor — Enhanced diagnostics for Autic environment.
 * Uses @autic/diagnostics Doctor for comprehensive structured reporting.
 * Premium blue-themed terminal output.
 */

import { ConfigManager } from '@autic/config';
import { Doctor } from '@autic/diagnostics';
import type { DiagnosticCheck, DiagnosticReport } from '@autic/shared';
import { colorText, heading, divider } from '@autic/ui';

export async function doctorCommand(action?: string): Promise<void> {
  const cm = new ConfigManager();
  await cm.init();
  const doctor = new Doctor(cm);

  if (action === 'full' || !action) {
    const report = await doctor.runFull();
    doctor.printReport(report);
    await printUpdateInfo(cm);
    return;
  }

  if (action === 'quick') {
    const checks = await doctor.runQuick();
    printQuickResults(checks);
    return;
  }

  if (action === 'provider') {
    await printProviderHelp(doctor);
    return;
  }

  if (action === 'validate') {
    await printValidationResults(cm);
    return;
  }

  // Help
  console.log(`\n  ${colorText('Usage:', 'primary')} autic doctor [action]\n`);
  console.log(`  ${colorText('Actions:', 'bold')}`);
  console.log(
    `    ${colorText('(default)', 'dim')}    ${colorText('Run full diagnostics', 'default')}`,
  );
  console.log(
    `    ${colorText('full', 'primary')}      ${colorText('Run comprehensive diagnostics', 'default')}`,
  );
  console.log(
    `    ${colorText('quick', 'primary')}      ${colorText('Run quick system + provider check', 'default')}`,
  );
  console.log(
    `    ${colorText('validate', 'primary')}   ${colorText('Run installation validation', 'default')}`,
  );
  console.log(`  ${divider(48)}\n`);
}

async function printUpdateInfo(cm: ConfigManager): Promise<void> {
  const { UpdateChecker } = await import('@autic/config');
  const uc = new UpdateChecker(cm.getUpdateConfig());
  await uc.loadCache();
  const result = await uc.check();
  const msg = uc.formatUpdateMessage(result);
  if (msg) {
    console.log(msg);
  }
}

function printQuickResults(checks: DiagnosticCheck[]): void {
  console.log(`\n  ${heading('Quick Diagnostics')}`);
  console.log(`  ${divider(48)}\n`);
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    const variant =
      check.status === 'pass' ? 'success' : check.status === 'warn' ? 'warning' : 'error';
    console.log(`  ${colorText(icon, variant)} ${colorText(check.name, 'bold')}`);
    console.log(`     ${check.message}`);
    if (check.suggestion) console.log(`     ${colorText('→', 'dim')} ${check.suggestion}`);
    console.log('');
  }
}

async function printProviderHelp(doctor: Doctor): Promise<void> {
  console.log(
    `\n  ${colorText('Provider diagnostics:', 'primary')} ${colorText('autic doctor provider <provider-id>', 'dim')}\n`,
  );
}

async function printValidationResults(cm: ConfigManager): Promise<void> {
  const { InstallationValidator } = await import('@autic/diagnostics');
  const validator = new InstallationValidator(cm);
  const result = await validator.validate();
  const icons: Record<string, string> = { pass: '✓', warn: '⚠', fail: '✗' };
  const variants: Record<string, string> = { pass: 'success', warn: 'warning', fail: 'error' };

  console.log(`\n  ${heading('Installation Validation')}`);
  console.log(`  ${divider(48)}\n`);
  for (const check of result.checks) {
    const icon = icons[check.status] || '?';
    const variant = variants[check.status] || 'dim';
    console.log(
      `  ${colorText(icon, variant as 'success' | 'warning' | 'error' | 'dim')} ${colorText(check.name, 'bold')}`,
    );
    console.log(`     ${check.message}`);
    if (check.details) console.log(`     ${colorText('→', 'dim')} ${check.details}`);
  }
  console.log(
    `\n  ${result.passed ? colorText('✓ All checks passed', 'success') : colorText('⚠ Some checks need attention', 'warning')}\n`,
  );
}

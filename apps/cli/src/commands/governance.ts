/**
 * CLI command: autic governance
 * Extension governance — trust metadata, permission auditing,
 * compatibility scoring, unsafe-extension detection, runtime isolation validation
 */

import { ExtensionGovernor } from '@autic/governance';
import { colorText, heading, divider } from '@autic/ui';

export async function governanceCommand(action?: string): Promise<void> {
  const governor = new ExtensionGovernor();

  console.log(heading('Extension Governance'));
  console.log(divider());

  switch (action) {
    case 'trust':
    case 'trusts': {
      console.log(`  ${colorText('Checking extension trust metadata...', 'primary')}\n`);
      const reports = await governor.auditTrustMetadata();
      for (const report of reports) {
        const icon = report.trusted ? colorText('✓', 'success') : colorText('⚠', 'warning');
        console.log(`  ${icon} ${report.name}`);
        console.log(`    Trust score: ${(report.trustScore * 100).toFixed(0)}%`);
        console.log(`    Publisher: ${report.publisher || 'Unknown'}`);
        if (report.issues.length > 0) {
          for (const issue of report.issues) {
            console.log(`    ${colorText('⚠', 'warning')} ${issue}`);
          }
        }
      }
      break;
    }
    case 'permissions':
    case 'perms': {
      console.log(`  ${colorText('Auditing extension permissions...', 'primary')}\n`);
      const audits = await governor.auditPermissions();
      for (const audit of audits) {
        const icon = audit.safe ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${audit.extension}`);
        console.log(`    Requested permissions: ${audit.requestedPermissions.join(', ')}`);
        if (audit.overprivileged) {
          console.log(`    ${colorText('⚠', 'warning')} Possibly overprivileged`);
        }
        if (audit.recommendations.length > 0) {
          for (const rec of audit.recommendations) {
            console.log(`    ${colorText('→', 'primary')} ${rec}`);
          }
        }
      }
      break;
    }
    case 'compat':
    case 'compatibility': {
      console.log(`  ${colorText('Calculating extension compatibility scores...', 'primary')}\n`);
      const scores = await governor.scoreCompatibility();
      for (const score of scores) {
        const icon = score.compatible ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${score.name} (${(score.score * 100).toFixed(0)}%)`);
        if (score.issues.length > 0) {
          for (const issue of score.issues) {
            console.log(`    ${colorText('⚠', 'warning')} ${issue}`);
          }
        }
      }
      break;
    }
    case 'unsafe': {
      console.log(`  ${colorText('Scanning for unsafe extensions...', 'primary')}\n`);
      const threats = await governor.detectUnsafeExtensions();
      if (threats.length === 0) {
        console.log(`  ${colorText('✓ No unsafe extensions detected', 'success')}`);
      } else {
        for (const threat of threats) {
          console.log(`  ${colorText('✗', 'error')} ${threat.name} — ${threat.reason}`);
          console.log(`    ${colorText('Severity:', 'bold')} ${threat.severity}`);
        }
      }
      break;
    }
    case 'isolation':
    case 'isolate': {
      console.log(`  ${colorText('Validating runtime isolation...', 'primary')}\n`);
      const validations = await governor.validateIsolation();
      for (const v of validations) {
        const icon = v.passed ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${v.check}`);
        if (!v.passed) {
          console.log(`    ${colorText(v.detail, 'dim')}`);
        }
      }
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full extension governance audit...', 'primary')}\n`);

      // Trust metadata
      console.log(`  ${colorText('▸ Trust Metadata', 'bold')}`);
      const trusts = await governor.auditTrustMetadata();
      const trustedCount = trusts.filter(t => t.trusted).length;
      console.log(`    ${trustedCount}/${trusts.length} extensions trusted\n`);

      // Permissions
      console.log(`  ${colorText('▸ Permission Audit', 'bold')}`);
      const perms = await governor.auditPermissions();
      const safeCount = perms.filter(p => p.safe).length;
      console.log(`    ${safeCount}/${perms.length} permission sets safe\n`);

      // Compatibility
      console.log(`  ${colorText('▸ Compatibility Scores', 'bold')}`);
      const scores = await governor.scoreCompatibility();
      const compatCount = scores.filter(s => s.compatible).length;
      console.log(`    ${compatCount}/${scores.length} compatible\n`);

      // Unsafe extensions
      console.log(`  ${colorText('▸ Unsafe Extension Scan', 'bold')}`);
      const threats = await governor.detectUnsafeExtensions();
      console.log(`    ${threats.length} threats found\n`);

      // Isolation
      console.log(`  ${colorText('▸ Runtime Isolation', 'bold')}`);
      const isolation = await governor.validateIsolation();
      const passCount = isolation.filter(i => i.passed).length;
      console.log(`    ${passCount}/${isolation.length} checks passed\n`);

      console.log(divider());
      const allSafe = threats.length === 0 && isolation.every(i => i.passed);
      const verdict = allSafe ? colorText('GOVERNANCE PASSED', 'success') : colorText('ISSUES FOUND', 'warning');
      console.log(`  ${colorText('Verdict:', 'bold')} ${verdict}`);
      break;
    }
  }
}

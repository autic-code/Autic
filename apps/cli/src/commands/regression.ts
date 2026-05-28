/**
 * CLI command: autic regression
 * Regression prevention — architecture, orchestration, provider,
 * memory-system, and security regression checks
 */

import { RegressionPreventer } from '@autic/validation';
import { colorText, heading, divider } from '@autic/ui';

export async function regressionCommand(action?: string): Promise<void> {
  const preventer = new RegressionPreventer();

  console.log(heading('Regression Prevention'));
  console.log(divider());

  switch (action) {
    case 'architecture':
    case 'arch': {
      console.log(`  ${colorText('Running architecture regression checks...', 'primary')}\n`);
      const results = await preventer.checkArchitecture();
      printRegressionResults(results);
      break;
    }
    case 'orchestration':
    case 'orch': {
      console.log(`  ${colorText('Running orchestration regression checks...', 'primary')}\n`);
      const results = await preventer.checkOrchestration();
      printRegressionResults(results);
      break;
    }
    case 'provider': {
      console.log(
        `  ${colorText('Running provider compatibility regression checks...', 'primary')}\n`,
      );
      const results = await preventer.checkProviderCompatibility();
      printRegressionResults(results);
      break;
    }
    case 'memory': {
      console.log(`  ${colorText('Running memory-system regression checks...', 'primary')}\n`);
      const results = await preventer.checkMemorySystem();
      printRegressionResults(results);
      break;
    }
    case 'security': {
      console.log(`  ${colorText('Running security regression checks...', 'primary')}\n`);
      const results = await preventer.checkSecurity();
      printRegressionResults(results);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full regression prevention suite...', 'primary')}\n`);

      const checks = [
        { name: 'Architecture', fn: () => preventer.checkArchitecture() },
        { name: 'Orchestration', fn: () => preventer.checkOrchestration() },
        { name: 'Provider Compatibility', fn: () => preventer.checkProviderCompatibility() },
        { name: 'Memory System', fn: () => preventer.checkMemorySystem() },
        { name: 'Security', fn: () => preventer.checkSecurity() },
      ];

      let totalPassed = 0;
      let totalFailed = 0;

      for (const check of checks) {
        console.log(`  ${colorText('⟳', 'primary')} ${check.name}...`);
        const results = await check.fn();
        const passed = results.filter((r) => r.passed).length;
        const failed = results.filter((r) => !r.passed).length;
        totalPassed += passed;
        totalFailed += failed;
        const icon = failed === 0 ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${passed}/${results.length} passed\n`);
      }

      console.log(divider());
      console.log(`  ${colorText('Summary', 'bold')}`);
      console.log(`  Total passed: ${colorText(totalPassed.toString(), 'success')}`);
      console.log(
        `  Total failed: ${colorText(totalFailed.toString(), totalFailed > 0 ? 'error' : 'success')}`,
      );
      const healthy = totalFailed === 0;
      console.log(
        `  Status: ${healthy ? colorText('HEALTHY — No regressions detected', 'success') : colorText('REGRESSIONS DETECTED', 'error')}`,
      );
      break;
    }
  }
}

function printRegressionResults(
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

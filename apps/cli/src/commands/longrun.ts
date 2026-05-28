/**
 * CLI command: autic longrun
 * Run long-running autonomous workflow tests — multi-hour simulation,
 * queue saturation, orchestration stress, memory pressure
 */

import { LongRunTester } from '@autic/validation';
import { colorText, heading, divider } from '@autic/ui';

export async function longrunCommand(action?: string): Promise<void> {
  const tester = new LongRunTester();

  console.log(heading('Long-Run Autonomous Testing'));
  console.log(divider());

  switch (action) {
    case 'workflow': {
      console.log(
        `  ${colorText('⟳', 'primary')} Running multi-hour autonomous workflow simulation...\n`,
      );
      const result = await tester.simulateLongWorkflow();
      printRunResult(result);
      break;
    }
    case 'repair': {
      console.log(`  ${colorText('⟳', 'primary')} Running repeated repair cycle simulation...\n`);
      const result = await tester.simulateRepeatedRepairCycles();
      printRunResult(result);
      break;
    }
    case 'queue': {
      console.log(`  ${colorText('⟳', 'primary')} Running queue saturation test...\n`);
      const result = await tester.simulateQueueSaturation();
      printRunResult(result);
      break;
    }
    case 'orchestration': {
      console.log(`  ${colorText('⟳', 'primary')} Running orchestration stress validation...\n`);
      const result = await tester.simulateOrchestrationStress();
      printRunResult(result);
      break;
    }
    case 'memory': {
      console.log(`  ${colorText('⟳', 'primary')} Running memory-pressure testing...\n`);
      const result = await tester.simulateMemoryPressure();
      printRunResult(result);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Starting full long-run test suite...', 'primary')}\n`);

      const tests = [
        { name: 'Long-Lived Workflow', fn: () => tester.simulateLongWorkflow() },
        { name: 'Repair Cycles', fn: () => tester.simulateRepeatedRepairCycles() },
        { name: 'Queue Saturation', fn: () => tester.simulateQueueSaturation() },
        { name: 'Orchestration Stress', fn: () => tester.simulateOrchestrationStress() },
        { name: 'Memory Pressure', fn: () => tester.simulateMemoryPressure() },
      ];

      let allPassed = true;

      for (const test of tests) {
        console.log(`  ${colorText('⟳', 'primary')} Running ${test.name}...`);
        const result = await test.fn();
        const passed = result.every((r: { passed: boolean }) => r.passed);
        const icon = passed ? colorText('✓', 'success') : colorText('✗', 'error');
        console.log(`  ${icon} ${passed ? 'PASSED' : 'FAILED'}`);
        if (!passed) allPassed = false;

        for (const r of result) {
          if (!r.passed) {
            console.log(
              `    ${colorText('⚠', 'warning')} ${r.name}: ${r.error || 'Unknown error'}`,
            );
          }
        }
        console.log('');
      }

      console.log(divider());
      const verdict = allPassed
        ? colorText('ALL TESTS PASSED', 'success')
        : colorText('SOME TESTS FAILED', 'error');
      console.log(`  ${colorText('Final Verdict:', 'bold')} ${verdict}`);
      break;
    }
  }
}

function printRunResult(
  result: Array<{ name: string; passed: boolean; error?: string; duration: number }>,
): void {
  const allPassed = result.every((r) => r.passed);
  const icon = allPassed ? colorText('✓', 'success') : colorText('✗', 'error');
  console.log(`  ${icon} ${allPassed ? 'PASSED' : 'FAILED'}`);

  for (const r of result) {
    const itemIcon = r.passed ? colorText('✓', 'success') : colorText('✗', 'error');
    console.log(`    ${itemIcon} ${r.name} (${r.duration}ms)`);
    if (r.error) {
      console.log(`       ${colorText(r.error, 'dim')}`);
    }
  }
}

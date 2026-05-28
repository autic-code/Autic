/**
 * CLI command: autic chaos
 * Run provider chaos testing — simulate outages, rate limits, partial failures, slow streaming
 */

import { ChaosSimulator } from '@autic/validation';
import { colorText, heading, divider } from '@autic/ui';

export async function chaosCommand(action?: string): Promise<void> {
  const chaos = new ChaosSimulator();

  console.log(heading('Provider Chaos Testing'));
  console.log(divider());

  switch (action) {
    case 'outage': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating provider outages...\n`);
      const results = await chaos.simulateOutage();
      printScenarioResults('Outage Simulation', results);
      break;
    }
    case 'auth': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating invalid API key scenarios...\n`);
      const results = await chaos.simulateInvalidAuth();
      printScenarioResults('Auth Failure Simulation', results);
      break;
    }
    case 'slow': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating slow streaming...\n`);
      const results = await chaos.simulateSlowStreaming();
      printScenarioResults('Slow Stream Simulation', results);
      break;
    }
    case 'rate-limit': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating rate-limit storms...\n`);
      const results = await chaos.simulateRateLimitStorms();
      printScenarioResults('Rate Limit Simulation', results);
      break;
    }
    case 'partial': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating partial failures...\n`);
      const results = await chaos.simulatePartialFailures();
      printScenarioResults('Partial Failure Simulation', results);
      break;
    }
    case 'degraded': {
      console.log(`  ${colorText('⟳', 'warning')} Simulating degraded responses...\n`);
      const results = await chaos.simulateDegradedResponses();
      printScenarioResults('Degraded Response Simulation', results);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Starting full chaos test suite...', 'primary')}\n`);

      const scenarios = [
        { name: 'Provider Outages', fn: () => chaos.simulateOutage() },
        { name: 'Invalid Auth', fn: () => chaos.simulateInvalidAuth() },
        { name: 'Slow Streaming', fn: () => chaos.simulateSlowStreaming() },
        { name: 'Rate Limit Storms', fn: () => chaos.simulateRateLimitStorms() },
        { name: 'Partial Failures', fn: () => chaos.simulatePartialFailures() },
        { name: 'Degraded Responses', fn: () => chaos.simulateDegradedResponses() },
      ];

      let totalPassed = 0;
      let totalFailed = 0;

      for (const scenario of scenarios) {
        console.log(`  ${colorText('⟳', 'primary')} Running ${scenario.name}...`);
        const results = await scenario.fn();
        const passed = results.filter(r => r.passed).length;
        const failed = results.filter(r => !r.passed).length;
        totalPassed += passed;
        totalFailed += failed;
        console.log(`  ${colorText('✓', 'success')} ${scenario.name}: ${passed} passed, ${failed} failed\n`);
      }

      console.log(divider());
      console.log(`  ${colorText('Summary', 'bold')}`);
      console.log(`  Total scenarios passed: ${colorText(totalPassed.toString(), 'success')}`);
      console.log(`  Total scenarios failed: ${colorText(totalFailed.toString(), 'error')}`);
      break;
    }
  }
}

function printScenarioResults(label: string, results: Array<{ name: string; passed: boolean; error?: string }>): void {
  const passed = results.filter(r => r.passed);
  const failed = results.filter(r => !r.passed);

  console.log(`  ${colorText(label, 'bold')}`);
  console.log(`  Passed: ${colorText(passed.length.toString(), 'success')}  Failed: ${colorText(failed.length.toString(), 'error')}`);

  for (const result of results) {
    const icon = result.passed ? colorText('✓', 'success') : colorText('✗', 'error');
    console.log(`    ${icon} ${result.name}`);
    if (result.error) {
      console.log(`       ${colorText(result.error, 'dim')}`);
    }
  }
}

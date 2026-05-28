/**
 * CLI command: autic profiling
 * Runtime profiling — CPU, memory, queue latency, provider latency,
 * orchestration profiling, and performance baselines
 */

import { RuntimeProfiler } from '@autic/profiling';
import { PerformanceBaseline } from '@autic/profiling';
import { colorText, heading, divider } from '@autic/ui';

export async function profilingCommand(action?: string): Promise<void> {
  const profiler = new RuntimeProfiler();

  console.log(heading('Runtime Profiling'));
  console.log(divider());

  switch (action) {
    case 'cpu': {
      console.log(`  ${colorText('Profiling CPU usage...', 'primary')}`);
      const report = await profiler.profileCPU();
      printProfileReport('CPU', report);
      break;
    }
    case 'memory':
    case 'mem': {
      console.log(`  ${colorText('Profiling memory usage...', 'primary')}`);
      const report = await profiler.profileMemory();
      printProfileReport('Memory', report);
      break;
    }
    case 'queue':
    case 'latency': {
      console.log(`  ${colorText('Profiling queue latency...', 'primary')}`);
      const report = await profiler.profileQueueLatency();
      printProfileReport('Queue Latency', report);
      break;
    }
    case 'provider': {
      console.log(`  ${colorText('Tracking provider latency...', 'primary')}`);
      const report = await profiler.profileProviderLatency();
      printProfileReport('Provider Latency', report);
      break;
    }
    case 'orchestration':
    case 'orch': {
      console.log(`  ${colorText('Profiling orchestration performance...', 'primary')}`);
      const report = await profiler.profileOrchestration();
      printProfileReport('Orchestration', report);
      break;
    }
    case 'baseline': {
      console.log(`  ${colorText('Establishing performance baselines...', 'primary')}`);
      const baseline = new PerformanceBaseline();
      const report = await baseline.establishBaselines();
      printBaselines(report);
      break;
    }
    case 'compare': {
      console.log(`  ${colorText('Comparing against performance baselines...', 'primary')}`);
      const baseline = new PerformanceBaseline();
      const comparison = await baseline.compareAgainstBaselines();
      printComparison(comparison);
      break;
    }
    case 'all':
    default: {
      console.log(`  ${colorText('Running full profiling suite...', 'primary')}\n`);

      const profiles = [
        { name: 'CPU', fn: () => profiler.profileCPU() },
        { name: 'Memory', fn: () => profiler.profileMemory() },
        { name: 'Queue Latency', fn: () => profiler.profileQueueLatency() },
        { name: 'Provider Latency', fn: () => profiler.profileProviderLatency() },
        { name: 'Orchestration', fn: () => profiler.profileOrchestration() },
      ];

      for (const p of profiles) {
        console.log(`  ${colorText('⟳', 'primary')} Profiling ${p.name}...`);
        const report = await p.fn();
        printProfileReport(p.name, report);
        console.log('');
      }

      // Baselines
      console.log(`  ${colorText('⟳', 'primary')} Establishing baselines...`);
      const baseline = new PerformanceBaseline();
      const baselineReport = await baseline.establishBaselines();
      printBaselines(baselineReport);

      console.log(divider());
      console.log(`  ${colorText('Profiling complete', 'bold')}`);
      console.log(`  ${colorText('Run "autic profiling baseline" to view full baseline report', 'dim')}`);
      break;
    }
  }
}

function printProfileReport(label: string, report: { metrics: Record<string, number>; bottlenecks: string[]; recommendations: string[] }): void {
  console.log(`  ${colorText(label + ' Profile', 'bold')}`);
  for (const [key, value] of Object.entries(report.metrics)) {
    console.log(`    ${key}: ${value}`);
  }
  if (report.bottlenecks.length > 0) {
    console.log(`    ${colorText('Bottlenecks:', 'warning')}`);
    for (const b of report.bottlenecks) {
      console.log(`      ${colorText('⚠', 'warning')} ${b}`);
    }
  }
  if (report.recommendations.length > 0) {
    console.log(`    ${colorText('Recommendations:', 'primary')}`);
    for (const r of report.recommendations) {
      console.log(`      ${colorText('→', 'primary')} ${r}`);
    }
  }
}

function printBaselines(report: { baselines: Record<string, number>; status: string }): void {
  console.log(`\n  ${colorText('Performance Baselines', 'bold')}`);
  console.log(`  Status: ${report.status === 'established' ? colorText('✓ Established', 'success') : colorText('Pending', 'warning')}`);
  for (const [key, value] of Object.entries(report.baselines)) {
    console.log(`    ${key}: ${value}`);
  }
}

function printComparison(comparison: { differences: Record<string, string>; regressions: string[]; improvements: string[] }): void {
  console.log(`\n  ${colorText('Baseline Comparison', 'bold')}`);
  for (const [key, value] of Object.entries(comparison.differences)) {
    console.log(`    ${key}: ${value}`);
  }
  if (comparison.regressions.length > 0) {
    console.log(`  ${colorText('Regressions:', 'error')}`);
    for (const r of comparison.regressions) {
      console.log(`    ${colorText('✗', 'error')} ${r}`);
    }
  }
  if (comparison.improvements.length > 0) {
    console.log(`  ${colorText('Improvements:', 'success')}`);
    for (const i of comparison.improvements) {
      console.log(`    ${colorText('✓', 'success')} ${i}`);
    }
  }
}

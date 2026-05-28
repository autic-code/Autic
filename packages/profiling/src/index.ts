/**
 * @autic/profiling — Runtime profiling and performance baselines.
 *
 * Production performance analysis:
 * - Runtime Profiling: CPU, memory, queue latency, provider latency, orchestration
 * - Performance Baseline: startup speed, throughput, provider latency, retrieval time
 *
 * Goal: Detect production bottlenecks and prevent regressions.
 */

// #7 — Runtime Profiling System
export { RuntimeProfiler } from './RuntimeProfiler.js';
export type {
  ProfileSnapshot,
  ProfileReport,
  ProfilingConfig,
} from './RuntimeProfiler.js';

// #14 — Performance Baseline System
export { PerformanceBaseline } from './PerformanceBaseline.js';
export type {
  BaselineMetric,
  BaselineReport,
  BaselineComparison,
} from './PerformanceBaseline.js';

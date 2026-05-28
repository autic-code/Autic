/**
 * @autic/telemetry — Safe optional telemetry foundation.
 *
 * Privacy-safe, local-first telemetry system:
 * - Anonymized runtime metrics (aggregate only, no PII)
 * - Crash categories (error type, count — no stack traces with code)
 * - Provider reliability metrics (success rate, latency — no API keys)
 * - Workflow performance statistics (duration, step count — no repository info)
 *
 * NEVER collects: secrets, repositories, source code, prompts, or credentials.
 * All telemetry is opt-in and clearly documented.
 */

export { TelemetryCollector } from './TelemetryCollector.js';
export type {
  TelemetryConfig,
  TelemetryDataPoint,
  TelemetryReport,
  CrashCategory,
  ProviderMetric,
  WorkflowStat,
} from './TelemetryCollector.js';

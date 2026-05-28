/**
 * @autic/diagnostics — Diagnostics, observability, and documentation generation
 */

export { Doctor } from './Doctor.js';
export { InstallationValidator } from './InstallationValidator.js';
export { PerformanceValidator } from './PerformanceValidator.js';
export { PlatformValidator } from './PlatformValidator.js';
export { PrivacyValidator } from './PrivacyValidation.js';
export { ReleaseValidator } from './ReleaseValidator.js';
export { CrashDiagnostics } from './CrashDiagnostics.js';

// Phase 15 additions
export { DocumentationGenerator } from './DocumentationGenerator.js';
export { ObservabilityEnhancer } from './ObservabilityEnhancer.js';
export { SecurityValidator } from './SecurityValidator.js';

export type { DocSection, DocPage, CommandDoc, DocGenOptions } from './DocumentationGenerator.js';

export type {
  ObservableMetric,
  ObservableEvent,
  OrchestrationSnapshot,
  QueueSnapshot,
  ProviderSnapshot,
  ContextSnapshot,
  LearningSnapshot,
  RuntimeHealthIndicators,
} from './ObservabilityEnhancer.js';

export type {
  SecurityValidationResult,
  SecurityValidationReport,
  SecurityValidationCategory,
} from './SecurityValidator.js';

/**
 * @autic/validation — Production operational validation suite.
 *
 * Real-world workflow validation, provider chaos testing, long-run
 * autonomous testing, regression prevention, advanced recovery
 * validation, and final platform certification.
 */

// #1 — Real-World Workflow Validation
export { WorkflowValidator } from './WorkflowValidator.js';
export type {
  WorkflowValidationConfig,
  ProjectValidationResult,
  WorkflowValidationReport,
} from './WorkflowValidator.js';

// #2 — Provider Chaos Testing
export { ChaosSimulator } from './ChaosSimulator.js';
export type {
  ChaosSimulatorConfig,
  ChaosScenario,
  ChaosTestResult,
} from './ChaosSimulator.js';

// #3 — Long-Run Autonomous Testing
export { LongRunTester } from './LongRunTester.js';
export type {
  LongRunTestConfig,
  LongRunPhase,
  LongRunTestResult,
} from './LongRunTester.js';

// #5 — Regression Prevention System
export { RegressionPreventer } from './RegressionPreventer.js';
export type {
  RegressionTestSuite,
  RegressionTestResult,
  RegressionReport,
} from './RegressionPreventer.js';

// #8 — Advanced Recovery Validation
export { RecoveryValidator } from './RecoveryValidator.js';
export type {
  RecoveryValidationConfig,
  RecoveryScenarioResult,
  RecoveryValidationReport,
} from './RecoveryValidator.js';

// #15 — Final Platform Certification
export { PlatformCertifier } from './PlatformCertifier.js';
export type {
  CertificationCategory,
  CertificationCheck,
  CertificationReport,
} from './PlatformCertifier.js';

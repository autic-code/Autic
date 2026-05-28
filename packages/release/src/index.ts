/**
 * @autic/release — Release Channel System + Release Operations
 *
 * Release channel management with stable, beta, and dev channels.
 * Release operations: verification pipelines, rollback validation,
 * package integrity, and dependency auditing.
 */

export { ReleaseChannelManager } from './ReleaseChannels.js';
export { ReleaseOperationsManager } from './ReleaseOperations.js';

export type {
  ReleaseChannel,
  ReleaseVersion,
  ReleaseChannelConfig,
  UpdateCheckResult,
  UpdateCandidate,
} from './ReleaseChannels.js';

export type {
  VerificationResult,
  VerificationCheck,
  RollbackValidation,
  PackageIntegrityReport,
  DependencyAuditReport,
  DependencyDetail,
} from './ReleaseOperations.js';

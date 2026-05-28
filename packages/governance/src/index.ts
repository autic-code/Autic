/**
 * @autic/governance — Extension governance, security audit, and ecosystem maintenance.
 *
 * Real ecosystem governance foundations:
 * - Extension Governance: trust metadata, permission auditing, compatibility scoring
 * - Security Audit Framework: runtime permission bypass detection, vault integrity
 * - Ecosystem Maintenance Tooling: extension diagnostics, compatibility inspectors
 */

// #4 — Extension Governance System
export { ExtensionGovernor } from './ExtensionGovernor.js';
export type {
  ExtensionTrustProfile,
  PermissionAuditEntry,
  CompatibilityScore,
  GovernanceReport,
} from './ExtensionGovernor.js';

// #9 — Security Audit Framework
export { SecurityAuditor } from './SecurityAuditor.js';
export type { AuditScope, AuditFinding, AuditReport } from './SecurityAuditor.js';

// #10 — Ecosystem Maintenance Tooling
export { EcosystemMaintenance } from './EcosystemMaintenance.js';
export type {
  ExtensionDiagnostic,
  CompatibilityInspectorReport,
  PluginLifecycleInfo,
  MaintenanceReport,
} from './EcosystemMaintenance.js';

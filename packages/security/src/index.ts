/**
 * @autic/security - Security infrastructure: encrypted vault, sanitizer, permissions,
 * risk classifier, security events, trust profiles, auto-mode, execution safety,
 * provider security, privacy mode, secure context, and security validation.
 */

export { Vault, getVault } from './vault.js';
export { Sanitizer, createDefaultSanitizer } from './sanitizer.js';
export type { SanitizeOptions } from './sanitizer.js';
export { PermissionManager, createDefaultPermissions } from './permissions.js';
export type { PermissionRule, PermissionCheck, PermissionLevel, ApprovalHandler } from './permissions.js';
export { RiskClassifier } from './risk.js';
export type { RiskAssessmentConfig } from './risk.js';

export { SecurityEventSystem } from './security-events.js';
export type { SecurityEventSystemOptions } from './security-events.js';

export { TrustProfileSystem } from './trust-profile.js';
export { AutoModeManager } from './auto-mode.js';
export type { AutoMode, AutoModeConfig } from './auto-mode.js';

export { ExecutionSafetySystem } from './execution-safety.js';
export type { ExecutionSafetyOptions } from './execution-safety.js';

export { ProviderSecurityLayer } from './provider-security.js';
export type { ProviderSecurityOptions, SanitizedPrompt, ProviderSafetyCheck } from './provider-security.js';

export { PrivacyManager } from './privacy.js';
export type { PrivacyMode } from './privacy.js';

export { SecureContextGenerator } from './secure-context.js';
export type { ContextFile, SecureContext } from './secure-context.js';

export { SecurityValidator } from './security-validator.js';
export type { ValidationOptions } from './security-validator.js';

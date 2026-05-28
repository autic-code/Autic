/**
 * @autic/config — Centralized configuration system for Autic.
 *
 * Modules:
 * - ConfigManager: Layered config resolution (default → global → workspace → env → CLI)
 * - RuntimeConfig: Typed access to resolved runtime configuration
 * - ProfileManager: Developer profile presets (SAFE, BALANCED, FULL_AUTO, LOCAL_ONLY)
 * - UpdateChecker: Lightweight update system foundation
 */

export { ConfigManager } from './ConfigManager.js';
export { RuntimeConfig } from './RuntimeConfig.js';
export { ProfileManager } from './ProfileManager.js';
export { UpdateChecker } from './UpdateChecker.js';

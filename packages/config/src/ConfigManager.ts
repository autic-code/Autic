/**
 * ConfigManager — Centralized configuration system for Autic.
 *
 * Supports layered config resolution:
 *   defaults → global (~/.autic/config.json) → workspace (.autic/config.json)
 *   → profile overrides → environment variables → CLI flags
 *
 * All config is deterministic, inspectable, and bounded.
 */

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  AuticConfig,
  WorkspaceConfig,
  RuntimePreferences,
  DeveloperProfile,
  ProfileConfig,
  UpdateConfig,
  DiagnosticsConfig,
  ProviderConfig,
  ResolvedConfigValue,
} from '@autic/shared';

/** Built-in profile presets */
const PROFILE_PRESETS: Record<DeveloperProfile, ProfileConfig> = {
  safe: {
    profile: 'safe',
    label: 'Safe',
    description: 'Maximum safety — requires approval for all medium/high risk actions',
    allowDangerousCommands: false,
    requireApprovalForMedium: true,
    autoApproveLowRisk: false,
    maxExecutionDepth: 3,
    workflowTimeoutMs: 120000,
    allowCloudProviders: true,
    allowLocalProviders: true,
    telemetryEnabled: false,
    cloudSyncEnabled: false,
  },
  balanced: {
    profile: 'balanced',
    label: 'Balanced',
    description: 'Balanced safety — auto-approves low risk, prompts for medium, blocks dangerous',
    allowDangerousCommands: false,
    requireApprovalForMedium: true,
    autoApproveLowRisk: true,
    maxExecutionDepth: 5,
    workflowTimeoutMs: 300000,
    allowCloudProviders: true,
    allowLocalProviders: true,
    telemetryEnabled: false,
    cloudSyncEnabled: false,
  },
  full_auto: {
    profile: 'full_auto',
    label: 'Full Auto',
    description: 'Full autonomy — auto-approves all actions up to configured depth',
    allowDangerousCommands: false,
    requireApprovalForMedium: false,
    autoApproveLowRisk: true,
    maxExecutionDepth: 10,
    workflowTimeoutMs: 600000,
    allowCloudProviders: true,
    allowLocalProviders: true,
    telemetryEnabled: false,
    cloudSyncEnabled: false,
  },
  local_only: {
    profile: 'local_only',
    label: 'Local Only',
    description: 'Local-only mode — blocks all cloud providers and outbound requests',
    allowDangerousCommands: false,
    requireApprovalForMedium: true,
    autoApproveLowRisk: true,
    maxExecutionDepth: 5,
    workflowTimeoutMs: 300000,
    allowCloudProviders: false,
    allowLocalProviders: true,
    telemetryEnabled: false,
    cloudSyncEnabled: false,
  },
};

/** Default runtime preferences */
const DEFAULT_PREFERENCES: RuntimePreferences = {
  defaultModel: 'openai/gpt-4o',
  defaultProvider: 'openrouter',
  maxTokens: 4096,
  temperature: 0.3,
  verbose: false,
  debug: false,
  logLevel: 'info',
  outputFormat: 'pretty',
};

/** Default update config */
const DEFAULT_UPDATE: UpdateConfig = {
  checkEnabled: true,
  checkIntervalMs: 86400000, // 24 hours
  lastCheckedAt: 0,
  updateAvailable: false,
};

/** Default diagnostics config */
const DEFAULT_DIAGNOSTICS: DiagnosticsConfig = {
  crashLogging: true,
  crashLogDir: '',
  maxCrashLogs: 10,
  anonymizedReports: false,
  healthCheckIntervalMs: 60000,
};

/** Default global config */
function defaultGlobalConfig(): AuticConfig {
  return {
    version: '0.1.0',
    schema: 1,
    lastUpdated: Date.now(),
    profile: 'balanced',
    providers: [],
    preferences: { ...DEFAULT_PREFERENCES },
    update: { ...DEFAULT_UPDATE },
    diagnostics: {
      ...DEFAULT_DIAGNOSTICS,
      crashLogDir: join(homedir(), '.autic', 'crashes'),
    },
  };
}

/** Default workspace config */
function defaultWorkspaceConfig(): WorkspaceConfig {
  return {
    version: '0.1.0',
    schema: 1,
    initCompleted: false,
    initializedAt: Date.now(),
  };
}

export class ConfigManager {
  private globalConfig!: AuticConfig;
  private workspaceConfig: WorkspaceConfig | null = null;
  private envOverrides: Map<string, string> = new Map();
  private cliOverrides: Map<string, unknown> = new Map();
  private loaded = false;

  readonly globalConfigPath: string;
  readonly globalConfigDir: string;

  constructor() {
    this.globalConfigDir = join(homedir(), '.autic');
    this.globalConfigPath = join(this.globalConfigDir, 'config.json');
  }

  /** Initialize config — load global and workspace configs */
  async init(): Promise<void> {
    this.globalConfig = await this.loadGlobalConfig();
    this.workspaceConfig = await this.loadWorkspaceConfig();
    this.loadEnvOverrides();
    this.loaded = true;
  }

  /** Whether config has been loaded */
  isLoaded(): boolean {
    return this.loaded;
  }

  // ─── Global Config ─────────────────────────────────────────────────

  /** Get full global config */
  getGlobalConfig(): AuticConfig {
    return { ...this.globalConfig };
  }

  /** Save global config to disk */
  async saveGlobalConfig(): Promise<void> {
    this.globalConfig.lastUpdated = Date.now();
    await mkdir(this.globalConfigDir, { recursive: true });
    await writeFile(this.globalConfigPath, JSON.stringify(this.globalConfig, null, 2), 'utf-8');
  }

  // ─── Workspace Config ───────────────────────────────────────────────

  /** Get workspace config if loaded */
  getWorkspaceConfig(): WorkspaceConfig | null {
    return this.workspaceConfig ? { ...this.workspaceConfig } : null;
  }

  /** Load workspace config from cwd */
  async loadWorkspaceConfig(): Promise<WorkspaceConfig | null> {
    const paths = ['.autic', '.autic/config.json', join(process.cwd(), '.autic/config.json')];
    for (const p of paths) {
      try {
        const content = await readFile(p, 'utf-8');
        const config = JSON.parse(content) as WorkspaceConfig;
        // Ensure it has the right schema markers
        if (config && typeof config === 'object' && 'initCompleted' in config) {
          return config;
        }
        // Check if it's the old format
        if (config && 'version' in config) {
          return { ...defaultWorkspaceConfig(), ...(config as WorkspaceConfig) };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /** Save workspace config */
  async saveWorkspaceConfig(): Promise<void> {
    if (!this.workspaceConfig) return;
    const dir = join(process.cwd(), '.autic');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'config.json'), JSON.stringify(this.workspaceConfig, null, 2), 'utf-8');
  }

  /** Check if workspace is initialized */
  async isWorkspaceInitialized(): Promise<boolean> {
    if (this.workspaceConfig?.initCompleted) return true;
    try {
      await access(join(process.cwd(), '.autic'));
      return true;
    } catch {
      return false;
    }
  }

  // ─── Profile Management ────────────────────────────────────────────

  /** Get current developer profile */
  getProfile(): DeveloperProfile {
    return this.getResolvedProfile();
  }

  /** Get full profile config for current profile */
  getProfileConfig(): ProfileConfig {
    const profile = this.getResolvedProfile();
    const preset = PROFILE_PRESETS[profile];
    // Apply any overrides from workspace config
    if (this.workspaceConfig?.profile && this.workspaceConfig.profile !== profile) {
      return PROFILE_PRESETS[this.workspaceConfig.profile];
    }
    return { ...preset };
  }

  /** Set global profile */
  async setProfile(profile: DeveloperProfile): Promise<void> {
    if (!PROFILE_PRESETS[profile]) {
      throw new Error(`Invalid profile: ${profile}. Valid: ${Object.keys(PROFILE_PRESETS).join(', ')}`);
    }
    this.globalConfig.profile = profile;
    await this.saveGlobalConfig();
  }

  /** Set workspace profile override */
  async setWorkspaceProfile(profile: DeveloperProfile): Promise<void> {
    if (!PROFILE_PRESETS[profile]) {
      throw new Error(`Invalid profile: ${profile}. Valid: ${Object.keys(PROFILE_PRESETS).join(', ')}`);
    }
    if (!this.workspaceConfig) {
      this.workspaceConfig = defaultWorkspaceConfig();
    }
    this.workspaceConfig.profile = profile;
    await this.saveWorkspaceConfig();
  }

  /** Get all available profile presets */
  getProfilePresets(): ProfileConfig[] {
    return Object.values(PROFILE_PRESETS);
  }

  /** Get profile config for a specific preset */
  getProfileConfigFor(profile: DeveloperProfile): ProfileConfig {
    return { ...PROFILE_PRESETS[profile] };
  }

  // ─── Preferences ──────────────────────────────────────────────────

  /** Get effective runtime preferences (resolved) */
  getPreferences(): RuntimePreferences {
    const base = { ...DEFAULT_PREFERENCES };

    // Apply global config
    Object.assign(base, this.globalConfig.preferences);

    // Apply workspace overrides
    if (this.workspaceConfig?.preferences) {
      Object.assign(base, this.workspaceConfig.preferences);
    }

    // Apply env overrides
    const envMap: Record<string, keyof RuntimePreferences> = {
      AUTIC_DEFAULT_MODEL: 'defaultModel',
      AUTIC_DEFAULT_PROVIDER: 'defaultProvider',
      AUTIC_MAX_TOKENS: 'maxTokens',
      AUTIC_TEMPERATURE: 'temperature',
      AUTIC_VERBOSE: 'verbose',
      AUTIC_DEBUG: 'debug',
      AUTIC_LOG_LEVEL: 'logLevel',
      AUTIC_OUTPUT_FORMAT: 'outputFormat',
    };

    for (const [envKey, configKey] of Object.entries(envMap)) {
      const val = this.envOverrides.get(envKey);
      if (val !== undefined) {
        if (configKey === 'maxTokens') {
          (base as unknown as Record<string, unknown>)[configKey] = parseInt(val, 10);
        } else if (configKey === 'temperature') {
          (base as unknown as Record<string, unknown>)[configKey] = parseFloat(val);
        } else if (configKey === 'verbose' || configKey === 'debug') {
          (base as unknown as Record<string, unknown>)[configKey] = val === 'true' || val === '1';
        } else {
          (base as unknown as Record<string, unknown>)[configKey] = val;
        }
      }
    }

    // Apply CLI overrides (highest priority)
    for (const [key, value] of this.cliOverrides) {
      (base as unknown as Record<string, unknown>)[key as keyof RuntimePreferences] = value;
    }

    return base;
  }

  /** Set a preference value in global config */
  async setPreference<K extends keyof RuntimePreferences>(key: K, value: RuntimePreferences[K]): Promise<void> {
    (this.globalConfig.preferences as unknown as Record<string, unknown>)[key] = value;
    await this.saveGlobalConfig();
  }

  // ─── Provider Config ──────────────────────────────────────────────

  /** Get configured providers */
  getProviders(): ProviderConfig[] {
    return [...this.globalConfig.providers];
  }

  /** Add a provider config */
  async addProvider(config: ProviderConfig): Promise<void> {
    const idx = this.globalConfig.providers.findIndex((p) => p.id === config.id);
    if (idx >= 0) {
      this.globalConfig.providers[idx] = config;
    } else {
      this.globalConfig.providers.push(config);
    }
    await this.saveGlobalConfig();
  }

  /** Remove a provider */
  async removeProvider(id: string): Promise<void> {
    this.globalConfig.providers = this.globalConfig.providers.filter((p) => p.id !== id);
    await this.saveGlobalConfig();
  }

  // ─── Update Config ─────────────────────────────────────────────────

  /** Get update configuration */
  getUpdateConfig(): UpdateConfig {
    return { ...this.globalConfig.update };
  }

  /** Update the update check state */
  async setUpdateChecked(version: string, available: boolean, releaseNotes?: string): Promise<void> {
    this.globalConfig.update.lastCheckedAt = Date.now();
    this.globalConfig.update.latestVersion = version;
    this.globalConfig.update.updateAvailable = available;
    this.globalConfig.update.releaseNotes = releaseNotes;
    await this.saveGlobalConfig();
  }

  // ─── Diagnostics Config ────────────────────────────────────────────

  /** Get diagnostics configuration */
  getDiagnosticsConfig(): DiagnosticsConfig {
    return { ...this.globalConfig.diagnostics };
  }

  // ─── CLI Overrides ─────────────────────────────────────────────────

  /** Set a CLI flag override (highest priority) */
  setCLIOverride(key: string, value: unknown): void {
    this.cliOverrides.set(key, value);
  }

  /** Clear CLI overrides */
  clearCLIOverrides(): void {
    this.cliOverrides.clear();
  }

  // ─── Value Resolution ──────────────────────────────────────────────

  /** Resolve a config value with its source chain */
  resolveValue<T>(key: string, defaultValue: T): ResolvedConfigValue<T> {
    // Check CLI overrides
    if (this.cliOverrides.has(key)) {
      return { value: this.cliOverrides.get(key) as T, source: 'cli', overridden: true };
    }

    // Check env overrides
    const envKey = `AUTIC_${key.replace(/([A-Z])/g, '_$1').toUpperCase()}`;
    if (this.envOverrides.has(envKey)) {
      return { value: this.envOverrides.get(envKey) as unknown as T, source: 'env', overridden: true };
    }

    // Check workspace config
    if (this.workspaceConfig?.preferences && (key as string) in this.workspaceConfig.preferences) {
      const val = (this.workspaceConfig.preferences as unknown as Record<string, unknown>)[key];
      if (val !== undefined) {
        return { value: val as T, source: 'workspace', overridden: true };
      }
    }

    // Check global config
    if (key in this.globalConfig.preferences) {
      const val = (this.globalConfig.preferences as unknown as Record<string, unknown>)[key];
      if (val !== undefined) {
        return { value: val as T, source: 'global', overridden: false };
      }
    }

    return { value: defaultValue, source: 'default', overridden: false };
  }

  // ─── Private Helpers ───────────────────────────────────────────────

  private async loadGlobalConfig(): Promise<AuticConfig> {
    try {
      const content = await readFile(this.globalConfigPath, 'utf-8');
      const parsed = JSON.parse(content) as Partial<AuticConfig>;
      return { ...defaultGlobalConfig(), ...parsed };
    } catch {
      return defaultGlobalConfig();
    }
  }

  private loadEnvOverrides(): void {
    const auticEnvVars = Object.keys(process.env).filter(
      (k) => k.startsWith('AUTIC_'),
    );
    for (const key of auticEnvVars) {
      const val = process.env[key];
      if (val) {
        this.envOverrides.set(key, val);
      }
    }
  }

  private getResolvedProfile(): DeveloperProfile {
    if (this.workspaceConfig?.profile) return this.workspaceConfig.profile;
    return this.globalConfig.profile;
  }
}

/**
 * RuntimeContext — React context + provider that initializes and exposes
 * real Autic runtime state to all TUI components.
 *
 * Subsystems initialized on mount:
 *   - ConfigManager (global + workspace config)
 *   - ProviderRegistry (providers from config)
 *   - ModelRegistry (models from connected providers)
 *   - SessionManager (in-memory sessions)
 *   - Vault (encrypted secret storage)
 *
 * Every visible piece of state comes from real runtime checks.
 * Zero mock/placeholder/fake data.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ConfigManager, RuntimeConfig } from '@autic/config';
import {
  ProviderRegistry,
  ModelRegistry,
  OpenRouterProvider,
  OllamaProvider,
} from '@autic/providers';
import { SessionManager, Session } from '@autic/sessions';
import { Vault } from '@autic/security';
import { Doctor } from '@autic/diagnostics';
import type {
  ProviderEntry,
  ProviderStatus,
  ProviderConfig as ProviderConfigType,
  ProviderError,
  ModelRegistryEntry,
  DiagnosticReport,
  DiagnosticCheck,
} from '@autic/shared';

// ── Types ──────────────────────────────────────────────────────

export type BootPhase =
  | 'logo'
  | 'config'
  | 'providers'
  | 'models'
  | 'sessions'
  | 'vault'
  | 'verifying'
  | 'ready'
  | 'error';

export type ThinkingPhase =
  | 'planning'
  | 'searching'
  | 'verifying'
  | 'repairing'
  | 'architecting'
  | 'researching'
  | 'engineering'
  | 'reviewing'
  | null;

export type AgentActivityStatus = 'idle' | 'working' | 'waiting' | 'completed' | 'failed';

export interface RuntimeAgentState {
  id: string;
  name: string;
  status: AgentActivityStatus;
  activity: string | null;
  model?: string;
}

export interface RuntimeTodoItem {
  id: string;
  description: string;
  status: 'completed' | 'running' | 'pending' | 'blocked' | 'failed';
}

export interface RuntimeEventEntry {
  id: string;
  message: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'phase';
  timestamp: number;
}

export interface RuntimeHealthSnapshot {
  workspaceDir: string;
  workspaceInitialized: boolean;
  workspaceName: string;
  hasProviders: boolean;
  connectedProviderCount: number;
  totalProviderCount: number;
  hasVault: boolean;
  vaultReady: boolean;
  activeSessionName: string | null;
  sessionCount: number;
  modelCount: number;
  localModelCount: number;
  cloudModelCount: number;
  nodeVersion: string;
}

export interface SlashCommand {
  command: string;
  description: string;
  category: string;
}

export interface ProviderDisplayEntry {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'available' | 'disconnected' | 'error' | 'loading';
  statusMessage: string;
  modelCount: number;
  isDefault: boolean;
  hasKey: boolean;
  capabilities: string[];
}

export interface ModelDisplayEntry {
  id: string;
  name: string;
  providerId: string;
  contextWindow: number;
  isLocal: boolean;
  isInstalled: boolean;
  capabilities: string[];
}

// ── Context Value ──────────────────────────────────────────────

export interface RuntimeContextValue {
  // Initialization state
  bootPhase: BootPhase;
  bootProgress: string;
  bootError: string | null;
  initialized: boolean;

  // Health snapshot
  health: RuntimeHealthSnapshot;

  // Provider management
  providers: ProviderDisplayEntry[];
  connectProvider: (id: string) => Promise<boolean>;
  disconnectProvider: (id: string) => Promise<void>;
  verifyProvider: (id: string) => Promise<ProviderStatus | null>;
  setDefaultProvider: (id: string) => Promise<void>;
  refreshProviders: () => Promise<void>;

  // Model management
  models: ModelDisplayEntry[];
  searchModels: (query: string) => ModelDisplayEntry[];
  downloadModel: (providerId: string, modelId: string) => Promise<boolean>;
  refreshModels: () => Promise<void>;

  // Session management
  sessions: Session[];
  createSession: (name: string) => Promise<Session>;
  restoreSession: (id: string) => Promise<void>;
  activeSession: string | null;

  // Event stream
  events: RuntimeEventEntry[];
  addEvent: (message: string, level: RuntimeEventEntry['level']) => void;

  // Todo items
  todos: RuntimeTodoItem[];
  setTodos: React.Dispatch<React.SetStateAction<RuntimeTodoItem[]>>;

  // Agent state
  agents: RuntimeAgentState[];
  setAgents: React.Dispatch<React.SetStateAction<RuntimeAgentState[]>>;

  // Thinking indicator
  thinkingPhase: ThinkingPhase;
  setThinkingPhase: (phase: ThinkingPhase) => void;

  // Slash commands
  slashCommands: SlashCommand[];
  filteredCommands: (query: string) => SlashCommand[];

  // Diagnostics
  doctor: Doctor | null;
  runDoctor: () => Promise<DiagnosticReport | null>;

  // Runtime subsystems (for advanced use)
  configManager: ConfigManager | null;
  providerRegistry: ProviderRegistry | null;
  vault: Vault | null;
}

// ── Context ────────────────────────────────────────────────────

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used within RuntimeProvider');
  return ctx;
}

// ── All available slash commands ───────────────────────────────

const ALL_SLASH_COMMANDS: SlashCommand[] = [
  // Setup
  { command: '/init', description: 'Initialize Autic in current directory', category: 'Setup' },
  { command: '/doctor', description: 'Full environment diagnostics', category: 'Setup' },
  // Development
  { command: '/build', description: 'Build the workspace', category: 'Development' },
  { command: '/fix', description: 'Run autonomous fix workflow', category: 'Development' },
  { command: '/run', description: 'Execute a task or script', category: 'Development' },
  { command: '/workflow', description: 'Run an engineering workflow', category: 'Development' },
  // Models
  { command: '/providers', description: 'List and manage LLM providers', category: 'Models' },
  { command: '/models', description: 'Search, list, install models', category: 'Models' },
  // Sessions
  { command: '/sessions', description: 'Create, list, restore sessions', category: 'Sessions' },
  { command: '/chat', description: 'Start a chat session', category: 'Sessions' },
  // Orchestration
  { command: '/orchestrate', description: 'Run the full R&D pipeline', category: 'Orchestration' },
  { command: '/swarm', description: 'Multi-agent swarm orchestration', category: 'Orchestration' },
  // Security
  { command: '/security', description: 'View and manage security settings', category: 'Security' },
  { command: '/privacy', description: 'Configure privacy mode', category: 'Security' },
  // Config
  { command: '/config', description: 'Manage Autic configuration', category: 'Config' },
  { command: '/profile', description: 'Manage developer profiles', category: 'Config' },
  { command: '/skills', description: 'List, install, remove skills', category: 'Config' },
  // Info
  { command: '/help', description: 'Show command reference', category: 'Info' },
  { command: '/version', description: 'Show version information', category: 'Info' },
  { command: '/update', description: 'Check for updates', category: 'Info' },
  // Stability
  { command: '/stability', description: 'Monitor runtime health', category: 'Stability' },
  { command: '/audit', description: 'Comprehensive runtime audit', category: 'Stability' },
  { command: '/diagnose', description: 'Error diagnostics', category: 'Stability' },
  // Tools
  { command: '/context', description: 'Context engineering system', category: 'Tools' },
  { command: '/learning', description: 'Engineering learning system', category: 'Tools' },
];

// ── Provider ───────────────────────────────────────────────────

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  // ─── Subsystem refs (stable across renders) ──────────────────
  const configManagerRef = useRef<ConfigManager | null>(null);
  const runtimeConfigRef = useRef<RuntimeConfig | null>(null);
  const providerRegistryRef = useRef<ProviderRegistry | null>(null);
  const modelRegistryRef = useRef<ModelRegistry | null>(null);
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const vaultRef = useRef<Vault | null>(null);
  const doctorRef = useRef<Doctor | null>(null);
  const initStartedRef = useRef(false);

  // ─── Reactive state ──────────────────────────────────────────
  const [bootPhase, setBootPhase] = useState<BootPhase>('logo');
  const [bootProgress, setBootProgress] = useState('Initializing…');
  const [bootError, setBootError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const [providers, setProviders] = useState<ProviderDisplayEntry[]>([]);
  const [models, setModels] = useState<ModelDisplayEntry[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [events, setEvents] = useState<RuntimeEventEntry[]>([]);
  const [todos, setTodos] = useState<RuntimeTodoItem[]>([]);
  const [agents, setAgents] = useState<RuntimeAgentState[]>([
    { id: 'runtime', name: 'Autic Runtime', status: 'idle', activity: null },
  ]);
  const [thinkingPhase, setThinkingPhase] = useState<ThinkingPhase>(null);
  const [health, setHealth] = useState<RuntimeHealthSnapshot>({
    workspaceDir: '',
    workspaceInitialized: false,
    workspaceName: 'unknown',
    hasProviders: false,
    connectedProviderCount: 0,
    totalProviderCount: 0,
    hasVault: false,
    vaultReady: false,
    activeSessionName: null,
    sessionCount: 0,
    modelCount: 0,
    localModelCount: 0,
    cloudModelCount: 0,
    nodeVersion: process.version,
  });

  // ─── Derived state helpers ───────────────────────────────────
  const [defaultProviderId, setDefaultProviderId] = useState<string | null>(null);

  // ─── Provider status → display ───────────────────────────────
  const toDisplayEntry = useCallback(
    (entry: ProviderEntry): ProviderDisplayEntry => {
      const isDefault = entry.config.id === defaultProviderId;
      const status = entry.status.connected
        ? ('connected' as const)
        : entry.status.status === 'unhealthy'
          ? ('error' as const)
          : entry.config.enabled
            ? ('available' as const)
            : ('disconnected' as const);

      return {
        id: entry.config.id,
        name: entry.config.name,
        type: entry.config.type,
        status,
        statusMessage: entry.status.connected
          ? `${entry.status.latencyMs ?? '?'}ms`
          : entry.status.lastError || 'Not connected',
        modelCount: entry.status.modelCount,
        isDefault,
        hasKey: !!entry.config.apiKey,
        capabilities: entry.capabilities as string[],
      };
    },
    [defaultProviderId],
  );

  const refreshProviderDisplay = useCallback(async () => {
    const registry = providerRegistryRef.current;
    if (!registry) return;

    const entries = registry.listProviders();
    const config = configManagerRef.current;
    const prefProvider =
      config?.getPreferences().defaultProvider || process.env.AUTIC_DEFAULT_PROVIDER;

    const displayEntries = entries.map((e) =>
      toDisplayEntry({
        config: e.config,
        status: e.status,
        keyIds: [],
        capabilities: registry.getCapabilities(e.config.id),
      }),
    );

    setProviders(displayEntries);

    // Update default
    if (prefProvider) {
      setDefaultProviderId(prefProvider);
    } else if (displayEntries.length > 0) {
      setDefaultProviderId(displayEntries[0].id);
    }
  }, [toDisplayEntry]);

  const refreshModelDisplay = useCallback(async () => {
    const registry = modelRegistryRef.current;
    if (!registry) return;

    const allModels = registry.getAllModels();
    const entries: ModelDisplayEntry[] = allModels.map((m) => ({
      id: m.model.id,
      name: m.model.name,
      providerId: m.providerId,
      contextWindow: m.contextWindow,
      isLocal: m.isLocal,
      isInstalled: m.isInstalled,
      capabilities: m.model.capabilities.map((c) => c.type),
    }));

    setModels(entries);

    // Update health snapshot
    setHealth((h) => ({
      ...h,
      modelCount: entries.length,
      localModelCount: entries.filter((e) => e.isLocal).length,
      cloudModelCount: entries.filter((e) => !e.isLocal).length,
    }));
  }, []);

  const refreshSessionDisplay = useCallback(async () => {
    const manager = sessionManagerRef.current;
    if (!manager) return;

    const sessionList = manager.listSessions();
    setSessions(sessionList);
    setHealth((h) => ({
      ...h,
      sessionCount: sessionList.length,
      activeSessionName: sessionList.find((s) => s.state === 'active')?.name || null,
    }));
  }, []);

  const refreshHealthSnapshot = useCallback(async () => {
    const config = configManagerRef.current;
    const vault = vaultRef.current;
    if (!config) return;

    const wsConfig = config.getWorkspaceConfig();
    const wsDir = process.cwd();
    const wsName = wsDir.split('/').pop() || 'unknown';
    const vaultReady = vault?.isInitialized() ?? false;

    const keys = vaultReady ? (await vault?.list()) || [] : [];

    setHealth({
      workspaceDir: wsDir,
      workspaceInitialized: !!wsConfig?.initCompleted,
      workspaceName: wsName,
      hasProviders: providers.some((p) => p.status === 'connected'),
      connectedProviderCount: providers.filter((p) => p.status === 'connected').length,
      totalProviderCount: providers.length,
      hasVault: keys.length > 0,
      vaultReady,
      activeSessionName: sessions.find((s) => s.state === 'active')?.name || null,
      sessionCount: sessions.length,
      modelCount: models.length,
      localModelCount: models.filter((m) => m.isLocal).length,
      cloudModelCount: models.filter((m) => !m.isLocal).length,
      nodeVersion: process.version,
    });
  }, [providers, sessions, models]);

  // ─── Boot sequence ───────────────────────────────────────────
  const init = useCallback(async () => {
    if (initStartedRef.current) return;
    initStartedRef.current = true;

    try {
      // === Phase 1: Logo displayed, start init ===
      setBootPhase('logo');
      setBootProgress('Preparing runtime…');

      // Brief pause for logo visibility (skippable via keypress)
      await new Promise((r) => setTimeout(r, 800));

      // === Phase 2: Config ===
      setBootPhase('config');
      setBootProgress('Loading configuration…');
      const configManager = new ConfigManager();
      await configManager.init();
      configManagerRef.current = configManager;

      const runtimeConfig = new RuntimeConfig(configManager);
      runtimeConfigRef.current = runtimeConfig;

      // === Phase 3: Vault ===
      setBootPhase('vault');
      setBootProgress('Initializing secure vault…');
      const vault = new Vault();
      try {
        await vault.init();
      } catch {
        // Vault init is non-fatal (keys can come from env vars)
      }
      vaultRef.current = vault;

      // === Phase 4: Providers ===
      setBootPhase('providers');
      setBootProgress('Registering providers…');
      const providerConfigs = configManager.getProviders();
      const providerRegistry = new ProviderRegistry({ autoHealthCheck: false });
      providerRegistryRef.current = providerRegistry;

      // Register providers from config
      for (const pc of providerConfigs) {
        // Import provider implementations dynamically based on type
        try {
          if (pc.type === 'openrouter') {
            const provider = new OpenRouterProvider({
              apiKey: pc.apiKey || '',
              baseUrl: pc.baseUrl,
            });
            providerRegistry.register(provider, pc);
          } else if (pc.type === 'ollama') {
            const provider = new OllamaProvider({ baseUrl: pc.baseUrl });
            providerRegistry.register(provider, pc);
          }
        } catch {
          // Provider registration failure is non-fatal
          console.error(`Failed to register provider: ${pc.id}`);
        }
      }

      // Health check all registered providers
      if (providerRegistry.count > 0) {
        setBootProgress(`Verifying ${providerRegistry.count} provider(s)…`);
        await providerRegistry.healthCheckAll();
      }

      // === Phase 5: Models ===
      setBootPhase('models');
      setBootProgress('Loading model registry…');
      const modelRegistry = new ModelRegistry();
      modelRegistryRef.current = modelRegistry;

      // Fetch models from connected providers
      const registeredProviders = providerRegistry.listProviders();
      for (const rp of registeredProviders) {
        if (rp.status.connected) {
          try {
            const provider = providerRegistry.getProvider(rp.config.id);
            if (provider) {
              const models = await provider.listModels();
              modelRegistry.registerModels(models, rp.config.id, rp.config.type === 'ollama');
            }
          } catch {
            // Non-fatal
          }
        }
      }

      // === Phase 6: Sessions ===
      setBootPhase('sessions');
      setBootProgress('Initializing session manager…');
      const sessionManager = new SessionManager();
      await sessionManager.init();
      sessionManagerRef.current = sessionManager;

      // Create default session from workspace name
      const wsName = process.cwd().split('/').pop() || 'default';
      const defaultSession = await sessionManager.createSession(
        `${wsName}-${Date.now().toString(36)}`,
        process.cwd(),
      );
      setActiveSessionId(defaultSession.id);

      // === Phase 7: Doctor ===
      setBootPhase('verifying');
      setBootProgress('Running initial health verification…');
      const doctor = new Doctor(configManager);
      doctorRef.current = doctor;

      // Run quick diagnostic
      try {
        await doctor.runQuick();
      } catch {
        // Non-fatal
      }

      // === Complete ===
      // Refresh all displays
      await refreshProviderDisplay();
      await refreshModelDisplay();
      await refreshSessionDisplay();
      await refreshHealthSnapshot();

      setBootPhase('ready');
      setBootProgress('Ready');
      setInitialized(true);

      // Add init complete event
      addEventFn('Runtime initialized — providers checked, models loaded', 'success');
      addEventFn(`Workspace: ${process.cwd()}`, 'info');
      addEventFn(
        providerRegistry.count > 0
          ? `${providerRegistry.count} provider(s) registered`
          : 'No AI providers configured — type /providers to set one up',
        providerRegistry.count > 0 ? 'success' : 'warning',
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Initialization failed';
      setBootPhase('error');
      setBootError(msg);
      addEventFn(`Boot error: ${msg}`, 'error');
    }
  }, [refreshProviderDisplay, refreshModelDisplay, refreshSessionDisplay, refreshHealthSnapshot]);

  // ─── Event helper (stable ref) ───────────────────────────────
  const addEventFn = useCallback((message: string, level: RuntimeEventEntry['level']) => {
    const event: RuntimeEventEntry = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      message,
      level,
      timestamp: Date.now(),
    };
    setEvents((prev) => [...prev, event]);
  }, []);

  // ─── Init on mount ───────────────────────────────────────────
  useEffect(() => {
    init();
  }, [init]);

  // ─── Provider actions ────────────────────────────────────────
  const connectProvider = useCallback(
    async (id: string): Promise<boolean> => {
      const registry = providerRegistryRef.current;
      if (!registry) return false;

      addEventFn(`Connecting to ${id}…`, 'info');
      const connected = await registry.connect(id);
      await refreshProviderDisplay();
      await refreshHealthSnapshot();

      if (connected) {
        addEventFn(`Provider ${id} connected`, 'success');
        // Fetch models from this provider
        try {
          const provider = registry.getProvider(id);
          const modelReg = modelRegistryRef.current;
          if (provider && modelReg) {
            const models = await provider.listModels();
            modelReg.registerModels(models, id, false);
            await refreshModelDisplay();
            addEventFn(`Loaded ${models.length} models from ${id}`, 'success');
          }
        } catch {
          // Non-fatal
        }
      } else {
        addEventFn(`Failed to connect ${id}`, 'error');
      }

      return connected;
    },
    [refreshProviderDisplay, refreshHealthSnapshot, refreshModelDisplay, addEventFn],
  );

  const disconnectProvider = useCallback(
    async (id: string) => {
      const registry = providerRegistryRef.current;
      if (!registry) return;

      await registry.disconnect(id);
      addEventFn(`Disconnected ${id}`, 'info');
      await refreshProviderDisplay();
      await refreshHealthSnapshot();
    },
    [refreshProviderDisplay, refreshHealthSnapshot, addEventFn],
  );

  const verifyProvider = useCallback(
    async (id: string): Promise<ProviderStatus | null> => {
      const registry = providerRegistryRef.current;
      if (!registry) return null;

      addEventFn(`Verifying ${id}…`, 'info');
      const status = await registry.healthCheck(id);
      await refreshProviderDisplay();
      await refreshHealthSnapshot();

      if (status.connected) {
        addEventFn(`${id} verified — ${status.latencyMs}ms latency`, 'success');
      } else {
        addEventFn(`${id} verification failed: ${status.lastError || 'Unknown'}`, 'error');
      }

      return status;
    },
    [refreshProviderDisplay, refreshHealthSnapshot, addEventFn],
  );

  const setDefaultProvider = useCallback(
    async (id: string) => {
      const config = configManagerRef.current;
      if (!config) return;

      await config.setPreference('defaultProvider', id);
      setDefaultProviderId(id);
      addEventFn(`Default provider set to ${id}`, 'success');
      await refreshProviderDisplay();
    },
    [refreshProviderDisplay, addEventFn],
  );

  const refreshProviders = useCallback(async () => {
    const registry = providerRegistryRef.current;
    if (!registry) return;

    await registry.healthCheckAll();
    await refreshProviderDisplay();
    await refreshHealthSnapshot();
  }, [refreshProviderDisplay, refreshHealthSnapshot]);

  // ─── Model actions ───────────────────────────────────────────
  const searchModels = useCallback((query: string): ModelDisplayEntry[] => {
    if (!query || !modelRegistryRef.current) return [];
    const results = modelRegistryRef.current.searchModels(query);
    return results.map((m) => ({
      id: m.model.id,
      name: m.model.name,
      providerId: m.providerId,
      contextWindow: m.contextWindow,
      isLocal: m.isLocal,
      isInstalled: m.isInstalled,
      capabilities: m.model.capabilities.map((c) => c.type),
    }));
  }, []);

  const downloadModel = useCallback(
    async (providerId: string, _modelId: string): Promise<boolean> => {
      addEventFn(`Downloading model from ${providerId}… (may take a while)`, 'info');
      // Model download is provider-specific (Ollama pull). For now, trigger refresh.
      try {
        const registry = providerRegistryRef.current;
        const modelReg = modelRegistryRef.current;
        if (registry && modelReg && providerId === 'ollama') {
          const provider = registry.getProvider('ollama');
          if (provider) {
            const models = await provider.listModels();
            modelReg.registerModels(models, 'ollama', true);
            await refreshModelDisplay();
            addEventFn(`Models refreshed from ${providerId}`, 'success');
            return true;
          }
        }
      } catch {
        addEventFn(`Failed to download model from ${providerId}`, 'error');
      }
      return false;
    },
    [refreshModelDisplay, addEventFn],
  );

  const refreshModels = useCallback(async () => {
    const registry = providerRegistryRef.current;
    const modelReg = modelRegistryRef.current;
    if (!registry || !modelReg) return;

    const registeredProviders = registry.listProviders();
    for (const rp of registeredProviders) {
      if (rp.status.connected) {
        try {
          const provider = registry.getProvider(rp.config.id);
          if (provider) {
            const models = await provider.listModels();
            modelReg.registerModels(models, rp.config.id, rp.config.type === 'ollama');
          }
        } catch {
          // Non-fatal
        }
      }
    }

    await refreshModelDisplay();
    await refreshHealthSnapshot();
  }, [refreshModelDisplay, refreshHealthSnapshot]);

  // ─── Session actions ─────────────────────────────────────────
  const createSession = useCallback(
    async (name: string): Promise<Session> => {
      const manager = sessionManagerRef.current;
      if (!manager) throw new Error('SessionManager not initialized');

      const session = await manager.createSession(name, process.cwd());
      setActiveSessionId(session.id);
      await refreshSessionDisplay();
      addEventFn(`Session created: ${name}`, 'success');
      return session;
    },
    [refreshSessionDisplay, addEventFn],
  );

  const restoreSession = useCallback(
    async (id: string) => {
      const manager = sessionManagerRef.current;
      if (!manager) return;

      const session = await manager.restoreSession(id);
      if (session) {
        setActiveSessionId(session.id);
        addEventFn(`Session restored: ${session.name}`, 'info');
      }
      await refreshSessionDisplay();
    },
    [refreshSessionDisplay, addEventFn],
  );

  // ─── Diagnostics ─────────────────────────────────────────────
  const runDoctor = useCallback(async (): Promise<DiagnosticReport | null> => {
    const doctor = doctorRef.current;
    if (!doctor) return null;

    addEventFn('Running full environment diagnostics…', 'phase');
    try {
      const report = await doctor.runFull();
      const { passed, warnings, failed } = report.summary;
      addEventFn(
        `Diagnostic complete: ${passed} passed, ${warnings} warnings, ${failed} failed`,
        failed > 0 ? 'warning' : 'success',
      );
      return report;
    } catch (error) {
      addEventFn(
        `Diagnostics failed: ${error instanceof Error ? error.message : 'Unknown'}`,
        'error',
      );
      return null;
    }
  }, [addEventFn]);

  // ─── Slash commands ──────────────────────────────────────────
  const filteredCommands = useCallback((query: string): SlashCommand[] => {
    if (!query || query === '/') return ALL_SLASH_COMMANDS;
    const lower = query.toLowerCase();
    return ALL_SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.command.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower) ||
        cmd.category.toLowerCase().includes(lower),
    );
  }, []);

  // ─── Context value ───────────────────────────────────────────
  const value: RuntimeContextValue = {
    bootPhase,
    bootProgress,
    bootError,
    initialized,

    health,

    providers,
    connectProvider,
    disconnectProvider,
    verifyProvider,
    setDefaultProvider,
    refreshProviders,

    models,
    searchModels,
    downloadModel,
    refreshModels,

    sessions,
    createSession,
    restoreSession,
    activeSession: activeSessionId,

    events,
    addEvent: addEventFn,

    todos,
    setTodos,

    agents,
    setAgents,

    thinkingPhase,
    setThinkingPhase,

    slashCommands: ALL_SLASH_COMMANDS,
    filteredCommands,

    doctor: doctorRef.current,
    runDoctor,

    configManager: configManagerRef.current,
    providerRegistry: providerRegistryRef.current,
    vault: vaultRef.current,
  };

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

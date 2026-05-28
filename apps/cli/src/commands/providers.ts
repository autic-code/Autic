/**
 * autic providers — List and manage LLM providers.
 *
 * Supports: list, check, add, remove, setup (guided onboarding)
 * Integrates with ProviderRegistry, KeyManager, ModelRegistry, RateLimiter.
 */

import {
  OpenRouterProvider,
  OllamaProvider,
  ProviderRegistry,
  KeyManager,
  ModelRegistry,
  RateLimiter,
  createProviderError,
} from '@autic/providers';
import type { ProviderConfig } from '@autic/shared';

const DEFAULT_CONFIGS: ProviderConfig[] = [
  {
    id: 'openrouter',
    name: 'OpenRouter',
    type: 'openrouter',
    models: [],
    enabled: true,
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    type: 'ollama',
    models: [],
    enabled: true,
    baseUrl: 'http://localhost:11434',
  },
];

let registry: ProviderRegistry | null = null;
let keyManager: KeyManager | null = null;
let modelRegistry: ModelRegistry | null = null;
let rateLimiter: RateLimiter | null = null;

function getRegistry(): ProviderRegistry {
  if (!registry) {
    registry = new ProviderRegistry({ autoHealthCheck: false });
    keyManager = new KeyManager();
    modelRegistry = new ModelRegistry();
    rateLimiter = new RateLimiter();

    for (const config of DEFAULT_CONFIGS) {
      let provider: OpenRouterProvider | OllamaProvider | null = null;

      switch (config.type) {
        case 'openrouter':
          provider = new OpenRouterProvider({
            apiKey: process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY || '',
            baseUrl: config.baseUrl,
          });
          break;
        case 'ollama':
          provider = new OllamaProvider({ baseUrl: config.baseUrl });
          break;
      }

      if (provider) {
        registry.register(provider, config);
      }
    }
  }
  return registry;
}

export async function providersCommand(
  action?: string,
  name?: string,
  options: Record<string, unknown> = {},
): Promise<void> {
  if (!action || action === 'list') {
    await listProviders();
    return;
  }

  if (action === 'check') {
    await checkProviders();
    return;
  }

  if (action === 'add') {
    await addProvider(name, options);
    return;
  }

  if (action === 'remove') {
    await removeProvider(name);
    return;
  }

  if (action === 'setup') {
    await guidedProviderSetup(name);
    return;
  }

  // Help
  console.log('');
  console.log('  Usage: autic providers <action> [name] [options]');
  console.log('');
  console.log('  Actions:');
  console.log('    list           List registered providers (default)');
  console.log('    check          Check provider connectivity');
  console.log('    add <name>     Add a provider (--key, --url)');
  console.log('    remove <name>  Remove a provider');
  console.log('    setup [name]   Guided provider onboarding wizard');
  console.log('');
  console.log('  Supported providers:');
  console.log('    openrouter     Cloud API via OpenRouter');
  console.log('    ollama         Local LLM server');
  console.log('');
  console.log('  Examples:');
  console.log('    autic providers');
  console.log('    autic providers check');
  console.log('    autic providers add openrouter --key sk-or-v1-...');
  console.log('    autic providers add ollama --url http://localhost:11434');
  console.log('    autic providers setup openrouter');
  console.log('    autic providers setup ollama');
  console.log('');
}

// ─── Guided Provider Setup (Subsystem #9) ──────────────────────────

async function guidedProviderSetup(name?: string): Promise<void> {
  console.log('');
  console.log(
    '  \u2554\u2550\u2550\u2550\u2550 Provider Setup Wizard \u2550\u2550\u2550\u2550\u2557',
  );
  console.log('');

  if (!name) {
    console.log('  Choose a provider to set up:');
    console.log('');
    console.log('    1. OpenRouter  - Cloud API (requires API key)');
    console.log('    2. Ollama      - Local server (free, runs on your machine)');
    console.log('');
    console.log('  Usage: autic providers setup <name>');
    console.log('');
    return;
  }

  const validProviders = ['openrouter', 'ollama'];
  if (!validProviders.includes(name)) {
    console.log(`  Unknown provider: "${name}". Supported: ${validProviders.join(', ')}`);
    console.log('');
    return;
  }

  if (name === 'openrouter') {
    await setupOpenRouter();
  } else if (name === 'ollama') {
    await setupOllama();
  }
}

async function setupOpenRouter(): Promise<void> {
  console.log('  \u25A0 Provider: OpenRouter');
  console.log('  \u25A0 Type: Cloud API');
  console.log('  \u25A0 Website: https://openrouter.ai');
  console.log('');

  // Step 1: API Key verification
  console.log('  Step 1: API Key Verification');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  const envKey = process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY;
  if (envKey) {
    console.log('  \u2713 API key found in environment');
    console.log('     (OPENROUTER_API_KEY or AUTIC_OPENROUTER_KEY)');
    console.log('');
  } else {
    console.log('  \u2717 No API key found in environment');
    console.log('     Get a key at: https://openrouter.ai/keys');
    console.log('     Then set it: export OPENROUTER_API_KEY=<your-key>');
    console.log('     Or run: autic providers add openrouter --key <your-key>');
    console.log('');
    return;
  }

  // Step 2: Connection verification
  console.log('  Step 2: Connection Verification');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  const provider = new OpenRouterProvider({ apiKey: envKey });
  try {
    const connected = await provider.connect();
    if (connected) {
      console.log('  \u2713 Connection successful');
    } else {
      console.log('  \u2717 Connection failed — check your API key');
      console.log('     Verify at: https://openrouter.ai/keys');
      console.log('');
      return;
    }
  } catch (error) {
    console.log('  \u2717 Connection error:', error instanceof Error ? error.message : 'Unknown');
    console.log('');
    return;
  }
  console.log('');

  // Step 3: Model discovery
  console.log('  Step 3: Model Discovery');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  try {
    const models = await provider.listModels();
    const totalModels = models.length;

    // Categorize models
    const byContext = {
      large: models.filter((m) => (m.contextLength || 0) >= 128000),
      medium: models.filter((m) => {
        const ctx = m.contextLength || 0;
        return ctx >= 32000 && ctx < 128000;
      }),
      small: models.filter((m) => (m.contextLength || 0) < 32000),
    };

    console.log(`  Found ${totalModels} model(s):`);
    console.log(`    Large context (128K+):  ${byContext.large.length}`);
    console.log(`    Medium context (32K+):  ${byContext.medium.length}`);
    console.log(`    Small context (<32K):   ${byContext.small.length}`);
    console.log('');

    // Key model recommendations
    console.log('  Recommended models:');
    const topModels = models.slice(0, 5);
    for (const m of topModels) {
      console.log(`    \u25CB ${m.id} (${m.contextLength || '?'} ctx)`);
    }
    console.log('');
  } catch {
    console.log('  \u25CB Could not fetch models (API limitation)');
    console.log('');
  }

  // Step 4: Runtime recommendations
  console.log('  Step 4: Runtime Recommendations');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );
  console.log('  \u2713 OpenRouter is configured and ready.');
  console.log('  \u25CB For large repos, consider models with 128K+ context');
  console.log('  \u25CB For quick fixes, smaller models are faster and cheaper');
  console.log('  \u25CB Set AUTIC_DEFAULT_MODEL in config for automatic selection');
  console.log('');

  // Summary
  console.log('  \u2554\u2550\u2550\u2550 Setup Complete \u2550\u2550\u2550\u2557');
  console.log('  \u2502 OpenRouter: Ready');
  console.log('  \u2502 API Key:    Verified');
  console.log('  \u2502 Models:     Discovered');
  console.log(
    '  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
  );
  console.log('');
  console.log('  Next: autic doctor quick');
  console.log('        autic chat');
  console.log('');
}

async function setupOllama(): Promise<void> {
  console.log('  \u25A0 Provider: Ollama');
  console.log('  \u25A0 Type: Local LLM Server');
  console.log('  \u25A0 Website: https://ollama.ai');
  console.log('');

  // Step 1: Check if Ollama is installed
  console.log('  Step 1: Installation Check');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  let ollamaInstalled = false;
  try {
    const { execSync } = await import('node:child_process');
    execSync('ollama --version', { encoding: 'utf-8' });
    ollamaInstalled = true;
    console.log('  \u2713 Ollama is installed');
  } catch {
    console.log('  \u2717 Ollama is not installed');
    console.log('     Install from: https://ollama.ai');
    console.log('     Or: curl -fsSL https://ollama.ai/install.sh | sh');
    console.log('');
  }
  console.log('');

  // Step 2: Connection check
  console.log('  Step 2: Connection Check');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  const provider = new OllamaProvider();
  let connected = false;
  try {
    connected = await provider.connect();
    console.log(
      `  ${connected ? '\u2713' : '\u2717'} Ollama server: ${connected ? 'running' : 'not running'}`,
    );
    if (!connected) {
      console.log('     Start with: ollama serve');
      console.log('');
      if (!ollamaInstalled) return;
    }
  } catch {
    console.log('  \u2717 Could not connect to Ollama');
    console.log('     Ensure Ollama is running: ollama serve');
    console.log('');
    if (!ollamaInstalled) return;
  }
  console.log('');

  if (!connected) return;

  // Step 3: Model discovery
  console.log('  Step 3: Local Model Discovery');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );

  try {
    const models = await provider.listModels();
    if (models.length > 0) {
      console.log(`  Found ${models.length} local model(s):`);
      for (const m of models) {
        console.log(`    \u25CB ${m.id} (${m.contextLength || '?'} ctx)`);
      }
    } else {
      console.log('  No models found. Pull a model:');
      console.log('    ollama pull llama3.2');
      console.log('    ollama pull deepseek-coder');
      console.log('    ollama pull mistral');
    }
    console.log('');
  } catch {
    console.log('  \u25CB Could not list models');
    console.log('');
  }

  // Step 4: Runtime recommendations
  console.log('  Step 4: Runtime Recommendations');
  console.log(
    '  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500',
  );
  console.log('  \u2713 Ollama is configured and ready.');
  console.log('  \u25CB Local models work offline — no API costs');
  console.log('  \u25CB For coding, pull models like deepseek-coder or codellama');
  console.log('  \u25CB For chat, pull models like llama3.2 or mistral');
  console.log('  \u25CB Set AUTIC_DEFAULT_MODEL or use --model in chat');
  console.log('');

  // Summary
  console.log('  \u2554\u2550\u2550\u2550 Setup Complete \u2550\u2550\u2550\u2557');
  console.log('  \u2502 Ollama:     Running');
  console.log('  \u2502 Models:     Scanned');
  console.log('  \u2502 Offline:    Supported');
  console.log(
    '  \u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D',
  );
  console.log('');
  console.log('  Next: autic doctor quick');
  console.log('        autic chat');
  console.log('');
}

// ─── List Providers ──────────────────────────────────────────────

async function listProviders(): Promise<void> {
  const reg = getRegistry();
  console.log('');
  console.log('  Registered providers:');
  console.log('');

  const statuses = await reg.healthCheckAll();

  for (const status of statuses) {
    const icon =
      status.status === 'healthy' ? '\u2713' : status.status === 'unknown' ? '\u25CB' : '\u2717';
    const latencyInfo = status.latencyMs ? ` (${status.latencyMs}ms)` : '';

    console.log(`  ${icon} ${status.providerName}${latencyInfo}`);
    console.log(`     ID: ${status.providerId}`);
    console.log(`     Status: ${status.status}`);
    console.log(`     Models: ${status.modelCount}`);

    if (status.lastError) {
      console.log(`     Last error: ${status.lastError}`);
    }

    if (keyManager) {
      const keyStats = keyManager.getProviderKeyStats(status.providerId);
      if (keyStats.total > 0) {
        console.log(
          `     Keys: ${keyStats.active} active, ${keyStats.inCooldown} cooldown, ${keyStats.verified} verified`,
        );
      } else {
        console.log(`     Keys: none configured`);
      }
    }

    if (rateLimiter) {
      const util = rateLimiter.getUtilization(status.providerId);
      if (util.rpmUtilization > 0 || util.tpmUtilization > 0) {
        console.log(
          `     Rate: ${util.rpmUtilization.toFixed(1)}% RPM, ${util.tpmUtilization.toFixed(1)}% TPM`,
        );
      }
    }

    console.log('');
  }

  console.log(`  Total: ${reg.count} provider(s)`);
  console.log('');
}

// ─── Check Providers ─────────────────────────────────────────────

async function checkProviders(): Promise<void> {
  const reg = getRegistry();
  process.stdout.write('  Checking provider connectivity...\n\n');

  const statuses = await reg.healthCheckAll();

  let healthy = 0;
  let unhealthy = 0;

  for (const status of statuses) {
    const icon = status.status === 'healthy' ? '\u2713' : '\u2717';
    process.stdout.write(`  ${icon} ${status.providerName}... `);

    if (status.status === 'healthy') {
      process.stdout.write(`connected (${status.latencyMs}ms, ${status.modelCount} models)\n`);
      healthy++;
    } else {
      process.stdout.write(`${status.lastError || 'not available'}\n`);
      unhealthy++;
    }
  }

  process.stdout.write(`\n  Summary: ${healthy} healthy, ${unhealthy} unhealthy\n\n`);

  if (modelRegistry) {
    const modelStats = modelRegistry.getStats();
    process.stdout.write(`  Model registry: ${modelStats.totalModels} total models\n`);
    process.stdout.write(
      `    ${modelStats.localModels} local, ${modelStats.cloudModels} cloud\n\n`,
    );

    if (modelStats.totalModels > 0) {
      process.stdout.write('  Capability coverage:\n');
      for (const [cap, count] of Object.entries(modelStats.capabilities)) {
        process.stdout.write(`    ${cap}: ${count} models\n`);
      }
      process.stdout.write('\n');
    }
  }
}

// ─── Add Provider ────────────────────────────────────────────────

async function addProvider(name?: string, options: Record<string, unknown> = {}): Promise<void> {
  if (!name) {
    console.log('  Usage: autic providers add <name> [--key <api-key>] [--url <base-url>]');
    console.log('');
    console.log('  Supported providers:');
    console.log('    openrouter  - OpenRouter cloud API (requires --key)');
    console.log('    ollama      - Local Ollama server (optional --url)');
    console.log('');
    return;
  }

  const apiKey = (options.key as string) || process.env.OPENROUTER_API_KEY || '';
  const baseUrl = (options.url as string) || undefined;

  const reg = getRegistry();

  if (reg.hasProvider(name)) {
    console.log(`  \u2717 Provider "${name}" is already registered.`);
    console.log('');
    return;
  }

  let provider: OpenRouterProvider | OllamaProvider | null = null;
  let config: ProviderConfig;

  switch (name) {
    case 'openrouter': {
      if (!apiKey) {
        console.log('  \u2717 OpenRouter requires an API key. Use --key <your-key>');
        console.log('  Get a key at: https://openrouter.ai/keys');
        console.log('');
        return;
      }
      provider = new OpenRouterProvider({ apiKey, baseUrl });
      config = {
        id: 'openrouter',
        name: 'OpenRouter',
        type: 'openrouter',
        baseUrl,
        apiKey,
        models: [],
        enabled: true,
      };
      break;
    }
    case 'ollama': {
      provider = new OllamaProvider({ baseUrl });
      config = { id: 'ollama', name: 'Ollama', type: 'ollama', baseUrl, models: [], enabled: true };
      break;
    }
    default: {
      console.log(`  \u2717 Unknown provider: "${name}". Supported: openrouter, ollama`);
      console.log('');
      return;
    }
  }

  reg.register(provider, config);

  if (apiKey && keyManager) {
    const keyId = await keyManager.addKey(name, 'default', apiKey, false);
    process.stdout.write(`  Verifying ${name}...\n`);
    try {
      const verified = await provider.verifyKey();
      if (verified) {
        keyManager.markKeyVerified(keyId);
        process.stdout.write(`  \u2713 API key verified\n\n`);
      } else {
        process.stdout.write(`  \u25CB Key verification failed \u2014 check your API key\n\n`);
      }
    } catch (error) {
      const providerError = createProviderError(name, error);
      process.stdout.write(`  \u25CB Key verification: ${providerError.suggestion}\n\n`);
    }
  }

  process.stdout.write(`  Fetching models from ${name}...\n`);
  try {
    const models = await provider.listModels();
    if (modelRegistry) {
      modelRegistry.registerModels(models, name, name === 'ollama');
    }
    process.stdout.write(`  \u2713 ${models.length} model(s) found\n\n`);

    if (models.length > 0) {
      process.stdout.write('  Available models:\n');
      for (const model of models.slice(0, 10)) {
        process.stdout.write(`    \u25CB ${model.id} (${model.contextLength} ctx)\n`);
      }
      if (models.length > 10) {
        process.stdout.write(`    ... and ${models.length - 10} more\n`);
      }
      process.stdout.write('\n');
    }
  } catch (error) {
    const providerError = createProviderError(name, error);
    process.stdout.write(`  \u25CB Could not fetch models: ${providerError.message}\n\n`);
  }

  process.stdout.write(`  Connecting to ${name}...\n`);
  const connected = await reg.connect(name);
  if (connected) {
    process.stdout.write(`  \u2713 ${name} is connected and ready\n\n`);
  } else {
    process.stdout.write(`  \u25CB ${name} is not available right now\n\n`);
  }
}

// ─── Remove Provider ─────────────────────────────────────────────

async function removeProvider(name?: string): Promise<void> {
  if (!name) {
    console.log('  Usage: autic providers remove <name>');
    console.log('');
    return;
  }

  const reg = getRegistry();
  if (!reg.hasProvider(name)) {
    console.log(`  \u2717 Provider "${name}" is not registered.`);
    console.log('');
    return;
  }

  await reg.disconnect(name);
  reg.unregister(name);

  if (modelRegistry) {
    const models = modelRegistry.getProviderModels(name);
    for (const model of models) {
      modelRegistry.unregisterModel(`${name}:${model.model.id}`);
    }
  }

  console.log(`  \u2713 Provider "${name}" removed.`);
  console.log('');
}

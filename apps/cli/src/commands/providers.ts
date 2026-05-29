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
import { colorText, heading, divider } from '@autic/ui';

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
  console.log(`\n  ${heading('Provider Management')}`);
  console.log(`  ${divider(48)}\n`);
  console.log(
    `  ${colorText('Usage:', 'primary')} ${colorText('autic providers <action> [name] [options]', 'dim')}\n`,
  );
  console.log(`  ${colorText('Actions:', 'bold')}`);
  console.log(
    `    ${colorText('list', 'primary').padEnd(22)} ${colorText('List registered providers (default)', 'dim')}`,
  );
  console.log(
    `    ${colorText('check', 'primary').padEnd(22)} ${colorText('Check provider connectivity', 'dim')}`,
  );
  console.log(
    `    ${colorText('add <name>', 'primary').padEnd(22)} ${colorText('Add a provider (--key, --url)', 'dim')}`,
  );
  console.log(
    `    ${colorText('remove <name>', 'primary').padEnd(22)} ${colorText('Remove a provider', 'dim')}`,
  );
  console.log(
    `    ${colorText('setup [name]', 'primary').padEnd(22)} ${colorText('Guided provider onboarding wizard', 'dim')}`,
  );
  console.log('');
  console.log(`  ${colorText('Supported providers:', 'bold')}`);
  console.log(
    `    ${colorText('openrouter', 'primary').padEnd(22)} ${colorText('Cloud API via OpenRouter', 'dim')}`,
  );
  console.log(
    `    ${colorText('ollama', 'primary').padEnd(22)} ${colorText('Local LLM server', 'dim')}`,
  );
  console.log('');
  console.log(`  ${colorText('Examples:', 'bold')}`);
  console.log(`    ${colorText('autic providers', 'primary')}`);
  console.log(`    ${colorText('autic providers check', 'primary')}`);
  console.log(`    ${colorText('autic providers add openrouter --key sk-or-v1-...', 'primary')}`);
  console.log(
    `    ${colorText('autic providers add ollama --url http://localhost:11434', 'primary')}`,
  );
  console.log(`    ${colorText('autic providers setup openrouter', 'primary')}`);
  console.log(`    ${colorText('autic providers setup ollama', 'primary')}`);
  console.log(`  ${divider(48)}\n`);
}

// ─── Guided Provider Setup (Subsystem #9) ──────────────────────────

async function guidedProviderSetup(name?: string): Promise<void> {
  console.log(`\n  ${heading('Provider Setup Wizard')}`);
  console.log(`  ${divider(48)}\n`);

  if (!name) {
    console.log(`  ${colorText('Choose a provider to set up:', 'bold')}\n`);
    console.log(
      `    ${colorText('1.', 'primary')} ${colorText('OpenRouter', 'bold')}  ${colorText('- Cloud API (requires API key)', 'dim')}`,
    );
    console.log(
      `    ${colorText('2.', 'primary')} ${colorText('Ollama', 'bold')}      ${colorText('- Local server (free, runs on your machine)', 'dim')}`,
    );
    console.log('');
    console.log(
      `  ${colorText('Usage:', 'dim')} ${colorText('autic providers setup <name>', 'primary')}`,
    );
    console.log(`  ${divider(48)}\n`);
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
  console.log(`  ${colorText('Provider:', 'dim')}  ${colorText('OpenRouter', 'bold')}`);
  console.log(`  ${colorText('Type:', 'dim')}      ${colorText('Cloud API', 'bold')}`);
  console.log(
    `  ${colorText('Website:', 'dim')}   ${colorText('https://openrouter.ai', 'primary')}`,
  );
  console.log('');

  // Step 1: API Key verification
  console.log(`  ${colorText('Step 1: API Key Verification', 'bold')}`);
  console.log(`  ${divider(36)}`);

  const envKey = process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY;
  if (envKey) {
    console.log(`  ${colorText('✓ API key found in environment', 'success')}`);
    console.log(`     ${colorText('(OPENROUTER_API_KEY or AUTIC_OPENROUTER_KEY)', 'dim')}`);
    console.log('');
  } else {
    console.log(`  ${colorText('✗ No API key found in environment', 'error')}`);
    console.log(`     ${colorText('Get a key at: https://openrouter.ai/keys', 'dim')}`);
    console.log(`     ${colorText('Then set: export OPENROUTER_API_KEY=<your-key>', 'dim')}`);
    console.log(
      `     ${colorText('Or run: autic providers add openrouter --key <your-key>', 'dim')}`,
    );
    console.log('');
    return;
  }

  // Step 2: Connection verification
  console.log(`  ${colorText('Step 2: Connection Verification', 'bold')}`);
  console.log(`  ${divider(36)}`);

  const provider = new OpenRouterProvider({ apiKey: envKey });
  try {
    const connected = await provider.connect();
    if (connected) {
      console.log(`  ${colorText('✓ Connection successful', 'success')}`);
    } else {
      console.log(`  ${colorText('✗ Connection failed — check your API key', 'error')}`);
      console.log(`     ${colorText('Verify at: https://openrouter.ai/keys', 'dim')}`);
      console.log('');
      return;
    }
  } catch (error) {
    console.log(
      `  ${colorText(`✗ Connection error: ${error instanceof Error ? error.message : 'Unknown'}`, 'error')}`,
    );
    console.log('');
    return;
  }
  console.log('');

  // Step 3: Model discovery
  console.log(`  ${colorText('Step 3: Model Discovery', 'bold')}`);
  console.log(`  ${divider(36)}`);

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

    console.log(`  ${colorText(`Found ${totalModels} model(s):`, 'bold')}`);
    console.log(`    ${colorText(`Large context (128K+):  ${byContext.large.length}`, 'dim')}`);
    console.log(`    ${colorText(`Medium context (32K+):  ${byContext.medium.length}`, 'dim')}`);
    console.log(`    ${colorText(`Small context (<32K):   ${byContext.small.length}`, 'dim')}`);
    console.log('');

    // Key model recommendations
    console.log(`  ${colorText('Recommended models:', 'bold')}`);
    const topModels = models.slice(0, 5);
    for (const m of topModels) {
      console.log(`    ${colorText(`○ ${m.id} (${m.contextLength || '?'} ctx)`, 'dim')}`);
    }
    console.log('');
  } catch {
    console.log(`  ${colorText('○ Could not fetch models (API limitation)', 'warning')}`);
    console.log('');
  }

  // Step 4: Runtime recommendations
  console.log(`  ${colorText('Step 4: Runtime Recommendations', 'bold')}`);
  console.log(`  ${divider(36)}`);
  console.log(`  ${colorText('✓ OpenRouter is configured and ready.', 'success')}`);
  console.log(`  ${colorText('○ For large repos, consider models with 128K+ context', 'dim')}`);
  console.log(`  ${colorText('○ For quick fixes, smaller models are faster and cheaper', 'dim')}`);
  console.log(
    `  ${colorText('○ Set AUTIC_DEFAULT_MODEL in config for automatic selection', 'dim')}`,
  );
  console.log('');

  // Summary
  console.log(`  ${divider(36)}`);
  console.log(`  ${colorText('Setup Complete', 'bold')}`);
  console.log(`    ${colorText('OpenRouter:', 'dim')} ${colorText('Ready', 'success')}`);
  console.log(`    ${colorText('API Key:', 'dim')}    ${colorText('Verified', 'success')}`);
  console.log(`    ${colorText('Models:', 'dim')}     ${colorText('Discovered', 'success')}`);
  console.log(`  ${divider(36)}`);
  console.log('');
  console.log(`  ${colorText('Next:', 'bold')}`);
  console.log(`    ${colorText('autic doctor quick', 'primary')}`);
  console.log(`    ${colorText('autic chat', 'primary')}`);
  console.log('');
}

async function setupOllama(): Promise<void> {
  console.log(`  ${colorText('Provider:', 'dim')}  ${colorText('Ollama', 'bold')}`);
  console.log(`  ${colorText('Type:', 'dim')}      ${colorText('Local LLM Server', 'bold')}`);
  console.log(`  ${colorText('Website:', 'dim')}   ${colorText('https://ollama.ai', 'primary')}`);
  console.log('');

  // Step 1: Check if Ollama is installed
  console.log(`  ${colorText('Step 1: Installation Check', 'bold')}`);
  console.log(`  ${divider(36)}`);

  let ollamaInstalled = false;
  try {
    const { execSync } = await import('node:child_process');
    execSync('ollama --version', { encoding: 'utf-8' });
    ollamaInstalled = true;
    console.log(`  ${colorText('✓ Ollama is installed', 'success')}`);
  } catch {
    console.log(`  ${colorText('✗ Ollama is not installed', 'error')}`);
    console.log(`     ${colorText('Install from: https://ollama.ai', 'dim')}`);
    console.log(`     ${colorText('Or: curl -fsSL https://ollama.ai/install.sh | sh', 'dim')}`);
    console.log('');
  }
  console.log('');

  // Step 2: Connection check
  console.log(`  ${colorText('Step 2: Connection Check', 'bold')}`);
  console.log(`  ${divider(36)}`);

  const provider = new OllamaProvider();
  let connected = false;
  try {
    connected = await provider.connect();
    console.log(
      `  ${connected ? colorText('✓ Ollama server: running', 'success') : colorText('✗ Ollama server: not running', 'error')}`,
    );
    if (!connected) {
      console.log(`     ${colorText('Start with: ollama serve', 'dim')}`);
      console.log('');
      if (!ollamaInstalled) return;
    }
  } catch {
    console.log(`  ${colorText('✗ Could not connect to Ollama', 'error')}`);
    console.log(`     ${colorText('Ensure Ollama is running: ollama serve', 'dim')}`);
    console.log('');
    if (!ollamaInstalled) return;
  }
  console.log('');

  if (!connected) return;

  // Step 3: Model discovery
  console.log(`  ${colorText('Step 3: Local Model Discovery', 'bold')}`);
  console.log(`  ${divider(36)}`);

  try {
    const models = await provider.listModels();
    if (models.length > 0) {
      console.log(`  ${colorText(`Found ${models.length} local model(s):`, 'bold')}`);
      for (const m of models) {
        console.log(`    ${colorText(`○ ${m.id} (${m.contextLength || '?'} ctx)`, 'dim')}`);
      }
    } else {
      console.log(`  ${colorText('No models found. Pull a model:', 'warning')}`);
      console.log(`    ${colorText('ollama pull llama3.2', 'primary')}`);
      console.log(`    ${colorText('ollama pull deepseek-coder', 'primary')}`);
      console.log(`    ${colorText('ollama pull mistral', 'primary')}`);
    }
    console.log('');
  } catch {
    console.log(`  ${colorText('○ Could not list models', 'warning')}`);
    console.log('');
  }

  // Step 4: Runtime recommendations
  console.log(`  ${colorText('Step 4: Runtime Recommendations', 'bold')}`);
  console.log(`  ${divider(36)}`);
  console.log(`  ${colorText('✓ Ollama is configured and ready.', 'success')}`);
  console.log(`  ${colorText('○ Local models work offline — no API costs', 'dim')}`);
  console.log(
    `  ${colorText('○ For coding, pull models like deepseek-coder or codellama', 'dim')}`,
  );
  console.log(`  ${colorText('○ For chat, pull models like llama3.2 or mistral', 'dim')}`);
  console.log(`  ${colorText('○ Set AUTIC_DEFAULT_MODEL or use --model in chat', 'dim')}`);
  console.log('');

  // Summary
  console.log(`  ${divider(36)}`);
  console.log(`  ${colorText('Setup Complete', 'bold')}`);
  console.log(`    ${colorText('Ollama:', 'dim')}     ${colorText('Running', 'success')}`);
  console.log(`    ${colorText('Models:', 'dim')}     ${colorText('Scanned', 'success')}`);
  console.log(`    ${colorText('Offline:', 'dim')}    ${colorText('Supported', 'success')}`);
  console.log(`  ${divider(36)}`);
  console.log('');
  console.log(`  ${colorText('Next:', 'bold')}`);
  console.log(`    ${colorText('autic doctor quick', 'primary')}`);
  console.log(`    ${colorText('autic chat', 'primary')}`);
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

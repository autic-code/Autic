/**
 * autic models — Search, install, list, and manage models.
 *
 * Enhanced with real provider integration, model registry, capability display,
 * and context window information.
 */

import { OllamaProvider, OpenRouterProvider, ModelRegistry } from '@autic/providers';
import { spawn } from 'node:child_process';

const modelRegistry = new ModelRegistry();

import { colorText, heading, divider } from '@autic/ui';

export async function modelsCommand(action?: string, name?: string): Promise<void> {
  console.log(`\n  ${heading('Model Management')}`);
  console.log(`  ${divider(48)}\n`);

  switch (action) {
    case 'list':
      await listModels();
      break;
    case 'search':
      await searchModels(name);
      break;
    case 'install':
      await installModel(name);
      break;
    case 'capabilities':
    case 'caps':
      await showCapabilities(name);
      break;
    default:
      console.log(
        `  ${colorText('Usage:', 'primary')} ${colorText('autic models [list|search|install|capabilities] [name]', 'dim')}\n`,
      );
      await listModels();
  }
}

async function listModels(): Promise<void> {
  // Fetch from all available providers
  const ollama = new OllamaProvider();
  const openRouterKey = process.env.OPENROUTER_API_KEY || process.env.AUTIC_OPENROUTER_KEY;
  const openRouter = openRouterKey ? new OpenRouterProvider({ apiKey: openRouterKey }) : null;

  // Locally available models (Ollama)
  console.log('  Locally available models (Ollama):\n');
  const ollamaConnected = await ollama.connect();
  if (ollamaConnected) {
    const ollamaModels = await ollama.listModels();
    if (ollamaModels.length === 0) {
      console.log('  No models installed. Use "autic models install <name>" to add one.\n');
    } else {
      modelRegistry.registerModels(ollamaModels, 'ollama', true);
      for (const model of ollamaModels) {
        console.log(`  ✓ ${model.id}`);
        console.log(`     Context: ${formatContext(model.contextLength)}`);
        console.log(`     Capabilities: ${model.capabilities.map((c) => c.type).join(', ')}`);
        console.log('');
      }
    }
  } else {
    console.log('  Ollama is not running. Install from https://ollama.ai\n');
  }

  // Cloud models (OpenRouter)
  if (openRouter) {
    console.log('  Cloud models (OpenRouter):\n');
    try {
      const connected = await openRouter.connect();
      if (connected) {
        const cloudModels = await openRouter.listModels();
        if (cloudModels.length > 0) {
          modelRegistry.registerModels(cloudModels, 'openrouter', false);

          // Show first 15 models
          const displayModels = cloudModels.slice(0, 15);
          for (const model of displayModels) {
            const pricing = model.pricing
              ? `$${model.pricing.perMillionTokensInput.toFixed(2)}/$${model.pricing.perMillionTokensOutput.toFixed(2)} per 1M tokens`
              : '';
            console.log(`  ○ ${model.id}`);
            console.log(
              `     Context: ${formatContext(model.contextLength)}${pricing ? ` | ${pricing}` : ''}`,
            );
            console.log(`     Capabilities: ${model.capabilities.map((c) => c.type).join(', ')}`);
            console.log('');
          }
          if (cloudModels.length > 15) {
            console.log(`  ... and ${cloudModels.length - 15} more models`);
            console.log('  Use "autic models search <query>" to find specific models.\n');
          }
        }
      } else {
        console.log('  OpenRouter connection failed. Check your API key.\n');
      }
    } catch {
      console.log('  Could not fetch models from OpenRouter.\n');
    }
  } else {
    console.log('  Cloud models (OpenRouter):\n');
    console.log('  Set OPENROUTER_API_KEY or AUTIC_OPENROUTER_KEY to list cloud models.\n');
  }

  // Show aggregate stats
  const stats = modelRegistry.getStats();
  if (stats.totalModels > 0) {
    console.log(
      `  Registered: ${stats.totalModels} models (${stats.localModels} local, ${stats.cloudModels} cloud)\n`,
    );
  }
}

async function searchModels(query?: string): Promise<void> {
  const searchTerm = query || 'llama';
  console.log(`  Searching for models matching "${searchTerm}"...\n`);

  // Search via model registry first
  const cachedResults = modelRegistry.searchModels(searchTerm);
  if (cachedResults.length > 0) {
    console.log(`  Found ${cachedResults.length} model(s) in registry:\n`);
    for (const entry of cachedResults.slice(0, 15)) {
      const icon = entry.isLocal ? '✓' : '○';
      console.log(`  ${icon} ${entry.model.id} [${entry.providerId}]`);
      console.log(`     Context: ${formatContext(entry.contextWindow)}`);
      console.log(`     Type: ${entry.isLocal ? 'local' : 'cloud'}`);
      console.log('');
    }
    if (cachedResults.length > 15) {
      console.log(`  ... and ${cachedResults.length - 15} more\n`);
    }
    return;
  }

  // Search via Ollama for local models
  const ollama = new OllamaProvider();
  const connected = await ollama.connect();

  if (connected) {
    try {
      const results = await new Promise<string>((resolve, reject) => {
        const proc = spawn('ollama', ['list'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let output = '';
        proc.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        proc.on('close', (code) => {
          if (code === 0) resolve(output);
          else reject(new Error(`ollama list exited with code ${code}`));
        });
        proc.on('error', reject);
      });

      const lines = results.split('\n').filter(Boolean);
      if (lines.length > 1) {
        const matching = lines
          .slice(1)
          .filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()));

        if (matching.length > 0) {
          console.log(`  Installed models matching "${searchTerm}":\n`);
          for (const line of matching) {
            console.log(`  ✓ ${line.split(/\s+/)[0]}`);
          }
          console.log('');
        }
      }
    } catch {
      // Search failed silently
    }
  }

  // Suggest installable models
  console.log('  Common models you can install:\n');
  const suggestions = [
    'llama3.2',
    'llama3.1',
    'mistral',
    'codellama',
    'qwen2.5',
    'gemma2',
    'phi3',
    'neural-chat',
  ].filter((m) => m.includes(searchTerm.toLowerCase()));

  for (const model of suggestions) {
    console.log(`  ○ ${model}`);
  }
  console.log('');
  console.log(`  Install with: autic models install <model-name>\n`);
}

async function installModel(name?: string): Promise<void> {
  if (!name) {
    console.log('  Usage: autic models install <model-name>\n');
    console.log('  Examples:\n');
    console.log('    autic models install llama3.2');
    console.log('    autic models install codellama');
    console.log('    autic models install mistral\n');
    return;
  }

  console.log(`  Installing model: ${name}\n`);
  console.log('  Starting download...\n');

  try {
    const proc = spawn('ollama', ['pull', name], {
      stdio: 'inherit',
    });

    await new Promise<void>((resolve, reject) => {
      proc.on('close', (code) => {
        if (code === 0) {
          console.log(`\n  ✓ Model "${name}" installed successfully.\n`);

          // Register in model registry
          const ollama = new OllamaProvider();
          ollama
            .connect()
            .then(() => {
              ollama
                .listModels()
                .then((models) => {
                  const installed = models.find((m) => m.id === name);
                  if (installed) {
                    modelRegistry.registerModel(installed, 'ollama', true);
                    console.log(`  Registered in model catalog.\n`);
                  }
                })
                .catch(() => {});
            })
            .catch(() => {});

          resolve();
        } else {
          reject(new Error(`ollama pull exited with code ${code}`));
        }
      });
      proc.on('error', reject);
    });
  } catch (error) {
    if ((error as Error).message?.includes('ENOENT')) {
      console.log('  ✗ Ollama is not installed or not in PATH.');
      console.log('    Install Ollama from https://ollama.ai\n');
    } else {
      console.log(`  ✗ Failed to install model: ${(error as Error).message}\n`);
    }
  }
}

async function showCapabilities(modelName?: string): Promise<void> {
  if (modelName) {
    const results = modelRegistry.searchModels(modelName);
    if (results.length > 0) {
      for (const entry of results) {
        console.log(`  Model: ${entry.model.id} [${entry.providerId}]\n`);
        console.log(`  Context window: ${formatContext(entry.contextWindow)}`);
        console.log(`  Type: ${entry.isLocal ? 'Local' : 'Cloud'}`);
        console.log(`  Capabilities:\n`);
        for (const cap of entry.model.capabilities) {
          console.log(`    ${cap.type}`);
        }
        if (entry.model.pricing) {
          console.log(`\n  Pricing:`);
          console.log(
            `    Input: $${entry.model.pricing.perMillionTokensInput.toFixed(2)}/1M tokens`,
          );
          console.log(
            `    Output: $${entry.model.pricing.perMillionTokensOutput.toFixed(2)}/1M tokens`,
          );
        }
        console.log('');
      }
    } else {
      console.log(`  No model found matching "${modelName}".\n`);
    }
    return;
  }

  // Show capability summary
  const stats = modelRegistry.getStats();
  console.log('  Model Capability Summary:\n');
  for (const [cap, count] of Object.entries(stats.capabilities).sort((a, b) => b[1] - a[1])) {
    const bar = '█'.repeat(Math.ceil((count / stats.totalModels) * 20));
    console.log(`  ${cap.padEnd(18)} ${bar} ${count}`);
  }
  console.log(`\n  Total models: ${stats.totalModels}\n`);
}

function formatContext(length: number): string {
  if (length >= 1_000_000) return `${(length / 1000).toFixed(0)}K`;
  if (length >= 1000) return `${(length / 1000).toFixed(0)}K`;
  return `${length}`;
}

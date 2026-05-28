/**
 * @autic/providers - Provider abstraction layer for LLM backends
 */

export * from './types.js';
export * from './BaseProvider.js';
export { OpenRouterProvider } from './openrouter/OpenRouterProvider.js';
export type { OpenRouterConfig } from './openrouter/OpenRouterProvider.js';
export { OllamaProvider } from './ollama/OllamaProvider.js';
export type { OllamaConfig } from './ollama/OllamaProvider.js';
export { ProviderRegistry } from './ProviderRegistry.js';
export type { RegistryOptions } from './ProviderRegistry.js';
export { KeyManager } from './KeyManager.js';
export type { KeyManagerOptions } from './KeyManager.js';
export { ModelRegistry } from './ModelRegistry.js';
export type { ModelRegistryOptions } from './ModelRegistry.js';
export { RateLimiter } from './RateLimiter.js';
export type { RateLimiterOptions } from './RateLimiter.js';
export { classifyProviderError, createProviderError, formatProviderError } from './errors.js';
export type { ErrorClassificationResult } from './errors.js';

// Stability
export { ProviderStabilityLayer } from './ProviderStabilityLayer.js';
export type {
  ProviderStabilityLayerOptions,
  ProviderStabilityEvents,
} from './ProviderStabilityLayer.js';

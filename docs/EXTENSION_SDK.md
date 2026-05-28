# Extension SDK Guide

> Version: 0.1.0 | How to build extensions for Autic using the `@autic/sdk`.

## Overview

The Autic Extension SDK (`@autic/sdk`) provides a safe, sandboxed framework for building third-party extensions. Extensions can hook into runtime events, provider interactions, workflow execution, orchestration pipelines, and context management.

## Getting Started

### 1. Create an Extension Manifest

Every extension needs an `autic-extension.json` manifest:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "My first Autic extension",
  "author": "Your Name",
  "type": "plugin",
  "visibility": "public",
  "permissions": ["runtime:read", "context:read"],
  "compatibility": {
    "autic": "^0.1.0"
  },
  "entry": "./dist/index.js",
  "hooks": ["runtime:init", "runtime:destroy"]
}
```

### 2. Implement Extension Hooks

```typescript
import { RuntimeHooks, RuntimeHookEvent } from '@autic/sdk';

const runtimeHooks = new RuntimeHooks();

// Hook into runtime initialization
runtimeHooks.on(RuntimeHookEvent.INIT, async (context) => {
  console.log(`Extension initialized: ${context.sessionId}`);
  // Initialize your extension's resources
});

// Hook into runtime shutdown
runtimeHooks.on(RuntimeHookEvent.DESTROY, async (context) => {
  console.log('Extension shutting down');
  // Clean up resources
});

// Hook into runtime errors
runtimeHooks.on(RuntimeHookEvent.ERROR, async (context) => {
  console.error(`Runtime error: ${context.error}`);
});

export default runtimeHooks;
```

### 3. Test Your Extension

```bash
# Load and validate
autic validate-security

# Run governance checks
autic governance

# Check compatibility
autic ecosystem compat
```

## Available Hooks

### Runtime Hooks (`RuntimeHooks`)

| Event | Description | Context |
|-------|-------------|---------|
| `INIT` | Runtime initialization | `sessionId`, `config` |
| `DESTROY` | Runtime shutdown | `sessionId` |
| `ERROR` | Runtime error | `error`, `sessionId` |

### Provider Hooks (`ProviderHooks`)

| Event | Description | Context |
|-------|-------------|---------|
| `BEFORE_REQUEST` | Before provider request | `provider`, `model`, `prompt` |
| `AFTER_REQUEST` | After provider response | `provider`, `model`, `response`, `duration` |
| `ON_ERROR` | Provider error | `provider`, `error` |

### Workflow Hooks (`WorkflowHooks`)

| Event | Description | Context |
|-------|-------------|---------|
| `BEFORE_STEP` | Before workflow step | `workflowId`, `step`, `goal` |
| `AFTER_STEP` | After workflow step | `workflowId`, `step`, `result` |
| `ON_COMPLETE` | Workflow completed | `workflowId`, `result` |
| `ON_ERROR` | Workflow error | `workflowId`, `error` |

### Orchestration Hooks (`OrchestrationHooks`)

| Event | Description | Context |
|-------|-------------|---------|
| `BEFORE_PIPELINE` | Before pipeline execution | `pipelineId`, `goal` |
| `AFTER_PIPELINE` | After pipeline execution | `pipelineId`, `result` |
| `ON_STAGE_START` | Pipeline stage started | `pipelineId`, `stage` |
| `ON_STAGE_COMPLETE` | Pipeline stage completed | `pipelineId`, `stage`, `result` |

### Context Hooks (`ContextHooks`)

| Event | Description | Context |
|-------|-------------|---------|
| `BEFORE_BUILD` | Before context assembly | `sessionId`, `messages` |
| `AFTER_BUILD` | After context assembly | `sessionId`, `context` |
| `BEFORE_OPTIMIZE` | Before token optimization | `sessionId`, `context` |
| `AFTER_OPTIMIZE` | After token optimization | `sessionId`, `optimizedContext` |

## Plugin Sandbox

Extensions run in a sandboxed environment with resource limits:

```typescript
import { PluginSandbox } from '@autic/sdk';

const sandbox = new PluginSandbox({
  maxMemory: 64 * 1024 * 1024,      // 64 MB
  maxCpuTime: 5000,                   // 5 seconds
  maxFileSize: 1024 * 1024,          // 1 MB
  allowedPaths: ['/tmp/autic/ext/'], // Restricted paths
  networkAccess: false,               // No network by default
  maxChildProcesses: 0,               // No child processes
});

const result = await sandbox.execute(async () => {
  // Your extension code here
  return { success: true };
});
```

## Permission Management

Extensions must declare permissions in their manifest. The PermissionManager enforces these at runtime:

```typescript
import { PermissionManager, PERMISSION_SCOPES } from '@autic/sdk';

const pm = new PermissionManager();

// Check if extension has a permission
const allowed = await pm.checkPermission('runtime:read', {
  extension: 'my-extension',
  scope: 'runtime',
});

// Available permission scopes
console.log(PERMISSION_SCOPES);
// ['runtime', 'provider', 'workflow', 'orchestration', 'context', 'filesystem', 'network']
```

## Version Compatibility

```typescript
import { VersionCompatibilityChecker } from '@autic/sdk';

const checker = new VersionCompatibilityChecker();
const result = checker.check('my-extension', '1.0.0', '0.1.0');
// { compatible: true, supportedRange: '^0.1.0' }
```

## Extension Lifecycle

1. **INSTALLED** — Extension is registered in the registry
2. **LOADING** — Extension is being loaded by the loader
3. **ACTIVE** — Extension is active and receiving hooks
4. **DISABLED** — Extension is registered but not active
5. **ERROR** — Extension encountered an error
6. **UNINSTALLED** — Extension is removed from the registry

## Ecosystem Discovery

Autic can discover extensions in the workspace:

```typescript
import { EcosystemDiscovery } from '@autic/sdk';

const discovery = new EcosystemDiscovery({
  searchPaths: ['./extensions', './node_modules/@autic-ext/*'],
});

const result = await discovery.discover();
// { extensions: [...], total: 3, duration: 150 }
```

## Best Practices

1. **Minimal permissions** — Request only what you need
2. **Async cleanup** — Always clean up resources in `DESTROY`/`ON_ERROR` hooks
3. **Error handling** — Wrap hook implementations in try/catch
4. **Stateless design** — Don't depend on in-memory state across restarts
5. **Version pinning** — Pin `@autic/sdk` version in your extension
6. **Test thoroughly** — Use `autic governance` and `autic ecosystem` to validate

## Publishing Extensions

```bash
# Validate extension
autic validate-security

# Check governance
autic governance

# Run ecosystem diagnostics
autic ecosystem diagnostics

# Check compatibility
autic ecosystem compat
```

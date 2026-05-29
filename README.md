# Autic

**CLI-native autonomous AI engineering runtime.**

Autic is a production-grade, local-first CLI tool that orchestrates AI models to help you build, fix, and manage software projects — all while keeping your code and data on your machine.

[![CI](https://github.com/autic/autic/actions/workflows/ci.yml/badge.svg)](https://github.com/autic/autic/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@autic/cli.svg)](https://www.npmjs.com/package/@autic/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

---

## Features

- **🤖 Multi-Provider AI Orchestration** — Use OpenRouter (200+ models), OpenAI, Anthropic, or local Ollama models — or all at once with automatic fallback
- **🏗️ Autonomous Workflows** — Run multi-step engineering workflows: fix code, refactor, build features, and more
- **🧠 Orchestration Pipelines** — Structured R&D pipelines: Research → Plan → Architect → Engineer → Verify → Repair → Final Review
- **🛡️ Local-First Security** — Encrypted vault for API keys, secret sanitization, permission profiles, BYOK architecture
- **🔍 Observability & Diagnostics** — Runtime health monitoring, system snapshots, audit trails, performance profiling
- **🧪 Production Validation** — Chaos testing, regression prevention, workflow validation, platform certification
- **🔌 Extension SDK** — Build plugins with hooks into runtime, provider, workflow, orchestration, and context events
- **📚 Skills System** — Reusable engineering skills: code-fixer, repo-analyzer, debugging-specialist, and more

## Quick Start

```bash
# Install globally
npm install -g @autic/cli

# Initialize Autic in your workspace
autic init

# Add an AI provider (OpenRouter recommended — 200+ models)
autic providers add openrouter --key sk-or-v1-xxxxxxxx

# Verify setup
autic doctor

# Start chatting with AI
autic chat

# Run an autonomous fix
autic fix --target src/
```

## Requirements

- **Node.js** >= 20.0.0
- **npm** or **pnpm** for installation
- An LLM provider API key (OpenRouter, OpenAI, or Anthropic)

## Provider Quick Setup

| Provider                     | Command                                                   |
| ---------------------------- | --------------------------------------------------------- |
| **OpenRouter** (recommended) | `autic providers add openrouter --key sk-or-...`          |
| **OpenAI**                   | `autic providers add openai --key sk-...`                 |
| **Anthropic**                | `autic providers add anthropic --key sk-ant-...`          |
| **Ollama** (local)           | `autic providers add ollama --url http://localhost:11434` |

## Key Commands

### Core

| Command       | Description                               |
| ------------- | ----------------------------------------- |
| `autic init`  | Initialize Autic in the current directory |
| `autic chat`  | Start an interactive AI chat session      |
| `autic fix`   | Run autonomous fix workflow on a target   |
| `autic run`   | Execute a task or script with AI          |
| `autic build` | Build the current Autic workspace         |

### Provider & Model Management

| Command           | Description                                |
| ----------------- | ------------------------------------------ |
| `autic providers` | List, add, remove, and check LLM providers |
| `autic models`    | Search and list available models           |

### Workflows & Orchestration

| Command             | Description                            |
| ------------------- | -------------------------------------- |
| `autic workflow`    | Run an autonomous engineering workflow |
| `autic orchestrate` | Run the full R&D pipeline system       |
| `autic swarm`       | Multi-agent swarm orchestration        |

### Security

| Command                   | Description                              |
| ------------------------- | ---------------------------------------- |
| `autic security`          | Manage security profiles and permissions |
| `autic privacy`           | Configure privacy mode                   |
| `autic validate-security` | Run security validation checks           |

### Diagnostics

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `autic doctor`        | Full environment diagnostics |
| `autic observability` | Runtime system snapshots     |
| `autic audit`         | Comprehensive runtime audit  |
| `autic profiling`     | CPU/memory/latency profiling |

### Validation & Testing

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `autic validate`         | Production validation suite       |
| `autic chaos`            | Provider chaos/resilience testing |
| `autic regression`       | Regression prevention checks      |
| `autic platform-certify` | Platform certification            |

See the full [Command Reference](docs/COMMAND_REFERENCE.md) for all 40+ commands.

## Architecture

Autic follows a layered architecture of independent, modular packages:

```
CLI Layer (autic)          → Commander-based CLI, 40+ commands
Orchestration Layer        → Neuro Brain, Role Agents, Swarm, Pipeline
Execution Runtime          → Workflow Engine, Provider Router, Context Manager
Security & Privacy         → Encrypted Vault, Permissions, Sanitizer, Profiles
Stability & Hardening      → Watchdog, Recovery, Deadlock Protection
Diagnostics & Observability→ Doctor, Observability, Audit, Profiling, Telemetry
Validation & Certification → Workflow Validate, Chaos, Regression, Certify
Ecosystem & Extensibility  → SDK, Extension Registry, Governance, Templates
Release & Distribution     → Release Channels, Update Manager
```

Each layer is an independent `@autic/*` package with a clean public API. All packages are ES modules with TypeScript strict mode. See [Architecture](docs/ARCHITECTURE.md) for details.

## Documentation

| Document                                             | Description                             |
| ---------------------------------------------------- | --------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)                 | System architecture and layer design    |
| [Core Concepts](docs/CORE_CONCEPTS.md)               | Essential concepts for using Autic      |
| [Command Reference](docs/COMMAND_REFERENCE.md)       | Complete CLI command reference          |
| [Provider Integration](docs/PROVIDER_INTEGRATION.md) | LLM provider setup and management       |
| [Security](docs/SECURITY.md)                         | Security architecture and practices     |
| [Troubleshooting](docs/TROUBLESHOOTING.md)           | Common issues and solutions             |
| [Subsystem Contracts](docs/SUBSYSTEM_CONTRACTS.md)   | Public API contracts between subsystems |
| [Extension SDK](docs/EXTENSION_SDK.md)               | Building extensions for Autic           |
| [Contributing](CONTRIBUTING.md)                      | How to contribute to Autic              |
| [Changelog](CHANGELOG.md)                            | Release history                         |

## Philosophy

- **Local-First** — Everything runs on your machine. No cloud dependency, no data exfiltration.
- **BYOK (Bring Your Own Key)** — You bring your own API keys. No vendor lock-in.
- **Deterministic Orchestration** — Predictable, auditable execution flows.
- **Transparency** — Every operation is observable. No black boxes.
- **Progressive Complexity** — Simple commands for simple tasks, deep capabilities for complex workflows.

## Development

This is a **pnpm monorepo** with 27 packages + CLI application:

```bash
# Clone and install
git clone https://github.com/autic/autic.git
cd autic
pnpm install

# Build all packages
pnpm build

# Typecheck all packages
pnpm typecheck

# Format code
pnpm format

# Run the CLI locally
pnpm build:cli
node apps/cli/dist/index.js --help
```

## License

MIT — see [LICENSE](LICENSE) for details.

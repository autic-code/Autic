# Autic

<p align="center">
  <strong>CLI-native autonomous AI engineering runtime.</strong><br>
  <em>Your local AI engineering teammate. Runs on your machine. Uses your API keys. No cloud dependency.</em>
</p>

<p align="center">
  <a href="https://github.com/autic/autic/actions/workflows/ci.yml"><img src="https://github.com/autic/autic/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="#"><img src="https://img.shields.io/badge/npm-v0.1.0--alpha-blue" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >=20"></a>
</p>

---

## Overview

**Autic** is a CLI tool that uses AI models to help you build, fix, and manage software projects. Think of it as an AI engineering runtime — you describe what needs to be done, and Autic orchestrates the right models and workflows to get it done.

Unlike cloud-only AI coding tools, Autic runs entirely on your machine. You bring your own API keys, your code never leaves your filesystem, and every operation is transparent and auditable.

```bash
# Initialize in your project
autic init

# Add an AI provider
autic providers add openrouter --key sk-or-...

# Verify setup
autic doctor

# Start working
autic chat                  # Interactive session
autic fix --target src/     # Autonomous code fix
autic workflow "Add tests"  # Multi-step workflow
```

---

## Features

| Capability                  | Description                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| **Multi-Provider AI**       | OpenRouter (200+ models), OpenAI, Anthropic, Ollama — or all at once with automatic fallback |
| **Autonomous Workflows**    | Multi-step engineering workflows: fix, refactor, build features, add tests                   |
| **Orchestration Pipelines** | Structured R&D: Research → Plan → Architect → Engineer → Verify → Repair → Review            |
| **Local-First Security**    | Encrypted vault for API keys, secret sanitization, permission profiles — BYOK architecture   |
| **Observability**           | Runtime health monitoring, system snapshots, audit trails, performance profiling             |
| **Production Validation**   | Chaos testing, regression prevention, workflow validation, platform certification            |
| **Extension SDK**           | Build plugins with hooks into runtime, provider, workflow, orchestration, and context events |
| **Skills System**           | Reusable engineering skills: code-fixer, repo-analyzer, debugging-specialist, and more       |

---

## Quick Start

### 1. Install

```bash
npm install -g @autic/cli
```

Requirements: **Node.js >= 20**, **npm** or **pnpm**.

### 2. Initialize

```bash
cd my-project
autic init
```

Autic creates a `.autic` directory and detects your project's framework and package manager automatically.

### 3. Add a Provider

Autic needs access to an LLM to work. The quickest way is via OpenRouter:

```bash
autic providers add openrouter --key sk-or-v1-xxxxxxxx
```

Or bring your own:

```bash
# OpenAI
autic providers add openai --key sk-...

# Anthropic
autic providers add anthropic --key sk-ant-...

# Local (Ollama)
autic providers add ollama --url http://localhost:11434
```

### 4. Verify Setup

```bash
autic doctor
```

### 5. Start Using Autic

```bash
# Interactive session
autic chat

# Autonomous code fix
autic fix --target src/

# Multi-step workflow
autic workflow "Add error handling to API routes"
```

---

## Provider Guide

| Provider       | Command                                      | Best For                    |
| -------------- | -------------------------------------------- | --------------------------- |
| **OpenRouter** | `autic providers add openrouter --key <key>` | 200+ models, single API key |
| **OpenAI**     | `autic providers add openai --key <key>`     | Direct GPT access           |
| **Anthropic**  | `autic providers add anthropic --key <key>`  | Direct Claude access        |
| **Ollama**     | `autic providers add ollama --url <url>`     | Local, offline, private     |

### Ollama Setup

1. [Install Ollama](https://ollama.com) and start the server: `ollama serve`
2. Pull a model: `ollama pull llama3`
3. Add to Autic: `autic providers add ollama --url http://localhost:11434`
4. Verify: `autic providers check`

> 💡 **Recommendation for new users:** Start with OpenRouter for the widest model selection, then add Ollama for offline tasks.

---

## Key Commands

### Core

| Command                     | Description                                 |
| --------------------------- | ------------------------------------------- |
| `autic init`                | Initialize Autic in the current directory   |
| `autic chat`                | Start an interactive AI chat session        |
| `autic fix --target <path>` | Run autonomous fix workflow on a target     |
| `autic run <script>`        | Execute a task or script with AI assistance |
| `autic build`               | Build the current Autic workspace           |

### Providers & Models

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `autic providers`       | List, add, remove, and check LLM providers     |
| `autic providers check` | Test connectivity for all configured providers |
| `autic models`          | Search and list available models               |

### Workflows

| Command                    | Description                            |
| -------------------------- | -------------------------------------- |
| `autic workflow <goal>`    | Run an autonomous engineering workflow |
| `autic orchestrate <goal>` | Run the full R&D pipeline              |
| `autic swarm`              | Multi-agent swarm coordination         |

### Security

| Command                   | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `autic security`          | Manage security profiles and permissions             |
| `autic privacy`           | Configure privacy mode (normal, local_only, offline) |
| `autic validate-security` | Run all 21 security validation checks                |

### Diagnostics

| Command               | Description                  |
| --------------------- | ---------------------------- |
| `autic doctor`        | Full environment diagnostics |
| `autic audit`         | Comprehensive runtime audit  |
| `autic observability` | Runtime system snapshots     |
| `autic profiling`     | CPU/memory/latency profiling |

### Validation

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `autic validate`         | Production validation suite       |
| `autic chaos`            | Provider resilience/chaos testing |
| `autic regression`       | Regression prevention checks      |
| `autic platform-certify` | Platform certification            |

> See the full [Command Reference](docs/COMMAND_REFERENCE.md) for all 48 commands with options and examples.

---

## Architecture

Autic is built as a layered architecture of independent, modular packages:

```
CLI Layer              → Commander-based CLI, 40+ commands
Orchestration Layer    → Neuro Brain, Role Agents, Swarm, Pipeline
Execution Runtime      → Workflow Engine, Provider Router, Context Manager
Security & Privacy     → Encrypted Vault, Permissions, Sanitizer, Profiles
Stability & Hardening  → Watchdog, Recovery, Deadlock Protection
Diagnostics            → Doctor, Observability, Audit, Profiling, Telemetry
Validation             → Workflow Validate, Chaos, Regression, Certify
Ecosystem              → SDK, Extension Registry, Governance, Templates
Release & Distribution → Release Channels, Update Manager
```

Each layer is an independent `@autic/*` package with a clean public API. All packages are ES modules with TypeScript strict mode.

→ [Full Architecture Documentation](docs/ARCHITECTURE.md)

---

## Philosophy

**Local-First**
Everything runs on your machine. No cloud dependency, no data exfiltration. Your source code, secrets, and data stay where they belong.

**BYOK (Bring Your Own Key)**
You bring your own API keys. No vendor lock-in, no hidden usage fees, no platform dependency. Switch providers anytime.

**Deterministic Orchestration**
Predictable, auditable execution flows. Every operation is observable. No black boxes, no magic.

**Progressive Complexity**
Simple commands for simple tasks (`autic fix`), deep capabilities for complex workflows (`autic orchestrate`).

**Transparency & Auditability**
Every operation is logged and inspectable via observability, audit, and diagnostics systems.

---

## Documentation

| Document                                             | Description                                  |
| ---------------------------------------------------- | -------------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)                 | System architecture and layer design         |
| [Core Concepts](docs/CORE_CONCEPTS.md)               | Essential concepts for using Autic           |
| [Command Reference](docs/COMMAND_REFERENCE.md)       | Complete CLI command reference (48 commands) |
| [Provider Integration](docs/PROVIDER_INTEGRATION.md) | LLM provider setup and management            |
| [Security](docs/SECURITY.md)                         | Security architecture and practices          |
| [Troubleshooting](docs/TROUBLESHOOTING.md)           | Common issues and solutions                  |
| [Subsystem Contracts](docs/SUBSYSTEM_CONTRACTS.md)   | Public API contracts between subsystems      |
| [Extension SDK](docs/EXTENSION_SDK.md)               | Building extensions for Autic                |
| [Contributing](CONTRIBUTING.md)                      | How to contribute                            |
| [Changelog](CHANGELOG.md)                            | Release history                              |

---

## Development

Autic is a **pnpm monorepo** with 27 packages + CLI application:

```bash
# Clone
git clone https://github.com/autic/autic.git
cd autic

# Install
pnpm install

# Build all packages
pnpm build

# Typecheck
pnpm typecheck

# Run the CLI locally
node apps/cli/dist/index.js --help
```

---

## Roadmap

| Area                                                     | Status         |
| -------------------------------------------------------- | -------------- |
| Provider orchestration (multi-model, fallback)           | ✅ Shipped     |
| Autonomous workflows                                     | ✅ Shipped     |
| Security & privacy (vault, sanitization, permissions)    | ✅ Shipped     |
| Diagnostics & observability                              | ✅ Shipped     |
| Production validation (chaos, regression, certification) | ✅ Shipped     |
| Session persistence (disk-backed, crash recovery)        | 🚧 In progress |
| Extension SDK & plugin ecosystem                         | 🚧 In progress |
| Interactive terminal UI                                  | 🚧 In progress |
| Windows platform certification                           | 🔜 Planned     |
| CI/CD integration (GitHub Actions, GitLab CI)            | 🔜 Planned     |

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ for developers who want AI assistance without compromise.</sub>
</p>

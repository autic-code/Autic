# Autic

<p align="center">
  <strong>CLI-native autonomous AI engineering runtime.</strong><br>
  <em>Your local AI engineering teammate. Runs on your machine. Uses your API keys. No cloud dependency.</em>
</p>

<p align="center">
  <a href="https://github.com/autic-code/Autic/actions/workflows/ci.yml"><img src="https://github.com/autic-code/Autic/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://www.npmjs.com/package/@autic/cli"><img src="https://img.shields.io/npm/v/@autic/cli?color=blue&label=alpha" alt="npm"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js >=20"></a>
  <a href="#"><img src="https://img.shields.io/badge/platform-linux%20%7C%20macOS-lightgrey" alt="Platform"></a>
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#core-commands">Commands</a> •
  <a href="#provider-setup">Providers</a> •
  <a href="#documentation">Docs</a> •
  <a href="#contributing">Contributing</a>
</p>

---

Autic is a CLI tool that orchestrates AI models to help you build, fix, refactor, and verify software. You describe what needs to be done — Autic handles the execution, from simple one-shot fixes to multi-step engineering workflows with role-based agents.

Unlike cloud-only AI coding tools, Autic runs entirely on your machine. Your code never leaves your filesystem, your API keys stay under your control, and every operation is transparent and auditable.

```bash
npm install -g @autic/cli    # Install
cd my-project && autic init   # Initialize
autic doctor                  # Verify setup
autic fix --target src/       # Fix code autonomously
```

---

## Why Autic

Most AI coding tools fall into one of two camps: cloud IDEs that require uploading your code, or simple wrappers around a single chat API. Autic is neither.

|                          | Cloud IDEs | Chat Wrappers | Autic |
| ------------------------ | ---------- | ------------- | ----- |
| **Runs locally**         | ❌         | ✅            | ✅    |
| **Multi-provider**       | ❌         | ❌            | ✅    |
| **Autonomous workflows** | ❌         | ❌            | ✅    |
| **Session persistence**  | ❌         | ❌            | ✅    |
| **BYOK (your keys)**     | ❌         | ✅            | ✅    |
| **Offline-capable**      | ❌         | ❌            | ✅    |
| **Audit trail**          | ❌         | ❌            | ✅    |
| **Extensible**           | ❌         | ❌            | ✅    |

Autic treats AI as a composable resource — not a single chat window. You bring your preferred models, configure workflows, and maintain full control over your code and data.

---

## Key Features

| Capability                       | Description                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Multi-provider orchestration** | OpenRouter (200+ models), Ollama — with automatic fallback and routing                                   |
| **Autonomous workflows**         | Multi-step pipelines: fix, refactor, build features, add tests, verify — run without hand-holding        |
| **Role-based agents**            | Specialist agents (architect, engineer, reviewer) with controlled swarm coordination                     |
| **Local-first architecture**     | Encrypted vault for API keys, secret sanitization, permission controls — your data stays on your machine |
| **Session persistence**          | Disk-backed session state with crash recovery. Pick up where you left off                                |
| **Workspace memory**             | Project-aware context that persists across sessions. Autic learns your codebase over time                |
| **Verification loops**           | Built-in verify-and-repair: changes are validated automatically, with self-healing on failure            |
| **Context optimization**         | Token-efficient context management — maximize useful context per request                                 |
| **Diagnostics & observability**  | Runtime health monitoring, system snapshots, audit trails, performance profiling                         |
| **Production validation**        | Chaos testing, regression prevention, workflow validation, platform certification                        |
| **Extension SDK**                | Build plugins with hooks into runtime, provider, workflow, orchestration, and context events             |

---

## Architecture Highlights

```
CLI Layer              → Commander-based CLI, 47 commands
Orchestration Layer    → Role Agents, Swarm, Pipeline, Workflow Engine
Execution Runtime      → Provider Router, Context Manager, Memory
Security & Privacy     → Encrypted Vault, Permissions, Sanitizer, Profiles
Stability & Hardening  → Watchdog, Recovery, Deadlock Protection
Diagnostics            → Doctor, Observability, Audit, Profiling
Validation             → Workflow Validation, Chaos, Regression, Certify
Ecosystem              → SDK, Extension Registry, Governance, Templates
```

Each layer is an independent `@autic/*` package with a clean public API. All packages are ES modules with TypeScript strict mode.

→ [Full Architecture Documentation](docs/ARCHITECTURE.md)

---

## Installation

### Prerequisites

- **Node.js >= 20**
- **npm** (or **pnpm**)

### Install globally

```bash
npm install -g @autic/cli
```

### Verify installation

```bash
autic --version
autic doctor
```

`autic doctor` runs a full environment diagnostic — Node version, package manager, Git availability, provider connectivity, and security status.

---

## Quick Start

### 1. Initialize

```bash
cd my-project
autic init
```

Autic creates a `.autic` directory and detects your project's framework and package manager automatically.

### 2. Add a provider

```bash
# OpenRouter (fastest way to get started — 200+ models, single API key)
autic providers add openrouter --key sk-or-v1-xxxxxxxx

# Or set up a local provider:
autic providers setup ollama
```

### 3. Verify setup

```bash
autic doctor
```

All checks should pass. If Ollama is running locally, it will be detected automatically.

### 4. Start working

```bash
# Interactive chat session
autic chat

# Autonomous code fix
autic fix --target src/

# Multi-step workflow
autic workflow "Add error handling to API routes"
```

---

## Core Commands

### Getting started

| Command        | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `autic`        | Launchpad dashboard — workspace status, provider health, quick commands |
| `autic init`   | Initialize Autic in the current directory                               |
| `autic doctor` | Full environment diagnostics                                            |
| `autic chat`   | Start an interactive AI chat session                                    |
| `autic --help` | Show all commands and options                                           |

### Building & fixing

| Command                     | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `autic fix --target <path>` | Run autonomous fix workflow on a target                                               |
| `autic build`               | Build the current Autic workspace                                                     |
| `autic run <script>`        | Execute a task or script with AI assistance                                           |
| `autic workflow <goal>`     | Run an autonomous engineering workflow                                                |
| `autic orchestrate <goal>`  | Full R&D pipeline (Research → Plan → Architect → Engineer → Verify → Repair → Review) |

### Providers & models

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `autic providers`       | List, add, remove, and check LLM providers     |
| `autic providers check` | Test connectivity for all configured providers |
| `autic providers setup` | Guided provider onboarding wizard              |
| `autic models`          | Search, list, and inspect available models     |

### Sessions & memory

| Command          | Description                                         |
| ---------------- | --------------------------------------------------- |
| `autic sessions` | Create, list, and restore sessions                  |
| `autic memory`   | Memory leak detection and monitoring                |
| `autic context`  | Advanced context engineering and token optimization |

### Security & privacy

| Command                   | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `autic security`          | Manage security profiles and permissions             |
| `autic privacy`           | Configure privacy mode (normal, local_only, offline) |
| `autic validate-security` | Run all security validation checks                   |
| `autic security-audit`    | Comprehensive security audit                         |

### Diagnostics & validation

| Command                  | Description                       |
| ------------------------ | --------------------------------- |
| `autic audit`            | Comprehensive runtime audit       |
| `autic validate`         | Production validation suite       |
| `autic chaos`            | Provider resilience/chaos testing |
| `autic regression`       | Regression prevention checks      |
| `autic platform-certify` | Platform certification            |

### Advanced

| Command               | Description                                                                    |
| --------------------- | ------------------------------------------------------------------------------ |
| `autic swarm`         | Controlled multi-agent swarm coordination                                      |
| `autic stability`     | Runtime health, performance, and stability monitoring                          |
| `autic learning`      | Engineering learning and operational intelligence                              |
| `autic profiling`     | CPU, memory, and latency profiling                                             |
| `autic observability` | Runtime system snapshots                                                       |
| `autic skills`        | List, install, remove, and run reusable skills                                 |
| `autic template`      | Scaffold a new project from a built-in template                                |
| `autic ecosystem`     | Extension and plugin lifecycle management                                      |
| `autic telemetry`     | Manage safe optional telemetry (always opt-in, never collects code or prompts) |
| `autic debug`         | Debugging, tracing, and platform information                                   |
| `autic update`        | Check for updates and manage versions                                          |

> See the full [Command Reference](docs/COMMAND_REFERENCE.md) for all 47 commands with options and detailed examples.

---

## Provider Setup

| Provider       | Command                                      | Best For                                      |
| -------------- | -------------------------------------------- | --------------------------------------------- |
| **OpenRouter** | `autic providers add openrouter --key <key>` | 200+ models, single API key, fallback routing |
| **Ollama**     | `autic providers setup ollama`               | Local, offline-capable models                 |

> Direct OpenAI and Anthropic provider integrations are planned for future releases. Use OpenRouter to access GPT-4o, Claude 3.5, Gemini, and 200+ other models with a single API key.

### Ollama Integration

[Ollama](https://ollama.com) provides local model inference directly on your machine — no API keys, no network required.

```bash
# 1. Install and start Ollama
ollama serve

# 2. Pull a model
ollama pull llama3

# 3. Add to Autic
autic providers add ollama --url http://localhost:11434

# 4. Verify
autic providers check
```

### Local Models

Autic supports local inference through Ollama for privacy-sensitive or offline workflows:

- **Fully offline** — no network calls, no data leaves your machine
- **Privacy mode** — `autic privacy offline` restricts all provider calls to local-only
- **Fallback chains** — configure local-first with cloud fallback for complex tasks

---

## Agent System

Autic includes a role-based agent system for structured engineering workflows:

| Agent            | Role                                                |
| ---------------- | --------------------------------------------------- |
| **Orchestrator** | Plans and coordinates multi-step engineering tasks  |
| **Architect**    | Designs solutions, evaluates trade-offs             |
| **Engineer**     | Implements changes, writes code                     |
| **Reviewer**     | Validates output, checks for issues                 |
| **Swarm**        | Multi-agent coordination for complex parallel tasks |

These agents run within controlled execution boundaries — they can be configured with different trust profiles, permission levels, and provider assignments.

---

## Workflow Examples

```bash
# Fix a bug in a specific file
autic fix --target src/utils/parser.ts

# Full feature implementation
autic orchestrate "Add user authentication with JWT tokens"

# Run a workflow with custom instructions
autic workflow "Refactor the database layer" --requirements "Use repository pattern, add unit tests"

# Multi-agent coordination
autic swarm "Audit the codebase for security vulnerabilities"
```

---

## Security & Privacy

Autic is designed around a **local-first, BYOK (Bring Your Own Key)** security model:

- **Local-first architecture** — Everything runs on your machine. Source code, secrets, and session data never leave your filesystem
- **Encrypted vault** — API keys and secrets are stored in an encrypted vault, not in plaintext configuration files
- **Secret sanitization** — Automatic detection and redaction of secrets in logs, diagnostics, and output
- **Permission controls** — Granular profiles (safe, balanced, full_auto, local_only) with workspace boundary enforcement
- **Privacy modes** — `normal` (all providers), `local_only` (local models only), `offline` (fully disconnected)
- **Telemetry** — Fully opt-in, anonymized runtime metrics. Never collects source code, prompts, API keys, or credentials

```bash
# Check your security posture
autic security
autic validate-security

# Restrict to local models
autic privacy local_only

# Run a full security audit
autic security-audit
```

---

## Local-First Philosophy

Every design decision in Autic starts with one question: **Does this protect the user's autonomy?**

- **Your keys.** You bring your own API keys. No vendor lock-in, no hidden usage fees.
- **Your data.** Code never uploaded to third-party servers. AI providers only see the prompts you explicitly send.
- **Your choice.** Switch providers, models, or workflows anytime. No platform dependency.
- **Your control.** Full audit trail, configurable permissions, privacy modes that actually restrict behavior.
- **Offline capable.** With local models (Ollama), Autic works fully disconnected.

---

## Documentation

| Document                                             | Description                                  |
| ---------------------------------------------------- | -------------------------------------------- |
| [Architecture](docs/ARCHITECTURE.md)                 | System architecture and layer design         |
| [Core Concepts](docs/CORE_CONCEPTS.md)               | Essential concepts for using Autic           |
| [Command Reference](docs/COMMAND_REFERENCE.md)       | Complete CLI command reference (47 commands) |
| [Provider Integration](docs/PROVIDER_INTEGRATION.md) | LLM provider setup and management            |
| [Security](docs/SECURITY.md)                         | Security architecture and practices          |
| [Troubleshooting](docs/TROUBLESHOOTING.md)           | Common issues and solutions                  |
| [Extension SDK](docs/EXTENSION_SDK.md)               | Building extensions for Autic                |
| [Contributing](CONTRIBUTING.md)                      | How to contribute                            |
| [Changelog](CHANGELOG.md)                            | Release history                              |

---

## Contributing

Autic is an open source project. Contributions are welcome whether it's reporting a bug, suggesting a feature, improving documentation, or submitting code.

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on:

- Code of conduct
- Development setup (pnpm workspace with 27 packages)
- Pull request process
- Coding standards
- Testing requirements

---

## Roadmap

| Area                                                            | Status         |
| --------------------------------------------------------------- | -------------- |
| Multi-provider orchestration (OpenRouter, Ollama)               | ✅ Shipped     |
| Direct OpenAI & Anthropic provider support                      | 🔜 Planned     |
| Launchpad dashboard (autic with no args)                        | ✅ Shipped     |
| Autonomous workflows (fix, refactor, orchestrate)               | ✅ Shipped     |
| Role-based agents and swarm coordination                        | ✅ Shipped     |
| Security & privacy (vault, sanitization, permissions, profiles) | ✅ Shipped     |
| Session persistence (disk-backed, crash recovery)               | ✅ Shipped     |
| Diagnostics & observability (doctor, audit, profiling)          | ✅ Shipped     |
| Production validation (chaos, regression, certification)        | ✅ Shipped     |
| Context optimization and workspace memory                       | ✅ Shipped     |
| Extension SDK and plugin ecosystem                              | 🚧 In progress |
| Interactive terminal UI                                         | 🚧 In progress |
| Windows platform certification                                  | 🔜 Planned     |
| CI/CD integration (GitHub Actions, GitLab CI)                   | 🔜 Planned     |
| Template marketplace                                            | 🔜 Planned     |

Autic follows semantic versioning. The current `0.1.0-alpha` release is the first public alpha — core functionality is stable, but APIs may evolve based on feedback.

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built for developers who want AI assistance without compromise.</sub>
</p>

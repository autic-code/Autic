# Autic v0.1.0-alpha — Release Notes

**Release date:** May 29, 2026

We're excited to announce the first alpha release of **Autic** — a CLI-native autonomous AI engineering runtime that runs entirely on your machine.

## What is Autic?

Autic is a developer tool that uses AI models to help you build, fix, and manage software projects — all while keeping your code and data on your machine. You bring your own API keys, and Autic orchestrates the right models and workflows to get the job done.

## Key Features

- **Multi-Provider AI Orchestration** — Use OpenRouter (200+ models) or local Ollama models with automatic fallback
- **Autonomous Workflows** — Multi-step engineering workflows: fix code, refactor, build features, add tests
- **Orchestration Pipelines** — Research → Plan → Architect → Engineer → Verify → Repair → Review
- **Local-First Security** — Encrypted vault for API keys, secret sanitization, permission profiles
- **Observability & Diagnostics** — Runtime health monitoring, audit trails, performance profiling
- **Production Validation** — Chaos testing, regression prevention, platform certification
- **Extension SDK** — Build plugins with hooks into all runtime events
- **Skills System** — Reusable engineering skills: code-fixer, repo-analyzer, debugging-specialist

## Installation

```bash
npm install -g @autic/cli
```

**Requirements:** Node.js >= 20

## Quick Start

```bash
autic init
autic providers add openrouter --key sk-or-...
autic doctor
autic chat
```

## What's Included

- CLI application with **48 commands** across core, providers, workflows, security, diagnostics, validation, and ecosystem management
- **27 internal packages** — providers, runtime, workflow, orchestration, swarm, security, diagnostics, validation, SDK, and more
- Comprehensive documentation — architecture, command reference, provider guides, security, troubleshooting, contributing

## Known Limitations (Alpha)

- **Session persistence** — Sessions are created in memory but not yet persisted to disk. Session restore and crash recovery are planned for the next release.
- **Interactive chat UI** — The chat command initializes the runtime but the full interactive terminal UI is pending.
- **Windows platform certification** — Validated on Linux. macOS and Windows certification in progress.
- **npm install** — Requires pnpm workspace for development. Standalone npm package coming with GA.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full release history.

## Feedback

We'd love to hear from you! Open an issue or discussion on GitHub for:

- Bugs and feature requests
- Documentation improvements
- Provider integration requests
- Extension SDK feedback

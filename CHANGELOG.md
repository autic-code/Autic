# Changelog

All notable changes to Autic will be documented in this file.

## [0.1.0] — 2026-05-28

### Added

- Initial release — CLI-native autonomous AI engineering runtime
- 27 internal packages + CLI application
- Provider orchestration: OpenRouter, OpenAI, Anthropic, Ollama
- Context engineering: token budgeting, compression, retrieval, ranking
- Swarm coordination: role-based pipelines, delegation, parallel execution
- Security: encrypted vault, sanitizer, permission management, provider security
- Learning system: verified-fix memory, engineering experience DB, learning compression
- Workflow engine: execution coordination, repair loops, safety controls
- Runtime: queue system, worker pool, watchdog, recovery, graceful shutdown
- Diagnostics: doctor, fix tool, release validation, documentation generation
- SDK: plugin sandbox, extension lifecycle, hooks system, ecosystem discovery
- Skills system: code-fixer, repo-analyzer, debugging-specialist, startup-builder
- UI: terminal components with premium blue-themed styling
- Release operations, validation, governance, telemetry, profiling systems
- Production hardening: runtime audit, stress testing, memory leak detection
- Comprehensive documentation: architecture, subsystem contracts, troubleshooting

### Architecture

- Monorepo with pnpm workspaces — 27 packages + 1 CLI app
- Strict TypeScript with ES modules throughout
- Deterministic orchestration — no AGI abstractions
- Local-first philosophy with BYOK provider model
- Layered architecture: shared → providers → runtime → orchestration

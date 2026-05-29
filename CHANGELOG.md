# Changelog

All notable changes to Autic will be documented in this file.

## [0.1.0-alpha.3] — 2026-05-29

### Added

- Production-quality README.md with full documentation, badges, quick start, and command reference
- CONTRIBUTING.md with coding guidelines, development setup, and pull request checklist
- MIT LICENSE file
- `.prettierignore` to prevent formatting of generated files (dist, node_modules, coverage, etc.)
- Release notes (RELEASE_NOTES.md) for alpha launch
- Release quality report (RELEASE_QUALITY_REPORT.md) with scorecard
- GitHub issue templates (bug report, feature request, documentation)
- GitHub pull request template

### Fixed

- **CI: packages/sessions not found** — Root cause: `.gitignore` had `sessions/` (unanchored pattern) matching `packages/sessions/` as a subdirectory. Changed to `/sessions/` to only ignore the top-level sessions cache.
- **packages/sessions/package.json** — Fixed `types` path to `./dist/index.d.ts`, added devDependencies (`@types/node`, `typescript`), added `clean` script — made consistent with all 25 other packages.
- **Removed orphaned Session.ts** — Duplicate of `Session` class in `SessionManager.ts`; was never imported.
- **ERR_PNPM_OUTDATED_LOCKFILE** — Regenerated `pnpm-lock.yaml` to include sessions package devDependencies.
- **266 files formatted** — Full Prettier pass across entire codebase to establish consistent code style.

### Changed

- **Workspace concurrency** — Root scripts (`build`, `typecheck`, `lint`) now use `--workspace-concurrency=4` to prevent CI OOM from launching all 27 TypeScript compiler processes simultaneously.
- **All documentation reviewed and validated** — SECURITY.md, ARCHITECTURE.md, COMMAND_REFERENCE.md, TROUBLESHOOTING.md, CORE_CONCEPTS.md, PROVIDER_INTEGRATION.md, SUBSYSTEM_CONTRACTS.md, EXTENSION_SDK.md — all production quality.
- **README.md rebuilt** — Professional, scannable, developer-focused with architecture overview, roadmap, and guided quick start
- **COMMAND_REFERENCE.md streamlined** — More concise descriptions, consistent formatting, reduced redundancy
- **README header titles normalized** — All doc headers use short, consistent titles ("Architecture" not "Autic Architecture")

### Security

- `validate-security` — All 21 security checks pass (vault, sanitizer, permissions, provider security, offline mode, BYOK isolation)
- `security-audit` — Comprehensive audit framework operational

### Validation

- `validate all` — 5/5 suites pass (Runtime Integration, Provider Simulation, Orchestration, Security Validation, Long-Session Stability)
- `audit` — 7/7 checks pass (Health, Orchestration, Queue, Provider, Recovery, Memory, Safety)
- `recovery` — All crash recovery checks pass (interrupted workflow, corrupted session, partial queue, failed agent)
- `regression` — 16/16 checks pass, no regressions detected (Architecture, Orchestration, Provider, Memory, Security)

### Infrastructure

- GitHub Actions CI configured: Node.js 20/22, pnpm 9, `--frozen-lockfile`, build, typecheck, lint, format:check
- `npm pack` validated — `autic-cli-0.1.0.tgz` generates correctly with `bin: autic -> ./dist/index.js`
- Temp artifacts cleaned (old RC reports, build tarballs)

---

## [0.1.0-dev] — 2026-05-28

### Added

- Initial development release — CLI-native autonomous AI engineering runtime
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

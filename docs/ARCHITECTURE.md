# Autic Architecture

> **Version:** 0.1.0 | **Last Updated:** May 2026

## Overview

Autic is a production-grade CLI-native autonomous AI engineering runtime. It provides a deterministic, local-first platform for AI-assisted software engineering with a modular layered architecture.

```
┌──────────────────────────────────────────────────────────┐
│                    CLI Layer (autic)                       │
│  Commander-based CLI with 40+ commands, color output     │
├──────────────────────────────────────────────────────────┤
│                 Orchestration Layer                        │
│  Neuro Brain → Role Agents → Controlled Swarm → Pipeline │
├──────────────────────────────────────────────────────────┤
│                Execution Runtime                           │
│  Workflow Engine → Provider Router → Context Manager     │
├──────────────────────────────────────────────────────────┤
│               Security & Privacy Layer                     │
│  Vault → Permission Engine → Sanitizer → Profile Guard   │
├──────────────────────────────────────────────────────────┤
│              Stability & Hardening Layer                   │
│  Watchdog → Recovery → Deadlock Protect → Memory Guard   │
├──────────────────────────────────────────────────────────┤
│           Diagnostics & Observability Layer                │
│  Doctor → Observability → Audit → Profiling → Telemetry  │
├──────────────────────────────────────────────────────────┤
│           Validation & Certification Layer                 │
│  Workflow Validate → Chaos → Regression → Certify        │
├──────────────────────────────────────────────────────────┤
│              Ecosystem & Extensibility                     │
│  SDK → Extension Registry → Governance → Templates       │
├──────────────────────────────────────────────────────────┤
│              Release & Distribution                        │
│  Release Channels → Update Manager → Operations          │
└──────────────────────────────────────────────────────────┘
```

## Layer Architecture

### 1. CLI Layer (`apps/cli`)

The entry point. Commander-based CLI with 40+ commands organized across development phases.

**Key components:**
- `src/index.ts` — Main entry with all command registration
- `src/commands/` — Individual command implementations
- `src/constants.ts` — CLI name, version, description
- `@autic/ui` — Color output, headings, dividers

**Commands by category:**

| Category | Commands |
|----------|----------|
| **Core** | `init`, `chat`, `fix`, `run`, `build` |
| **Manage** | `providers`, `models`, `sessions`, `skills`, `config`, `profile` |
| **Orchestrate** | `workflow`, `orchestrate`, `swarm` |
| **Security** | `security`, `privacy`, `validate-security`, `security-audit` |
| **Diagnostics** | `doctor`, `stability`, `memory`, `diagnose`, `observability`, `telemetry` |
| **Validate** | `validate`, `audit`, `stress`, `system`, `recovery`, `regression`, `workflow-validate`, `chaos`, `longrun`, `platform-certify` |
| **System** | `debug`, `fs`, `protect`, `swarm-hardening`, `context`, `learning` |
| **Ecosystem** | `docs`, `template`, `release`, `governance`, `ecosystem`, `profiling` |

### 2. Orchestration Layer

The brain of Autic — handles multi-agent coordination, pipeline execution, and controlled swarm operations.

**Key packages:**
- `@autic/orchestrator` — Neuro Brain, role-based agents, pipeline system
- `@autic/swarm` — Controlled multi-agent coordination
- `@autic/workflow` — Autonomous workflow execution engine

**Architecture pattern:** Director → Manager → Executor with hierarchical delegation and deterministic state machines.

### 3. Execution Runtime

Handles provider communication, context management, and autonomous execution.

**Key packages:**
- `@autic/runtime` — Core autonomous execution, task management, session handling
- `@autic/provider` — Provider abstraction, OpenRouter/Ollama integration, model routing
- `@autic/context` — Token optimization, context engineering, caching

### 4. Security & Privacy Layer

Defense-in-depth security with multiple independent validation layers.

**Key packages:**
- `@autic/vault` — Encrypted secret storage, BYOK architecture
- `@autic/sanitization` — Secret redaction from logs/outputs
- `@autic/permissions` — Permission scopes, trust profiles

**Security principles:**
- BYOK (Bring Your Own Key) — secrets stay local
- Defense in depth — multiple independent check layers
- Least privilege — granular permission scopes
- Transparent auditing — all security events logged

### 5. Stability & Hardening Layer

Production-grade reliability systems for long-running autonomous operations.

**Key packages:**
- `@autic/hardening` — Watchdog, recovery, deadlock protection, memory leak detection, stress testing
- `@autic/recovery` — Crash recovery, queue restoration, session continuity

### 6. Diagnostics & Observability Layer

Comprehensive runtime introspection and production telemetry.

**Key packages:**
- `@autic/diagnostics` — Doctor, observability, security validation, documentation generation
- `@autic/profiling` — CPU/memory/queue/provider latency profiling, performance baselines
- `@autic/telemetry` — Privacy-safe, opt-in, anonymized runtime metrics

### 7. Validation & Certification Layer

Operational validation for real-world production readiness.

**Key packages:**
- `@autic/validation` — Workflow validation, chaos testing, long-run testing, regression prevention, recovery validation, platform certification

### 8. Ecosystem & Extensibility

Safe plugin architecture with governance and lifecycle management.

**Key packages:**
- `@autic/sdk` — Extension manifest, lifecycle, loader, registry, plugin sandbox, API hooks, permission management
- `@autic/governance` — Extension governance, security audit, ecosystem maintenance
- `@autic/templates` — Project scaffolding templates

### 9. Release & Distribution

Release management and update distribution infrastructure.

**Key packages:**
- `@autic/release` — Release channels (stable/beta/dev), update checking, version management, release operations

## Data Flow

```
User Input
    │
    ▼
CLI (Commander)
    │
    ├─→ Simple command → Direct execution (doctor, status, etc.)
    │
    └─→ Workflow command → Orchestrator
                              │
                              ├─→ Provider Router → LLM API
                              │
                              ├─→ Context Manager → Session Store
                              │
                              └─→ Watchdog/Recovery → Resilience
```

## Key Design Decisions

1. **Local-first** — All processing happens on-device. No cloud dependency.
2. **BYOK** — Users bring their own API keys. No vendor lock-in.
3. **Deterministic orchestration** — Predictable, auditable execution flows.
4. **Modular packages** — Independent packages with clear interfaces via `@autic/shared`.
5. **Composability** — Commands compose from package functions, not monolithic logic.
6. **Transparency** — All operations are inspectable via observability and audit systems.

## Package Dependency Graph

```
@autic/shared (no deps)
    ↑
@autic/ui, @autic/vault, @autic/sanitization
    ↑
@autic/provider, @autic/context, @autic/permissions
    ↑
@autic/runtime, @autic/workflow
    ↑
@autic/orchestrator, @autic/swarm
    ↑
@autic/hardening, @autic/recovery
    ↑
@autic/diagnostics, @autic/profiling, @autic/telemetry
    ↑
@autic/validation, @autic/governance
    ↑
@autic/sdk, @autic/templates, @autic/release
    ↑
apps/cli
```

## Module System

All packages are ES modules (`"type": "module"`) with TypeScript project references (`composite: true`). Each package has a clean public API exported from `src/index.ts`.

## Testing & Validation

Unit tests live alongside source code (`.test.ts`). Validation packages provide automated checks against production scenarios, regressions, and security boundaries.

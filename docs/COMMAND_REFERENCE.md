# Command Reference

> Version: 0.1.0 | Complete reference for all Autic CLI commands.

## Getting Help

```bash
autic help                    # General help overview
autic <command> --help        # Command-specific help
autic docs                    # Generate full documentation
```

---

## Core Commands

### `autic init`

Initialize Autic in the current directory.

```bash
autic init [--force]
```

**Options:**

- `--force` — Force reinitialization

**Example:**

```bash
autic init
autic init --force
```

### `autic chat`

Start an interactive chat session with an AI model.

```bash
autic chat [options]
```

**Options:**

- `-m, --model <model>` — Model to use
- `-p, --provider <provider>` — Provider to use
- `-s, --session <session>` — Session ID to restore
- `-f, --file <file>` — Context file to load

**Example:**

```bash
autic chat
autic chat --model gpt-4o --provider openrouter
autic chat --session my-session
```

### `autic fix`

Run autonomous fix workflow on a target.

```bash
autic fix [options]
```

**Options:**

- `-t, --target <path>` — Target directory or file
- `-m, --model <model>` — Model to use
- `--dry-run` — Preview changes without applying

**Example:**

```bash
autic fix --target src/
autic fix --target src/index.ts --dry-run
```

### `autic run`

Execute a task or script.

```bash
autic run [script] [options]
```

**Options:**

- `-m, --model <model>` — Model to use

**Example:**

```bash
autic run test
autic run build --model gpt-4o
```

### `autic build`

Build the current Autic workspace.

```bash
autic build [options]
```

**Options:**

- `--watch` — Watch for changes
- `--clean` — Clean previous build first

**Example:**

```bash
autic build
autic build --watch
autic build --clean
```

---

## Provider Management

### `autic providers`

List and manage LLM providers.

```bash
autic providers [action] [name] [options]
```

**Actions:** `list` (default), `check`, `add`, `remove`

**Options:**

- `-k, --key <key>` — API key (for add)
- `-u, --url <url>` — Base URL (for add)

**Example:**

```bash
autic providers
autic providers add openrouter --key sk-or-...
autic providers check
```

### `autic models`

Search, install, list models, and show capabilities.

```bash
autic models [action] [name]
```

**Actions:** `list` (default), `search`, `install`, `capabilities`

**Example:**

```bash
autic models
autic models search gpt-4
```

---

## Session Management

### `autic sessions`

Create, list, and restore sessions.

```bash
autic sessions [action] [name]
```

**Actions:** `list` (default), `create`, `restore`

**Example:**

```bash
autic sessions
autic sessions restore <session-id>
```

### `autic context`

Advanced context engineering and token optimization system.

```bash
autic context [action] [options]
```

**Actions:** `status` (default), `inspect`, `optimize`, `safety`, `cache`, `reset`

**Options:**

- `-t, --target <path>` — Target for optimize action

**Example:**

```bash
autic context status
autic context reset
```

---

## Workflow & Orchestration

### `autic workflow`

Run an autonomous engineering workflow.

```bash
autic workflow [goal] [options]
```

**Options:**

- `--steps <n>` — Max execution steps (default: 20)
- `--timeout <ms>` — Workflow timeout in ms (default: 300000)
- `--allow-dangerous` — Allow potentially dangerous operations
- `--verbose` — Show detailed execution events

**Example:**

```bash
autic workflow "Add error handling to API routes"
autic workflow "Refactor database layer" --steps 15
```

### `autic orchestrate`

Run the full R&D pipeline system.

```bash
autic orchestrate [goal] [options]
```

**Pipeline:** Research → Plan → Architect → Engineer → Verify → Repair → Final Review

**Options:**

- `--pipeline <id>` — Pipeline to use (full-development, analysis-only, engineering-only)
- `--stage <name>` — Execute a single pipeline stage
- `--verbose` — Show detailed execution events

**Example:**

```bash
autic orchestrate "Build a REST API"
autic orchestrate "Review architecture" --pipeline analysis-only
```

### `autic swarm`

Controlled multi-agent swarm orchestration and coordination.

```bash
autic swarm [action]
```

**Actions:** `status` (default), `inspect`, `pipelines`, `safety`, `start`, `stop`, `pause`, `resume`

**Example:**

```bash
autic swarm status
autic swarm start --goal "Refactor codebase"
```

---

## Security

### `autic security`

View and manage security settings, trust profiles, and permissions.

```bash
autic security [action] [sub] [options]
```

**Actions:** `status` (default), `profile`, `permissions`, `events`, `vault`

**Options:**

- `--limit <n>` — Event limit (for events action)

**Example:**

```bash
autic security
autic security profile set safe
autic security events --limit 50
```

### `autic privacy`

Configure privacy mode.

```bash
autic privacy [action] [mode]
```

**Actions:** `status` (default), `set`, `help`
**Modes:** `normal`, `local_only`, `offline`

**Example:**

```bash
autic privacy
autic privacy set local_only
```

### `autic validate-security`

Run security validation checks.

```bash
autic validate-security
```

### `autic security-audit`

Run comprehensive security audit.

```bash
autic security-audit [action]
```

**Actions:** `all` (default), `permissions`, `vault`, `sanitization`, `commands`, `boundaries`

**Example:**

```bash
autic security-audit
autic security-audit --action vault
```

---

## Diagnostics & Health

### `autic doctor`

Run comprehensive environment diagnostics.

```bash
autic doctor
```

### `autic stability`

Monitor runtime health, performance, and stability.

```bash
autic stability [action]
```

**Actions:** `status` (default), `health`, `resources`, `metrics`, `loops`, `processes`, `cleanup`

**Example:**

```bash
autic stability health
autic stability resources
```

### `autic observability`

View system observability snapshots.

```bash
autic observability [action]
```

**Actions:** `health` (default), `orchestration`, `queue`, `provider`, `context`, `learning`, `events`

**Example:**

```bash
autic observability
autic observability provider
```

### `autic memory`

Detect memory leaks in workers and runtime.

```bash
autic memory [action]
```

**Actions:** `check` (default), `start` (continuous monitoring)

**Example:**

```bash
autic memory check
```

---

## Profiling & Performance

### `autic profiling`

Run runtime profiling and performance baselines.

```bash
autic profiling [action]
```

**Actions:** `all` (default), `cpu`, `memory`, `queue`, `provider`, `orchestration`, `baseline`, `compare`

**Example:**

```bash
autic profiling
autic profiling baseline
autic profiling compare
```

### `autic diagnose`

View error diagnostics reports and CLI UX hardening status.

```bash
autic diagnose [action]
```

**Actions:** `errors` (default), `ux`

**Example:**

```bash
autic diagnose
```

---

## Validation & Testing

### `autic validate`

Run production validation suite or release readiness checks.

```bash
autic validate [action]
```

**Actions:** `all` (default), `suite`, `release`

**Example:**

```bash
autic validate all
```

### `autic audit`

Run comprehensive runtime audit.

```bash
autic audit [action]
```

**Actions:** `run` (default), `health`

**Example:**

```bash
autic audit
```

### `autic stress`

Run long-workflow stress tests.

```bash
autic stress [action]
```

**Actions:** `run` (default)

### `autic regression`

Run regression prevention checks.

```bash
autic regression [action]
```

**Actions:** `all` (default), `architecture`, `orchestration`, `provider`, `memory`, `security`

**Example:**

```bash
autic regression
autic regression --action security
```

### `autic workflow-validate`

Validate workflows against real project types.

```bash
autic workflow-validate [action]
```

**Actions:** `all` (default), `typescript`, `nextjs`, `python`, `saas`, `monorepo`, `cli`

**Example:**

```bash
autic workflow-validate typescript
```

### `autic chaos`

Run provider chaos testing.

```bash
autic chaos [action]
```

**Actions:** `all` (default), `outage`, `auth`, `slow`, `rate-limit`, `partial`, `degraded`

**Example:**

```bash
autic chaos
autic chaos outage
```

### `autic longrun`

Run long-running autonomous tests.

```bash
autic longrun [action]
```

**Actions:** `all` (default), `workflow`, `repair`, `queue`, `orchestration`, `memory`

**Example:**

```bash
autic longrun
```

### `autic recovery`

Validate crash recovery capabilities.

```bash
autic recovery [action]
```

**Actions:** `check` (default)

**Example:**

```bash
autic recovery
```

---

## Ecosystem & Extensions

### `autic ecosystem`

Ecosystem maintenance tooling.

```bash
autic ecosystem [action]
```

**Actions:** `all` (default), `diagnostics`, `compat`, `audit`, `plugins`

**Example:**

```bash
autic ecosystem diagnostics
autic ecosystem compat
```

### `autic governance`

Manage extension governance.

```bash
autic governance [action]
```

**Actions:** `all` (default), `trust`, `permissions`, `compat`, `unsafe`, `isolation`

**Example:**

```bash
autic governance
autic governance permissions
```

### `autic template`

Scaffold a new project from a built-in template.

```bash
autic template <template> [target]
```

**Templates:** `saas-starter`, `cli-starter`, `api-starter`, `ai-tool-starter`, `list`

**Example:**

```bash
autic template cli-starter my-cli
autic template list
```

---

## System & Maintenance

### `autic config`

Manage Autic configuration.

```bash
autic config [action] [key] [value]
```

**Actions:** `status` (default), `get`, `set`, `list`

**Example:**

```bash
autic config
autic config set openrouter.timeout 120000
```

### `autic profile`

Manage developer profiles.

```bash
autic profile [action] [profile]
```

**Actions:** `status` (default), `list`, `set`, `describe`
**Profiles:** `safe`, `balanced`, `full_auto`, `local_only`

**Example:**

```bash
autic profile
autic profile set balanced
```

### `autic protect`

Manage provider hardening, execution safety, security posture.

```bash
autic protect [action]
```

**Actions:** `providers` (default), `safety`, `security`, `stall`

**Example:**

```bash
autic protect
```

### `autic system`

View performance metrics, CLI resilience status, and context hardening.

```bash
autic system [action]
```

**Actions:** `perf` (default), `resilience`, `context`

**Example:**

```bash
autic system
```

### `autic fs`

Validate filesystem safety.

```bash
autic fs [action] [path]
```

**Actions:** `check` (default), `path`

**Example:**

```bash
autic fs check
```

### `autic swarm-hardening`

Validate swarm stability.

```bash
autic swarm-hardening [action]
```

**Actions:** `check` (default)

---

## Learning & Skills

### `autic learning`

Engineering learning and operational intelligence system.

```bash
autic learning [action]
```

**Actions:** `status` (default), `inspect`, `clear`, `disable`, `enable`

**Example:**

```bash
autic learning status
```

### `autic skills`

List, install, remove, and run skills.

```bash
autic skills [action] [name] [options]
```

**Actions:** `list` (default), `install`, `remove`, `run`

**Options:**

- `-g, --goal <goal>` — Goal for run action

**Example:**

```bash
autic skills list
autic skills run my-skill --goal "Do something"
```

---

## Documentation

### `autic docs`

Generate command documentation and guides.

```bash
autic docs [action]
```

**Actions:** `all` (default), `commands`, `providers`, `troubleshooting`, `examples`, `single`, `architecture`, `contracts`, `sdk`, `security`, `concepts`

**Example:**

```bash
autic docs
autic docs architecture
autic docs sdk
autic docs security
```

---

## Release & Updates

### `autic release`

Manage release channels and check for updates.

```bash
autic release [action] [value]
```

**Actions:** `status` (default), `check`, `channel`, `versions`

**Channels:** `stable`, `beta`, `dev`

**Example:**

```bash
autic release
autic release check
autic release channel beta
```

### `autic update`

Check for Autic updates and manage versions.

```bash
autic update [action]
```

**Actions:** `check` (default), `info`, `version`

**Example:**

```bash
autic update
```

### `autic platform-certify`

Run platform certification checks.

```bash
autic platform-certify [action]
```

**Actions:** `all` (default), `local-first`, `byok`, `offline`, `orchestration`, `security`, `ecosystem`

**Example:**

```bash
autic platform-certify
```

---

## Debugging & Telemetry

### `autic debug`

Debugging, tracing, and platform information utilities.

```bash
autic debug [action] [value]
```

**Actions:** `mode` (default), `platform`, `trace`

**Example:**

```bash
autic debug platform
```

### `autic telemetry`

Manage safe optional telemetry.

```bash
autic telemetry [action]
```

**Actions:** `status` (default), `enable`, `disable`, `report`, `clear`

**Example:**

```bash
autic telemetry status
autic telemetry enable
```

### `autic help`

Show detailed help for Autic commands.

```bash
autic help [topic]
```

**Topics:** Any command name

**Example:**

```bash
autic help
autic help providers
```

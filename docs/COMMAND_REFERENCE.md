# Command Reference

> **Version:** 0.1.0 | Complete reference for all Autic CLI commands.

## Getting Help

```bash
autic --help                # List all commands
autic <command> --help      # Command-specific help
autic help <command>        # Detailed help for a command
autic docs                  # Generate full documentation set
```

---

## Core Commands

### `autic init`

Initialize Autic in the current directory. Creates `.autic/` structure, detects project framework.

```bash
autic init [--force]
```

### `autic chat`

Start an interactive AI chat session.

```bash
autic chat [options]
```

**Options:** `-m, --model <model>` · `-p, --provider <provider>` · `-s, --session <id>` · `-f, --file <path>`

### `autic fix`

Run autonomous fix workflow on a target.

```bash
autic fix --target <path> [--dry-run] [-m, --model <model>]
```

### `autic run`

Execute a task or script with optional AI assistance.

```bash
autic run <script> [-m, --model <model>]
```

### `autic build`

Build the current Autic workspace.

```bash
autic build [--watch] [--clean]
```

---

## Provider Management

### `autic providers`

List, add, remove, and check LLM providers.

```bash
autic providers              # List configured providers
autic providers check        # Test provider connectivity
autic providers add <name>   # Add provider (--key, --url)
autic providers remove <name>
```

**Supported providers:** `openrouter`, `openai`, `anthropic`, `ollama`

### `autic models`

Search, list, and inspect available models.

```bash
autic models                 # List available models
autic models search <query>  # Search for models
autic models install <name>  # Install a model (Ollama)
```

---

## Session Management

### `autic sessions`

Create, list, and restore sessions.

```bash
autic sessions               # List active sessions
autic sessions create <name> # Create a new session
autic sessions restore <id>  # Restore an existing session
```

### `autic context`

Context engineering and token optimization.

```bash
autic context status         # View context state
autic context reset          # Clear context cache
autic context optimize       # Optimize token usage
```

---

## Workflow & Orchestration

### `autic workflow`

Run an autonomous engineering workflow.

```bash
autic workflow <goal> [--steps <n>] [--timeout <ms>]
```

### `autic orchestrate`

Run the full R&D pipeline: Research → Plan → Architect → Engineer → Verify → Repair → Review.

```bash
autic orchestrate <goal> [--pipeline <id>] [--stage <name>]
```

### `autic swarm`

Controlled multi-agent swarm coordination.

```bash
autic swarm [status|start|stop|pause|resume|inspect|pipelines|safety]
```

---

## Security

### `autic security`

Manage security settings, trust profiles, and permissions.

```bash
autic security                      # View security status
autic security profile <profile>    # Set trust profile
autic security permissions          # View permissions
autic security vault                # Encrypted vault status
autic security events [--limit <n>] # View security events
```

**Trust profiles:** `safe` (read-only) · `balanced` (workspace access, default) · `full_auto` (full system) · `local_only` (offline)

### `autic privacy`

Configure privacy mode.

```bash
autic privacy                    # View current mode
autic privacy set <mode>         # Set mode
```

**Modes:** `normal` · `local_only` · `offline`

### `autic validate-security`

Run all 21 security validation checks (vault, sanitization, permissions, extensions, providers).

```bash
autic validate-security
```

### `autic security-audit`

Comprehensive security audit across all layers.

```bash
autic security-audit [all|permissions|vault|sanitization|commands|boundaries]
```

---

## Diagnostics & Health

### `autic doctor`

Full environment diagnostics — system, providers, security, and network.

```bash
autic doctor                 # Full diagnostics
autic doctor quick           # Quick system + provider check
autic doctor validate        # Installation validation
```

### `autic audit`

Comprehensive runtime audit — health, orchestration, queue, provider, memory, safety.

```bash
autic audit                  # Full audit
```

### `autic observability`

Runtime system snapshots.

```bash
autic observability                  # Runtime health
autic observability <subsystem>      # Subsystem snapshot
```

**Subsystems:** `health` · `orchestration` · `queue` · `provider` · `context` · `learning` · `events`

### `autic stability`

Runtime health, performance, and stability monitoring.

```bash
autic stability [status|health|resources|metrics|loops|processes|cleanup]
```

### `autic diagnose`

Error diagnostics and CLI UX hardening.

```bash
autic diagnose [errors|ux]
```

### `autic profiling`

Performance profiling — CPU, memory, queue latency, provider latency, baselines.

```bash
autic profiling [all|cpu|memory|queue|provider|orchestration|baseline|compare]
```

---

## Validation & Testing

### `autic validate`

Production validation suite.

```bash
autic validate all           # Full validation suite
autic validate release       # Release readiness check
```

### `autic chaos`

Provider resilience testing — simulate outages, auth failures, rate limits, partial failures.

```bash
autic chaos                          # All scenarios
autic chaos <scenario>               # Single scenario
```

**Scenarios:** `outage` · `auth` · `slow` · `rate-limit` · `partial` · `degraded`

### `autic regression`

Regression prevention across architecture, orchestration, provider, memory, security.

```bash
autic regression [all|architecture|orchestration|provider|memory|security]
```

### `autic workflow-validate`

Validate workflows against real project types.

```bash
autic workflow-validate [all|typescript|nextjs|python|saas|monorepo|cli]
```

### `autic recovery`

Validate crash recovery capabilities.

```bash
autic recovery
```

### `autic longrun`

Long-running autonomous workflow tests.

```bash
autic longrun [all|workflow|repair|queue|orchestration|memory]
```

---

## Ecosystem & Extensions

### `autic ecosystem`

Extension diagnostics, compatibility, audit, and plugin lifecycle management.

```bash
autic ecosystem [all|diagnostics|compat|audit|plugins]
```

### `autic governance`

Extension governance — trust metadata, permission auditing, compatibility, unsafe detection.

```bash
autic governance [all|trust|permissions|compat|unsafe|isolation]
```

### `autic skills`

List, install, remove, and run skills.

```bash
autic skills list            # List installed skills
autic skills install <name>  # Install a skill
autic skills run <name>      # Run a skill (--goal)
```

### `autic template`

Scaffold a new project from a built-in template.

```bash
autic template <template> [target]
autic template list          # List available templates
```

**Templates:** `saas-starter` · `cli-starter` · `api-starter` · `ai-tool-starter`

---

## Configuration & Profiles

### `autic config`

Manage Autic configuration — global, workspace, and profile overrides.

```bash
autic config                     # View configuration
autic config get <key>           # Get a config value
autic config set <key> <value>   # Set a config value
```

### `autic profile`

Manage developer profiles.

```bash
autic profile              # View current profile
autic profile list         # List available profiles
autic profile set <name>   # Set profile
autic profile describe     # Describe current profile
```

**Profiles:** `safe` · `balanced` (default) · `full_auto` · `local_only`

---

## System & Maintenance

### `autic protect`

Provider hardening, execution safety, and security posture.

```bash
autic protect [providers|safety|security|stall]
```

### `autic memory`

Memory leak detection — worker leaks, orphan tracking, growth analysis.

```bash
autic memory [check|start]
```

### `autic system`

Performance metrics, resilience status, and context hardening.

```bash
autic system [perf|resilience|context]
```

### `autic fs`

Filesystem safety validation.

```bash
autic fs [check|path <target>]
```

### `autic swarm-hardening`

Swarm stability validation.

```bash
autic swarm-hardening
```

### `autic debug`

Debugging, tracing, and platform utilities.

```bash
autic debug [mode|platform|trace]
```

---

## Release & Updates

### `autic release`

Manage release channels and check for updates.

```bash
autic release                 # View current channel
autic release check           # Check for updates
autic release channel <name>  # Switch channel
```

**Channels:** `stable` · `beta` · `dev`

### `autic update`

Check for updates and manage versions.

```bash
autic update [check|info|version]
```

### `autic platform-certify`

Platform certification checks — local-first, BYOK, offline, orchestration, security, ecosystem.

```bash
autic platform-certify [all|local-first|byok|offline|orchestration|security|ecosystem]
```

---

## Telemetry

### `autic telemetry`

Manage opt-in anonymized telemetry.

```bash
autic telemetry             # View current status
autic telemetry enable      # Enable (opt-in)
autic telemetry disable     # Disable
autic telemetry report      # View collection report
autic telemetry clear       # Clear collected data
```

Telemetry is **disabled by default**. Only anonymized runtime metrics are collected — never secrets, source code, prompts, or credentials.

---

## Documentation

### `autic docs`

Generate command reference, provider guides, and troubleshooting docs.

```bash
autic docs                       # All documentation
autic docs commands              # Command reference
autic docs providers             # Provider setup guides
autic docs architecture          # Architecture docs
autic docs sdk                   # SDK docs
autic docs security              # Security docs
autic docs troubleshooting       # Troubleshooting guide
```

---

## Platform Certification

### `autic platform-certify`

Run all platform certification checks.

```bash
autic platform-certify [all|local-first|byok|offline|orchestration|security|ecosystem]
```

---

## Exit Codes

| Code  | Meaning          |
| ----- | ---------------- |
| `0`   | Success          |
| `1`   | General error    |
| `2`   | Usage error      |
| `130` | Aborted (SIGINT) |

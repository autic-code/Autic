# Core Concepts

> Version: 0.1.0 | Essential concepts to understand before using Autic.

## What is Autic?

Autic is a **CLI-native autonomous AI engineering runtime** that runs entirely on your machine. It orchestrates AI models to help you build, fix, and manage software projects — all while keeping your code and data local.

## Philosophy

Autic is built on five core principles:

1. **Local-first** — Everything runs on your machine. No cloud dependency, no data exfiltration.
2. **BYOK (Bring Your Own Key)** — You bring your own API keys. No vendor lock-in, no hidden costs.
3. **Deterministic Orchestration** — Predictable, auditable execution flows that you can inspect and control.
4. **Transparency** — Every operation is observable. No black boxes.
5. **Progressive Complexity** — Simple commands for simple tasks, deep capabilities for complex workflows.

## Key Concepts

### Providers

Providers are LLM services that power Autic's AI capabilities. Autic supports:

- **OpenRouter** — Access to 200+ models through a single API (recommended)
- **Ollama** — Local models for offline/private use

```bash
# Add a provider
autic providers add openrouter --key sk-or-...

# List providers
autic providers
```

### Sessions

Sessions maintain context across interactions. Each chat or workflow creates a session that preserves conversation history, decisions, and state.

```bash
# Start a session
autic chat

# List sessions
autic sessions

# Restore a session
autic sessions restore <session-id>
```

### Workflows

Workflows are autonomous execution sequences that accomplish engineering goals. They can range from simple file fixes to complex multi-step refactoring pipelines.

```bash
# Run a workflow
autic workflow "Add error handling to the API routes" --steps 10
```

### Orchestration Pipelines

Pipelines are structured multi-stage execution flows. The default pipeline follows: **Research → Plan → Architect → Engineer → Verify → Repair → Final Review**.

```bash
# Run a full pipeline
autic orchestrate "Build a REST API"

# Run a specific stage
autic orchestrate "Review architecture" --stage plan
```

### Security Profiles

Security profiles control what operations Autic can perform. Profiles range from conservative (`safe`) to permissive (`full_auto`).

```bash
# View current profile
autic security profile

# Change profile
autic security profile set balanced
```

Available profiles:
| Profile | File Access | Command Execution | Network |
|---------|-------------|-------------------|---------|
| `safe` | Read-only | No | No |
| `balanced` | Workspace only | Approved commands | Provider only |
| `full_auto` | Any | Any | Any |
| `local_only` | Workspace only | Approved | Offline |

### Extensions

Extensions are plugins that add capabilities to Autic via the `@autic/sdk`. They hook into runtime, provider, workflow, orchestration, and context events.

```bash
# Manage extensions
autic ecosystem

# Run governance checks
autic governance
```

### Diagnostics & Observability

Autic provides comprehensive runtime introspection:

```bash
# Environment diagnostics
autic doctor

# Runtime health
autic observability health

# Runtime audit
autic audit
```

### Release Channels

Autic uses release channels to manage updates:

- **stable** — Production-ready releases
- **beta** — Pre-release testing
- **dev** — Latest development builds

```bash
# Check current channel
autic release

# Switch channel
autic release channel beta

# Check for updates
autic release check
```

## First Steps

### 1. Initialize

```bash
autic init
```

This creates the `.autic` configuration directory and sets up the workspace.

### 2. Add a Provider

```bash
autic providers add openrouter --key YOUR_API_KEY
```

### 3. Verify Setup

```bash
autic doctor
autic providers check
```

### 4. Start Chatting

```bash
autic chat
```

### 5. Run a Workflow

```bash
autic fix --target src/
```

## Command Structure

Commands follow a consistent pattern:

```bash
autic <command> [action] [arguments] [options]
```

- **`command`** — The operation to perform (e.g., `providers`, `chat`, `fix`)
- **`action`** — A sub-operation (e.g., `add`, `list`, `check`)
- **`arguments`** — Positional parameters
- **`options`** — Flags with `--` prefix

### Help

Every command supports `--help`:

```bash
autic --help
autic providers --help
autic workflow --help
```

## Key Architecture Decisions

### Why CLI-first?

CLI tools integrate naturally into developer workflows, support scripting and CI/CD, and provide the fastest path from command to result.

### Why local-first?

Your source code, secrets, and data stay on your machine. No data is sent to cloud services except LLM API calls (which you explicitly configure).

### Why modular packages?

Each subsystem is an independent package with a clean API. This enables:

- Independent testing and validation
- Clear ownership boundaries
- Gradual learning curve
- Easier contribution

## Next Steps

1. **Explore commands** — Run `autic help` or `autic --help`
2. **Read the docs** — Run `autic docs` to generate full documentation
3. **Try an example** — `autic fix --target src/ --dry-run`
4. **Check health** — `autic doctor`
5. **View observability** — `autic observability`

## Getting Help

```bash
autic help          # General help overview
autic doctor        # Environment diagnostics
autic --version     # Version info
autic release       # Update status
```

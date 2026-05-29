# Contributing to Autic

Thank you for your interest in contributing to Autic! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Include the output of `autic doctor` and `autic --version`
3. Provide clear reproduction steps
4. Include relevant logs or error output

### Suggesting Features

1. Open an issue describing the feature and its use case
2. Explain how it fits into Autic's architecture
3. Include examples of the proposed API or behavior

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes following the coding guidelines
4. Run `pnpm build`, `pnpm typecheck`, and `pnpm format:check` to verify
5. Commit with a clear message describing the change
6. Push and open a pull request against `main`

## Development Setup

### Prerequisites

- **Node.js** >= 20.0.0
- **pnpm** >= 9.0.0 (`npm install -g pnpm`)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/autic/autic.git
cd autic

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Verify the build
pnpm typecheck
pnpm format:check
```

### Project Structure

```
autic/
├── apps/
│   └── cli/              # CLI application (Commander-based)
│       └── src/
│           ├── index.ts           # Entry point with command registration
│           ├── constants.ts       # CLI metadata
│           └── commands/          # Command implementations (40+)
├── packages/
│   ├── shared/           # Shared types and utilities (no deps)
│   ├── ui/               # Terminal UI components
│   ├── providers/        # LLM provider abstraction
│   ├── runtime/          # Core execution runtime
│   ├── workflow/         # Autonomous workflow engine
│   ├── orchestrator/     # Multi-agent orchestration
│   ├── swarm/            # Swarm coordination
│   ├── context/          # Context engineering
│   ├── sessions/         # Session management
│   ├── memory/           # Memory and learning system
│   ├── security/         # Security vault and permissions
│   ├── hardening/        # Stability and hardening
│   ├── diagnostics/      # Diagnostics and observability
│   ├── profiling/        # Performance profiling
│   ├── telemetry/        # Privacy-safe telemetry
│   ├── validation/       # Validation and certification
│   ├── governance/       # Extension governance
│   ├── sdk/              # Extension SDK
│   ├── templates/        # Project scaffolding templates
│   ├── release/          # Release management
│   ├── config/           # Configuration management
│   ├── tools/            # Tool definitions
│   ├── skills/           # Skills system
│   ├── router/           # Provider routing
│   ├── learning/         # Engineering learning
│   ├── context-engine/   # Context engineering engine
│   ├── hardening/        # Safety hardening
│   └── profiling/        # Performance analysis
├── docs/                 # Documentation
├── tsconfig.base.json    # Shared TypeScript config
├── pnpm-workspace.yaml   # Workspace definition
└── package.json          # Root package with scripts
```

## Coding Guidelines

### TypeScript

- **Strict mode** is enforced globally via `tsconfig.base.json`
- All code must pass `pnpm typecheck` with zero errors
- Use explicit types for public APIs; let inference work for internals
- Prefer `interface` over `type` for object shapes
- Use `const` assertions for literal types where appropriate

### ES Modules

- All packages use `"type": "module"` in package.json
- Use `import`/`export` syntax (no CommonJS `require`)
- Include `.js` extensions in relative imports (TypeScript convention for ESM)

### Naming Conventions

- **Packages**: `@autic/<name>` (kebab-case)
- **Classes**: PascalCase (`class SessionManager`)
- **Functions/Variables**: camelCase (`getProviderHealth`)
- **Files**: kebab-case matching exports (`session-manager.ts`)
- **Constants**: UPPER_SNAKE_CASE for magic constants (`MAX_RETRY_COUNT`)

### Package Structure

Each package follows a consistent structure:

```
packages/<name>/
├── src/
│   └── index.ts          # Public API exports
├── tsconfig.json         # Extends ../../tsconfig.base.json
├── package.json          # @autic/<name>, ES module, workspace deps
└── dist/                 # Build output (gitignored)
```

### Testing

- Place tests alongside source files as `.test.ts`
- Tests cover public API contracts and edge cases
- Run `pnpm build && pnpm typecheck` before submitting

### Commit Messages

Use clear, descriptive commit messages:

```
<area>: <brief description>

Examples:
  fix(sessions): correct SessionManager export type
  feat(cli): add --dry-run option to fix command
  docs(readme): update quick start guide
  chore(deps): update typescript to 5.6
```

## Pull Request Checklist

Before submitting, ensure:

- [ ] `pnpm build` passes for all packages
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm format:check` passes
- [ ] Code follows the project's naming and structure conventions
- [ ] Public APIs are documented with JSDoc comments
- [ ] No new dependencies added without discussion
- [ ] Changes are focused on a single concern

## Architecture Decisions

- **Local-First** — All processing happens on-device; no cloud dependency
- **BYOK** — Users bring their own API keys; no vendor lock-in
- **Deterministic Orchestration** — Predictable, auditable execution flows
- **Modular Packages** — Independent packages with clear interfaces via `@autic/shared`
- **Layered Architecture** — Each layer builds on the one below via composition

## Questions?

- Open a [GitHub Discussion](https://github.com/autic/autic/discussions)
- Read the [Architecture](docs/ARCHITECTURE.md) and [Core Concepts](docs/CORE_CONCEPTS.md) docs
- Run `autic help` for CLI guidance

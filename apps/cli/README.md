# @autic/cli

**CLI-native autonomous AI engineering runtime.**

Autic is a developer tool that uses AI models to help you build, fix, and manage software projects — all while keeping your code and data on your machine. You bring your own API keys, and Autic orchestrates the right models and workflows to get the job done.

## Features

- **Multi-Provider AI** — OpenRouter (200+ models) or local Ollama models with automatic fallback
- **Autonomous Workflows** — Fix code, refactor, build features, and more with multi-step AI workflows
- **Local-First Security** — Encrypted vault for API keys, secret sanitization, permission profiles
- **48 CLI Commands** — Providers, models, sessions, workflows, orchestration, security, diagnostics, validation, and more
- **Observability** — Runtime health monitoring, audit trails, profiling, and diagnostics

## Quick Start

```bash
npm install -g @autic/cli

cd my-project
autic init
autic providers add openrouter --key sk-or-...
autic doctor
autic chat
```

**Requirements:** Node.js >= 20

## Documentation

Full documentation is available in the [GitHub repository](https://github.com/autic/autic):

- [README](https://github.com/autic/autic#readme)
- [Command Reference](https://github.com/autic/autic/blob/main/docs/COMMAND_REFERENCE.md)
- [Provider Guide](https://github.com/autic/autic/blob/main/docs/PROVIDER_INTEGRATION.md)
- [Security](https://github.com/autic/autic/blob/main/docs/SECURITY.md)
- [Troubleshooting](https://github.com/autic/autic/blob/main/docs/TROUBLESHOOTING.md)

## License

MIT

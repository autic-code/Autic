# Troubleshooting Guide

> Version: 0.1.0 | Common issues, diagnostics, and recovery procedures for Autic.

## Quick Diagnostic Commands

```bash
# Run full environment diagnostics
autic doctor

# Check runtime health
autic observability health

# View runtime health and resources
autic stability health

# Run security validation
autic validate-security

# Run comprehensive security audit
autic security-audit

# View system observability
autic observability

# Check release status
autic release
```

## Common Issues

### 1. Provider Connection Failures

**Symptoms:**

- Error: "No provider available"
- Timeout errors
- "Failed to connect to provider"

**Diagnosis:**

```bash
# Check configured providers
autic providers

# Test provider connectivity
autic providers check

# View provider health metrics
autic observability provider

# Profile provider latency
autic profiling provider
```

**Solutions:**

1. Verify API keys are configured:
   ```bash
   autic security vault
   ```
2. Re-add provider with correct key:
   ```bash
   autic providers add openrouter --key CORRECT_KEY
   ```
3. Check network connectivity:
   ```bash
   autic doctor
   ```
4. Try different provider:
   ```bash
   autic providers add ollama --url http://localhost:11434
   autic chat --provider ollama
   ```
5. Run chaos test to validate resilience:
   ```bash
   autic chaos
   ```

### 2. Installation & Setup Issues

**Symptoms:**

- Command not found
- Module errors
- Missing dependencies

**Solutions:**

1. Verify installation:
   ```bash
   autic init --force
   ```
2. Check environment:
   ```bash
   autic doctor
   ```
3. Check Node.js version:
   ```bash
   node --version  # Requires >= 18
   ```
4. Reinstall:
   ```bash
   npm install -g @autic/cli
   ```

### 3. Session & Context Problems

**Symptoms:**

- Session not found
- Context loss between commands
- Token limit errors

**Solutions:**

1. List active sessions:
   ```bash
   autic sessions
   ```
2. Restore a specific session:
   ```bash
   autic sessions restore <session-id>
   ```
3. Reset context:
   ```bash
   autic context reset
   ```
4. Check context optimization:
   ```bash
   autic observability context
   autic profiling baseline
   ```

### 4. Permission & Security Issues

**Symptoms:**

- "Permission denied" errors
- Security warnings
- Command blocked

**Solutions:**

1. Check security status:
   ```bash
   autic security status
   ```
2. View trust profile:
   ```bash
   autic security profile
   ```
3. Review security events:
   ```bash
   autic security events --limit 50
   ```
4. Adjust profile:
   ```bash
   autic security profile set safe
   autic security profile set full_auto
   ```
5. Run security audit:
   ```bash
   autic security-audit
   ```

### 5. Performance Issues

**Symptoms:**

- Slow responses
- High memory usage
- Queue backpressure

**Solutions:**

1. Check system resources:
   ```bash
   autic stability resources
   ```
2. Run profiling:
   ```bash
   autic profiling
   ```
3. Clear caches:
   ```bash
   autic context reset
   ```
4. Monitor memory:
   ```bash
   autic memory check
   ```
5. Check queue status:
   ```bash
   autic observability queue
   ```

### 6. Extension/Plugin Issues

**Symptoms:**

- Extension load failures
- Compatibility warnings
- Hook execution errors

**Solutions:**

1. Run extension diagnostics:
   ```bash
   autic ecosystem diagnostics
   ```
2. Check compatibility:
   ```bash
   autic ecosystem compat
   ```
3. Run governance checks:
   ```bash
   autic governance
   ```
4. Check runtime audit:
   ```bash
   autic ecosystem audit
   ```

### 7. Workflow Failures

**Symptoms:**

- Workflow hangs
- Partial completion
- Unexpected behavior

**Solutions:**

1. Check workflow status:
   ```bash
   autic observability orchestration
   ```
2. Validate workflow:
   ```bash
   autic workflow-validate
   ```
3. Run recovery check:
   ```bash
   autic recovery
   ```
4. Check regression status:
   ```bash
   autic regression
   ```

## Advanced Recovery Procedures

### Crash Recovery

```bash
# Check recovery status
autic recovery

# Restore session
autic sessions restore <session-id>

# Run comprehensive recovery validation
autic validate-recovery
```

### Queue Recovery

```bash
# View queue state
autic observability queue

# Run recovery validation
autic recovery
```

### Provider Fallback Recovery

```bash
# Check provider status
autic providers check

# Run resilience validation
autic chaos

# View provider snapshot
autic observability provider
```

## System Health Checks

```bash
# Full runtime audit
autic audit

# Production validation
autic validate all

# Platform certification
autic platform-certify

# Stress test
autic stress
```

## Diagnostics Commands Reference

| Command                   | Purpose                      |
| ------------------------- | ---------------------------- |
| `autic doctor`            | Full environment diagnostics |
| `autic observability`     | Runtime system snapshots     |
| `autic stability`         | Runtime health and resources |
| `autic audit`             | Comprehensive runtime audit  |
| `autic diagnose`          | Error diagnostics            |
| `autic validate-security` | Security validation          |
| `autic security-audit`    | Comprehensive security audit |
| `autic memory`            | Memory leak detection        |
| `autic profiling`         | CPU/memory/latency profiling |
| `autic telemetry`         | Anonymized runtime metrics   |
| `autic regression`        | Regression prevention checks |
| `autic platform-certify`  | Platform certification       |

## Getting Help

```bash
# General help
autic help

# Command-specific help
autic help <command>
autic <command> --help

# Generate documentation
autic docs

# Update information
autic release

# Check version
autic --version
```

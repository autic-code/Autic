# Security Architecture

> Version: 0.1.0 | Security architecture, threat model, and security practices for Autic.

## Security Philosophy

Autic follows a **defense-in-depth** approach with multiple independent layers of security controls. Every layer is independently testable and auditable.

## Security Principles

1. **BYOK (Bring Your Own Key)** — API keys are stored encrypted locally. Autic never collects or transmits your keys.
2. **Least Privilege** — Extensions and commands operate with minimal required permissions.
3. **Defense in Depth** — Multiple independent security layers prevent single-point-of-failure vulnerabilities.
4. **Transparent Auditing** — All security-relevant events are logged and inspectable.
5. **Local-First** — No cloud services required. All processing happens on your machine.

## Security Layers

### Layer 1: Encrypted Vault (`@autic/vault`)

All secrets (API keys, credentials, tokens) are stored in an encrypted vault using AES-256-GCM.

```bash
# View vault status
autic security vault

# Vault is automatically managed
autic providers add openrouter --key YOUR_KEY
```

**Guarantees:**
- Secrets are encrypted at rest
- Decryption only occurs in-memory when needed
- Vault file permissions are restricted to the current user
- No secrets are ever logged or exposed in output

### Layer 2: Secret Sanitization (`@autic/sanitization`)

All runtime output is automatically sanitized to prevent accidental secret exposure.

```bash
# Verify sanitization is active
autic validate-security

# Sanitization happens automatically in:
# - Console output
# - Log files
# - Session history
# - Telemetry (if enabled)
```

**Guarantees:**
- Known patterns (API keys, tokens) are automatically redacted
- Custom patterns can be registered
- Sanitization is applied before any output is emitted

### Layer 3: Permission Management (`@autic/permissions`)

Granular permission controls for all operations.

```bash
# Check current permissions
autic security permissions

# Configure trust profile
autic security profile set balanced
```

**Permission categories:**
| Category | Description |
|----------|-------------|
| `runtime` | Control over runtime operations |
| `provider` | Provider and model access |
| `workflow` | Workflow execution |
| `orchestration` | Pipeline orchestration |
| `context` | Context and session management |
| `filesystem` | File system access |
| `network` | Network operations |

**Trust profiles:**
| Profile | Description |
|---------|-------------|
| `safe` | Read-only operations, no execution |
| `balanced` | Workspace access, approved commands (default) |
| `full_auto` | Full system access |
| `local_only` | Offline operations only |

### Layer 4: Security Profiles

Profiles define the security posture at a higher level than individual permissions.

```bash
# View security status
autic security status

# Set security profile
autic security profile set balanced
```

### Layer 5: Runtime Security Validation

Continuous validation of security boundaries during runtime.

```bash
# Run security validation
autic validate-security

# Comprehensive security audit
autic security-audit
```

**Validation checks:**
1. **Permission Bypass Detection** — Validates that permission boundaries are enforced
2. **Vault Isolation** — Ensures vault cannot be accessed from unauthorized contexts
3. **Sanitization Integrity** — Verifies secret redaction is working correctly
4. **Unsafe Command Handling** — Detects potentially dangerous command patterns
5. **Extension Boundary Enforcement** — Validates extension isolation

### Layer 6: Extension Governance (`@autic/governance`)

Security controls specific to the extension ecosystem.

```bash
# Run governance checks
autic governance

# Audit extension permissions
autic governance permissions

# Check for unsafe extensions
autic governance unsafe
```

**Governance checks:**
- Extension trust metadata validation
- Permission auditing against declared scope
- Compatibility scoring
- Unsafe extension detection
- Runtime isolation validation

## Telemetry Security

If enabled, telemetry is strictly privacy-safe:

```bash
# Check telemetry status
autic telemetry status

# Enable telemetry (opt-in)
autic telemetry enable

# View what would be collected
autic telemetry report
```

**Telemetry data policy:**
- ✅ Anonymized runtime health metrics (uptime, version)
- ✅ Crash categories (error type, count)
- ✅ Provider reliability stats (success rate, avg latency)
- ✅ Workflow performance stats (duration, step count)
- ❌ NEVER: source code, file contents, prompts, API keys, credentials, personal data

## Threat Model

| Threat | Mitigation |
|--------|-----------|
| API key theft | Encrypted vault, memory-only decryption |
| Secret leakage in logs | Automatic sanitization of all output |
| Malicious extensions | Sandboxed execution, permission enforcement, governance checks |
| Unauthorized file access | Filesystem permission controls, profile enforcement |
| Network exfiltration | Profile-based network restrictions, local-first architecture |
| Privilege escalation | Defense-in-depth, independent security layers |
| Session hijacking | Encrypted session storage, vault-backed authentication |

## Security Audit Procedures

```bash
# Quick security check
autic security status

# Comprehensive validation
autic validate-security

# Full security audit
autic security-audit

# Extension governance
autic governance

# Platform certification
autic platform-certify --action security

# View security events
autic security events --limit 100
```

## Reporting Vulnerabilities

If you discover a security vulnerability in Autic:
1. Do not create a public GitHub issue
2. Report via the project's security contact
3. Include a detailed description and reproduction steps

## Security Checklist

Before using Autic in production:
- [ ] Run `autic validate-security` — passes all checks
- [ ] Run `autic security-audit` — no findings
- [ ] Configure appropriate trust profile
- [ ] Verify vault encryption is active
- [ ] Review extension permissions
- [ ] Run `autic platform-certify` — all checks pass
- [ ] Run `autic regression --action security` — no regressions

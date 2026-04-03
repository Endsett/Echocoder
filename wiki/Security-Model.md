# Security Model

EchoCoder implements defense-in-depth security to prevent the AI agent from making unintended or dangerous changes. Every tool call passes through multiple security layers before execution.

---

## Security Layers

```
Tool Call from Agent
       │
       ▼
┌──────────────────┐
│ Tool Interceptor │  Policy-based approval/denial
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sanitizer        │  Input/output cleaning, secret redaction
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sandbox Detector │  Environment-aware policy adjustment
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Sandbox (Stub)   │  Future: containerized execution
└──────────────────┘
```

---

## Tool Interceptor

**File**: `src/security/ToolInterceptor.ts`

The interceptor classifies every tool call into one of four categories and applies tiered approval:

### Tool Categories

| Category | Tools | Default Policy |
|----------|-------|----------------|
| **Read** | `Read`, `Glob`, `Grep`, `LS`, `View` | Auto-approved (configurable) |
| **Write** | `Write`, `Edit`, `MultiEdit` | Requires approval (configurable) |
| **Execute** | `Bash`, `PowerShell`, `Terminal` | Requires approval (configurable) |
| **Network** | `WebFetch`, `WebSearch`, `Fetch`, `Curl` | Blocked unless enabled |

### Sensitive Path Blocking

Writes are **always blocked** (regardless of auto-approve settings) for paths matching:

```
.env, .env.*, .ssh/*, *.pem, *.key
**/credentials/*, **/secrets/*
*password*, *token*, *secret*
```

### Workspace Boundary Enforcement

All write operations are restricted to the current workspace root. Paths that resolve outside the workspace folder are denied.

### Approval Flow

```
Tool Call → Classify Category → Check Auto-Approve Setting
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                   Auto-Approve    Show Prompt     Block (deny)
                   (allowed)       (allow/deny)
```

---

## Sanitizer

**File**: `src/security/Sanitizer.ts`

Processes all input and output to prevent injection and leakage:

| Function | Purpose |
|----------|---------|
| `stripAnsi()` | Remove ANSI escape codes from CLI output |
| `normalizeWorkspacePath()` | Resolve paths and prevent directory traversal |
| `redactSecrets()` | Strip AWS keys, JWTs, and the user's API key from output |
| `truncateOutput()` | Cap tool output at 8000 chars to prevent context explosion |

---

## Sandbox Detector

**File**: `src/security/SandboxDetector.ts`

Detects the current execution environment to adjust security posture:

| Environment | Detection Method | Effect |
|-------------|-----------------|--------|
| GitHub Codespaces | `CODESPACES` env var | Higher autonomy is safe |
| Dev Container | `/.dockerenv` or `REMOTE_CONTAINERS` | Higher autonomy is safe |
| WSL2 | `WSL_DISTRO_NAME` env var | Standard security |
| SSH Remote | `SSH_CLIENT` env var | Standard security |
| Local | Default | Full security enforcement |

When `isIsolated()` returns `true`, the extension logs a notice that higher autonomy is safer in that environment.

---

## Sandbox (Stub)

**File**: `src/security/Sandbox.ts`

Phase 1 stub that acts as a pass-through. Future phases will implement:
- Docker container isolation for bash commands
- File system virtualization
- Network policy enforcement at the container level

Current behavior: `canExecuteSafely()` always returns `true`.

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `echocoder.autoApproveReads` | `true` | Auto-approve read-only tools |
| `echocoder.autoApproveWrites` | `false` | Auto-approve file mutations (sensitive paths still blocked) |
| `echocoder.terminalAutoRun` | `false` | Auto-approve terminal commands |
| `echocoder.allowNetworkTools` | `false` | Allow network tools (still requires approval per-call) |

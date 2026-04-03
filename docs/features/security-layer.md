# Feature: Security Layer (Tool Gating + Sanitization)

## Overview
The Security Layer is the protector of the developer's environment. It ensures that the EchoCoder agent always operates within valid boundaries, never accesses sensitive information without permission, and never performs destructive actions without explicit approval.

## Key Components

### 1. `ToolInterceptor.ts` (Dynamic Policy)
**What it does**: Intercepts every `tool_call` emitted by the agent and checks it against a set of security policies.
- **Rules**:
  - **Read Tools**: Auto-approved if enabled in settings (`read_file`, `list_dir`).
  - **Write Tools**: Always require manual approval for sensitive files (e.g., `.env`, `.ssh`).
  - **Bash/Exec Tools**: Strictly forbidden in basic mode, or require explicit two-factor confirmation.

### 2. `Sanitizer.ts` (Data Redaction)
**What it does**: Cleans up raw LLM responses and logs to ensure no secrets or sensitive terminal output are leaked to potentially untrusted displays.
- **How it works**:
  - Strips ANSI color codes from terminal logs.
  - Normalizes file paths for the user's OS.
  - Redacts potential API keys or credentials using regex patterns.

### 3. `Sandbox.ts` (Execution Isolation)
**What it does**: Provides a base interface for containerized or virtualized execution.
- **Phase 1 Status**: This is a stub that performs pass-through execution, with logic hooks ready for Phase 2's Docker/CodeSpaces integration.

## Implementation Instructions

### Step 1: Policy Enforcement
- Implement a tiered approval logic: `auto` → `confirm` → `block`.
- Sensitive paths should be hardcoded in a "denylist" to prevent any accidental access.

### Step 2: Output Normalization
- Always sanitize terminal `stdout/stderr` before displaying it in the UI to prevent terminal injection.
- Ensure all paths shown in the UI are relative to the workspace root for clarity and security.

### Step 3: Context Privacy
- Ensure the `DiagnosticsEngine` doesn't leak sensitive path information in the prompt.
- Strip user home directory paths (`/Users/username/...`) and replace them with workspace-relative placeholders.

## Verification
1. Try to read a file like `.env`. Verify that the extension shows a security warning.
2. Run a command that produces ANSI colors (e.g., `git log`) and verify the output is clean in the Agent Panel.
3. Check the `logs` to ensure no environment variables were inadvertently logged during tool execution.

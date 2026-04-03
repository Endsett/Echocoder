# Feature: Agent Runtime (Process + Session)

## Overview
The Agent Runtime is the heartbeat of EchoCoder. It manages the lifecycle of the OpenClaude process and ensures that conversation state (sessions) persist across IDE restarts.

## Key Components

### 1. `ProcessManager.ts`
**What it does**: Spawns and manages the `openclaude` child process via `spawn`.
- **Key Method**: `spawn(request, token)`.
- **How it works**:
  - Writes the prompt + context to `stdin`.
  - Ends `stdin` immediately (OpenClaude requirement).
  - Listens for `stdout` chunks and forwards them to the `streamParser`.
  - Handles `abort()` to kill hanging processes.

### 2. `SessionManager.ts`
**What it does**: Tracks conversation turns and persists them to VS Code's `workspaceState`.
- **Key Method**: `injectHistory(prompt)`.
- **How it works**:
  - Appends each turn (prompt + response) to a session array.
  - Injects relevant history into the prompt to provide context without relying on the experimental `--resume` flag.
  - Provides `resetSession()` for a clean slate.

## Implementation Instructions

### Step 1: Process Lifecycle
- Use `node:child_process` to spawn the agent.
- Ensure `utf-8` encoding.
- **Critical**: Always call `child.stdin.end()` after writing the prompt, or the agent will wait indefinitely.

### Step 2: Session Persistence
- Utilize `vscode.ExtensionContext.workspaceState` for serialization.
- Limit history to the last 10-15 turns to avoid context window explosion.

### Step 3: Event Routing
- Emit a `system:init` event upon successful spawn to notify the UI.

## Verification
1. Run `echocoder.newSession`.
2. Send a prompt.
3. Check the `Output` channel to see `ProcessManager` spawning logs.
4. Restart VS Code and verify the session history is still available in the sidebar.

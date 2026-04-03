# Feature: UI Panels (Webviews + Interactions)

## Overview
The UI Layer is the developer's window into EchoCoder. It provides a rich, interactive environment for chatting with the agent, reviewing plans, and exploring session history.

## Key Components

### 1. `AgentPanelProvider.ts` (Sidebar Chat)
**What it does**: Handles the main chat interface between the user and the agent.
- **Key Features**:
  - Streaming markdown rendering (via `marked` or similar).
  - Code block copy-to-clipboard integration.
  - Context indicators for active file and current session.
  - Support for custom slash commands like `/explain`, `/fix`, `/refactor`.

### 2. `PlanViewerProvider.ts` (Structured Workflow)
**What it does**: Visualizes the multi-step plan produced by the Workflow Engine.
- **Key Features**:
  - Logic gates for "Approve" and "Reject" actions.
  - Real-time step progress tracking (Spinners 🔄 and Checkmarks ✅).
  - Risk categorization badges (Low, Medium, High).
  - Integrated "View Diff" links for post-execution review.

### 3. `DiffContentProvider.ts` (Virtual Documents)
**What it does**: Implements the `vscode.TextDocumentContentProvider` for the `echocoder-diff:` scheme.
- **How it works**:
  - Serves "Before" and "After" versions of a modified file as read-only virtual documents.
  - Enables the native `vscode.diff` command to highlight precise agent edits.

### 4. `SessionHistoryProvider.ts` (Tree View)
**What it does**: Displays a list of past conversation sessions in the sidebar.
- **How it works**:
  - Populates a `TreeDataProvider` from the `SessionManager`.
  - Allows users to jump back into a previous session or delete old ones.

## Implementation Instructions

### Step 1: Webview Isolation
- Always use `vscode-resource` or `webview.asWebviewUri` for local assets.
- Use a single `HTML` entry point with a script to handle `acquireVsCodeApi()`.

### Step 2: Messaging Bridge
- Implement a robust communication protocol for `postMessage` (VS Code → Webview) and `onDidReceiveMessage` (Webview → VS Code).
- Always type your messages to ensure consistency in the command palette actions.

### Step 3: Markdown Streaming
- Handle text deltas effectively. 
- Ensure that the webview scrolls to the bottom only when the user hasn't manually scrolled up to read history.

## Verification
1. Press `Ctrl+L` to open the Agent Panel.
2. Send a prompt and verify the "streaming" UI effect.
3. Open a "Plan" and check that the "Approve/Reject" buttons are responsive.
4. Click a "View Diff" link after a file edit and verify the native diff view opens.

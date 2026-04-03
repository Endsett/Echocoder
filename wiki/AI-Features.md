# AI Features

EchoCoder provides five AI-powered coding features, each optimized for a different workflow.

---

## Ghost Text (AI Autocomplete)

**File**: `src/completions/GhostTextProvider.ts`

Real-time code predictions displayed as ghost (greyed-out) text ahead of the cursor.

### How It Works
1. User pauses typing (debounce: 300ms, configurable)
2. The provider extracts surrounding code context
3. A lightweight agent call generates the completion
4. The prediction appears as an `InlineCompletionItem`
5. Press `Tab` to accept, keep typing to dismiss

### Configuration
| Setting | Default | Description |
|---------|---------|-------------|
| `echocoder.ghostText.enabled` | `true` | Enable/disable ghost text |
| `echocoder.ghostText.debounceMs` | `300` | Delay before triggering (100-2000ms) |

### Design Details
- Uses a **separate `ProcessManager` instance** to avoid blocking the main agent
- Completions are **cancelled** if the user types before the agent responds
- Only triggers for files, not output panels or terminals

---

## Inline Edit (Ctrl+K)

**File**: `src/editor/InlineEditController.ts`

Edit selected code by describing what you want in natural language.

### Workflow
1. Select code in the editor
2. Press `Ctrl+K` (or `Ctrl+I`)
3. Type your instruction (e.g., "add error handling", "convert to async/await")
4. The agent generates the edit
5. Changes appear as highlighted decorations with CodeLens buttons
6. Press `Ctrl+Shift+Enter` to accept or `Ctrl+Shift+Backspace` to reject

### Context Included
- Selected code with language identifier
- Surrounding lines for context
- File path and workspace info
- Active diagnostics

---

## Composer Mode (Multi-File Editing)

**Files**: `src/composer/ComposerEngine.ts`, `src/composer/FileChangeTracker.ts`

Orchestrates changes across multiple files as a single atomic operation.

### How It Works
1. User requests a multi-file change (e.g., "refactor the auth module")
2. `FileChangeTracker` accumulates `file_edit` and `file_create` events from the stream
3. If the same file is edited multiple times in one turn, changes are merged
4. After the agent finishes, all changes are applied via `vscode.workspace.applyEdit()` — atomic, undo-able
5. A quickpick dialog shows all affected files for review before applying
6. User can accept all, accept per-file, or cancel

### Smart Path Resolution
- Relative paths are resolved against the workspace root
- Absolute paths are used as-is
- Duplicate edits to the same file are consolidated

---

## Chat Participant (@echo)

**File**: `src/chat/ChatParticipantHandler.ts`

Integrates EchoCoder with VS Code's native Chat API.

### Usage
Type `@echo` in the VS Code Chat panel, followed by your prompt or a slash command:

| Slash Command | Description |
|---------------|-------------|
| `/edit` | Edit selected code with natural language |
| `/explain` | Explain selected code or a concept |
| `/fix` | Auto-fix diagnostics in the current file |
| `/refactor` | Refactor code across files |
| `/test` | Generate tests for selected code |
| `/compose` | Multi-file composer mode |

### Features
- Full streaming response with markdown rendering
- Automatic context enrichment via `PromptAssembler`
- Slash command routing to specialized prompts
- References VS Code's native chat history

---

## AI Terminal

**Files**: `src/terminal/AITerminalManager.ts`, `src/terminal/TerminalOutputCapture.ts`

A dedicated terminal for agent-initiated command execution.

### Features
- **Named terminal**: Appears as "🤖 EchoCoder Terminal" with a robot icon
- **Auto-managed**: Recreated if the user closes it
- **Output capture**: Buffers terminal output (up to 10,000 chars) for agent feedback
- **Security gate**: All commands must pass through `ToolInterceptor` before execution

### Terminal Output Capture
Uses VS Code's proposed `onDidWriteTerminalData` API when available, gracefully degrades when not. The buffer provides the agent with command results for iterative problem-solving.

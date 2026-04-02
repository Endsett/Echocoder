# EchoCoder — AI-Native IDE

> Transform VS Code into a full AI-native IDE powered by OpenClaude. Ghost Text autocomplete, Inline Chat, Composer multi-file editing, and autonomous agent terminal — rivaling Cursor and Windsurf.

## 🚀 Features

### 🤖 Agent Sidebar Panel (Ctrl+L)
Rich chat interface in a dedicated Activity Bar panel. Stream real-time responses, view tool executions, track file changes, and monitor token usage — all in a dark-theme-native UI.

### 👻 Ghost Text Autocomplete
Proactive AI code predictions appear as dimmed "ghost text" while you type. Accept with Tab. Works across all languages using the VS Code InlineCompletionItemProvider API.

### ✏️ Inline Edit (Ctrl+K / Ctrl+I)
Select code, press Ctrl+K, describe what you want changed in natural language. The AI proposes edits shown as green/red inline diff decorations with **Accept / Reject** CodeLens buttons.

### 🎼 Composer Mode
Multi-file agent orchestration — the AI accumulates changes across your entire codebase and applies them atomically via a single `WorkspaceEdit`. One undo reverts everything.

### 💻 AI Terminal
The agent can execute terminal commands autonomously (with configurable security approval). Build errors? Test failures? The agent reads terminal output and iterates.

### 🛡️ Tiered Security
- **Auto-approve**: reads (grep, file reads)  
- **Configurable**: file writes (blocked for `.env`, secrets)  
- **Strict approval**: bash commands, network requests  
- **Environment-aware**: higher autonomy in Dev Containers / Codespaces

### 📊 Status Bar
Real-time model display, token budget meter with color-coded thresholds, and agent activity spinner.

## ⌨️ Keybindings

| Shortcut | Action |
|---|---|
| `Ctrl+L` | Open Agent Panel |
| `Ctrl+K` | Inline Edit |
| `Ctrl+I` | Inline Chat |
| `Ctrl+Shift+K` | Explain Selection |
| `Ctrl+Shift+Enter` | Accept AI Change |
| `Ctrl+Shift+Backspace` | Reject AI Change |

## ⚙️ Configuration

| Setting | Default | Description |
|---|---|---|
| `echocoder.binaryPath` | auto-detect | Path to OpenClaude binary |
| `echocoder.provider` | `anthropic` | AI provider (anthropic/openai/deepseek/ollama/custom) |
| `echocoder.model` | `claude-sonnet-4-20250514` | Model identifier |
| `echocoder.apiKey` | — | Provider API key |
| `echocoder.autoApproveReads` | `true` | Auto-approve read operations |
| `echocoder.autoApproveWrites` | `false` | Auto-approve file writes |
| `echocoder.terminalAutoRun` | `false` | Allow autonomous terminal commands |
| `echocoder.ghostText.enabled` | `true` | Enable Ghost Text predictions |
| `echocoder.maxTokenBudget` | `85` | Auto-compact at this % threshold |

## 🏗️ Architecture

```
VS Code Extension Host (Node.js)
└── extension.ts
    ├── ProcessManager (child_process.spawn → OpenClaude binary)
    │   └── NDJSONParser (stdout → typed AgentEvent objects)
    ├── EventRouter (distributes events to all surfaces)
    ├── AgentPanelProvider (sidebar chat webview)
    ├── ChatParticipantHandler (@echo in native Chat panel)
    ├── GhostTextProvider (inline completion autocomplete)
    ├── InlineEditController (Ctrl+K in-place editing)
    ├── DiffDecorator + CodeLensApprovalProvider (accept/reject)
    ├── ComposerEngine (multi-file atomic WorkspaceEdit)
    ├── AITerminalManager (agent-driven terminal)
    ├── ToolInterceptor (tiered security gate)
    ├── StatusBarManager (token meter + model display)
    └── PromptAssembler (context engineering)
```

## 📦 Requirements

- VS Code 1.100.0+
- OpenClaude CLI binary installed (from [Gitlawb/openclaude](https://github.com/Gitlawb/openclaude.git))
- API key for your chosen provider

## 📄 License

MIT

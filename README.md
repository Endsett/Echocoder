# EchoCoder — AI-Native IDE

<p align="center">
  <strong>Transform VS Code into a full AI-native IDE powered by OpenClaude.</strong><br>
  Ghost Text autocomplete · Inline Chat · Composer · Plan → Execute → Verify
</p>

---

## ✨ Features

| Feature | Shortcut | Description |
|---------|----------|-------------|
| 🤖 **Agent Panel** | `Ctrl+L` | Rich chat sidebar with streaming markdown and tool progress |
| 📋 **Workflow Engine** | — | Plan → Approve → Execute → Verify loop for safe AI execution |
| 👻 **Ghost Text** | — | AI autocomplete predictions as you type |
| ✏️ **Inline Edit** | `Ctrl+K` | Edit selected code with natural language |
| 🎼 **Composer** | — | Multi-file atomic edits via `WorkspaceEdit` |
| 💬 **@echo Chat** | — | Native VS Code Chat participant with slash commands |
| 💻 **AI Terminal** | — | Dedicated terminal for agent commands |
| 🛡️ **Security** | — | Tiered tool approval with sensitive path blocking |

## 🚀 Quick Start

1. Install the `.vsix` extension in VS Code
2. Set your API key in Settings → `echocoder.apiKey`
3. Press `Ctrl+L` to open the Agent Panel
4. Type a prompt and let EchoCoder plan, execute, and verify

## 📖 Documentation

Full documentation is available in the [**Wiki**](https://github.com/Endsett/Echocoder/wiki):

- [Getting Started](https://github.com/Endsett/Echocoder/wiki/Getting-Started)
- [Architecture Overview](https://github.com/Endsett/Echocoder/wiki/Architecture-Overview)
- [Workflow Engine](https://github.com/Endsett/Echocoder/wiki/Workflow-Engine)
- [Security Model](https://github.com/Endsett/Echocoder/wiki/Security-Model)
- [Context Engine](https://github.com/Endsett/Echocoder/wiki/Context-Engine)
- [UI Components](https://github.com/Endsett/Echocoder/wiki/UI-Components)
- [AI Features](https://github.com/Endsett/Echocoder/wiki/AI-Features)
- [Configuration Reference](https://github.com/Endsett/Echocoder/wiki/Configuration-Reference)
- [Development Guide](https://github.com/Endsett/Echocoder/wiki/Development-Guide)

## ⚙️ Configuration

| Setting | Default | Description |
|---|---|---|
| `echocoder.provider` | `anthropic` | Provider: `anthropic`, `openai`, `deepseek`, `ollama`, `custom` |
| `echocoder.model` | `claude-sonnet-4-20250514` | Model identifier |
| `echocoder.apiKey` | — | API key for your provider |
| `echocoder.autoApproveReads` | `true` | Auto-approve read tools |
| `echocoder.autoApproveWrites` | `false` | Auto-approve write tools (sensitive paths always blocked) |
| `echocoder.ghostText.enabled` | `true` | Enable Ghost Text autocomplete |

See the [Configuration Reference](https://github.com/Endsett/Echocoder/wiki/Configuration-Reference) for all settings.

## 🔐 Security Model

- **Reads**: Auto-approved when enabled
- **Writes**: Blocked for `.env`, `.ssh`, credential files, and paths outside workspace
- **Terminal**: Requires explicit approval
- **Network**: Blocked by default
- **Workflow**: Planning phase runs with mutating tools disabled

## 🏗️ Architecture

```
User → PromptAssembler → ProcessManager → NDJSONParser → EventRouter → UI Surfaces
                              ↕
                     OpenClaude CLI (child process)
```

Key modules:
- `WorkflowLoop` — Plan → Approve → Execute → Verify orchestration
- `ProcessManager` — Agent process lifecycle
- `NDJSONParser` — Stream-safe NDJSON parsing
- `EventRouter` — Typed event fan-out
- `ToolInterceptor` — Security policy enforcement

## 🧪 Development

```bash
npm install
npm run build
npm run test:parser
npm run test:workflow
npm run package          # Build .vsix
```

## 📋 Requirements

- VS Code `1.100.0+`
- OpenClaude CLI binary
- Provider API key (or Ollama for local models)

## 📄 License

MIT

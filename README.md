# EchoCoder - AI-Native IDE

EchoCoder is a VS Code extension that runs OpenClaude in print mode and maps its NDJSON event stream into native editor surfaces:
- Native `@echo` chat participant
- Inline edit with accept/reject flow
- Ghost text completions
- Composer-style multi-file apply via one `WorkspaceEdit`

## Features

- Agent sidebar panel (`Ctrl+L`)
- Inline edit (`Ctrl+K`) and inline chat (`Ctrl+I`)
- Explain and diagnostics helper commands
- Composer mode for grouped file edits
- Tool approval policy with read/write/terminal/network controls
- Status bar token usage and run activity

## Configuration

| Setting | Default | Description |
|---|---|---|
| `echocoder.binaryPath` | auto-detect | Absolute path to OpenClaude binary. |
| `echocoder.provider` | `anthropic` | Provider (`anthropic`, `openai`, `deepseek`, `ollama`, `custom`). |
| `echocoder.model` | `claude-sonnet-4-20250514` | Model identifier passed to OpenClaude. |
| `echocoder.apiKey` | empty | API key for selected provider. |
| `echocoder.apiBaseUrl` | empty | Optional base URL for compatible providers. |
| `echocoder.autoApproveReads` | `true` | Auto-approve non-mutating read tools. |
| `echocoder.autoApproveWrites` | `false` | Auto-approve file write/edit tools (still blocks sensitive paths). |
| `echocoder.terminalAutoRun` | `false` | Auto-approve terminal execution tools. |
| `echocoder.allowNetworkTools` | `false` | Permit network tools (`fetch`, `web_search`, etc.). |
| `echocoder.ghostText.enabled` | `true` | Enable ghost text completions. |
| `echocoder.maxTokenBudget` | `85` | Token budget threshold for context warnings. |

## Security Model

- Reads: auto-approved when enabled
- Writes: blocked for sensitive paths (`.env`, `.ssh`, credential/key/token/password patterns) and outside workspace roots
- Terminal: approval required unless `terminalAutoRun` is enabled
- Network: blocked unless `allowNetworkTools` is enabled, then approval required

## Architecture

- `ProcessManager`: canonical spawn/preflight/lifecycle owner
- `NDJSONParser`: parses stream-json safely across fragmented chunks
- `EventRouter`: typed fan-out for all extension surfaces
- `PromptAssembler`: reusable context bundles for chat/edit/completion/compose
- `ToolInterceptor`: extension-mediated tool approval and policy enforcement

## Development

```bash
npm run build
npm run test:parser
```

## Requirements

- VS Code `1.100.0+`
- OpenClaude CLI binary available via settings path or auto-detection
- Provider credentials for non-local providers

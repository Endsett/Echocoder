# Configuration Reference

All EchoCoder settings are under the `echocoder.*` namespace in VS Code Settings.

---

## Provider Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `echocoder.binaryPath` | `string` | `""` (auto-detect) | Absolute path to the OpenClaude binary. Leave empty for PATH-based auto-detection. |
| `echocoder.provider` | `enum` | `"anthropic"` | AI model provider. Options: `anthropic`, `openai`, `deepseek`, `ollama`, `custom` |
| `echocoder.apiKey` | `string` | `""` | API key for the selected provider. |
| `echocoder.apiBaseUrl` | `string` | `""` | Custom API base URL (required for `ollama` and `custom` providers). |
| `echocoder.model` | `string` | `"claude-sonnet-4-20250514"` | Model identifier passed to OpenClaude. |

### Provider-Specific Environment Variables

The extension maps settings to environment variables for the OpenClaude child process:

| Provider | API Key Env | Model Env | Base URL Env |
|----------|------------|-----------|-------------|
| `anthropic` | `ANTHROPIC_API_KEY` | `ANTHROPIC_MODEL` | — |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` | `OPENAI_BASE_URL` |
| `deepseek` | `OPENAI_API_KEY` | `OPENAI_MODEL` | `OPENAI_BASE_URL` (default: `https://api.deepseek.com/v1`) |
| `ollama` | `OPENAI_API_KEY` (set to `"ollama"`) | `OPENAI_MODEL` | `OPENAI_BASE_URL` (default: `http://localhost:11434/v1`) |
| `custom` | `OPENAI_API_KEY` | `OPENAI_MODEL` | `OPENAI_BASE_URL` |

---

## Security Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `echocoder.autoApproveReads` | `boolean` | `true` | Auto-approve read-only tools (Read, Glob, Grep, LS). |
| `echocoder.autoApproveWrites` | `boolean` | `false` | Auto-approve file write/edit tools. Sensitive paths are **always** blocked regardless. |
| `echocoder.terminalAutoRun` | `boolean` | `false` | Allow agent to execute terminal commands without manual approval. ⚠️ Use with caution. |
| `echocoder.allowNetworkTools` | `boolean` | `false` | Allow network tools (fetch, web search). When enabled, each call still requires individual approval. |

---

## Ghost Text Settings

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `echocoder.ghostText.enabled` | `boolean` | `true` | — | Enable AI autocomplete predictions. |
| `echocoder.ghostText.debounceMs` | `number` | `300` | 100–2000 | Delay (ms) before triggering predictions after the user stops typing. |

---

## Context Settings

| Setting | Type | Default | Range | Description |
|---------|------|---------|-------|-------------|
| `echocoder.contextFiles` | `number` | `10` | 1–50 | Maximum files to include in agent context. |
| `echocoder.maxTokenBudget` | `number` | `85` | 50–99 | Token usage percentage threshold for auto-compact warnings. |

---

## JSON Settings Example

```json
{
  "echocoder.provider": "anthropic",
  "echocoder.apiKey": "sk-ant-...",
  "echocoder.model": "claude-sonnet-4-20250514",
  "echocoder.autoApproveReads": true,
  "echocoder.autoApproveWrites": false,
  "echocoder.terminalAutoRun": false,
  "echocoder.allowNetworkTools": false,
  "echocoder.ghostText.enabled": true,
  "echocoder.ghostText.debounceMs": 300,
  "echocoder.contextFiles": 10,
  "echocoder.maxTokenBudget": 85
}
```

---

## Using Local Models with Ollama

```json
{
  "echocoder.provider": "ollama",
  "echocoder.model": "codellama:34b",
  "echocoder.apiBaseUrl": "http://localhost:11434/v1"
}
```

No API key is needed — the extension automatically sets `OPENAI_API_KEY=ollama`.

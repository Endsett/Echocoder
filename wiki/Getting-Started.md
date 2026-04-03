# Getting Started

## Prerequisites

- **VS Code** `1.100.0` or higher
- **Node.js** `18+` (for building from source)
- **OpenClaude CLI** binary — download from [OpenClaude releases](https://github.com/anthropics/claude-code) or build from the included `openclaude/` submodule
- **API Key** for your chosen provider (Anthropic, OpenAI, DeepSeek, or use Ollama for local models)

---

## Installation

### From VSIX (Recommended)

1. Download the latest `echocoder-*.vsix` from [Releases](https://github.com/Endsett/Echocoder/releases)
2. In VS Code, open the Command Palette (`Ctrl+Shift+P`)
3. Run **Extensions: Install from VSIX...**
4. Select the downloaded `.vsix` file

### From Source

```bash
git clone https://github.com/Endsett/Echocoder.git
cd Echocoder
npm install
npm run build
npm run package
# Install the generated .vsix
code --install-extension echocoder-0.1.0.vsix
```

---

## First-Time Setup

### 1. Set Your API Key

Open VS Code Settings (`Ctrl+,`) and search for `echocoder`:

| Setting | Value |
|---------|-------|
| `echocoder.provider` | Choose: `anthropic`, `openai`, `deepseek`, `ollama`, `custom` |
| `echocoder.apiKey` | Your provider's API key |
| `echocoder.model` | Model ID (e.g., `claude-sonnet-4-20250514`, `gpt-4o`) |

### 2. (Optional) Set OpenClaude Binary Path

If auto-detection doesn't find your binary:
```
echocoder.binaryPath = "/path/to/claude"
```

### 3. Open the Agent Panel

Press **`Ctrl+L`** to open the EchoCoder sidebar panel and start chatting.

---

## Quick Feature Tour

| Shortcut | Feature | Description |
|----------|---------|-------------|
| `Ctrl+L` | Agent Panel | Open the main AI chat sidebar |
| `Ctrl+K` | Inline Edit | Edit selected code with AI instructions |
| `Ctrl+I` | Inline Chat | Same as Inline Edit (Phase 1) |
| `Ctrl+Shift+K` | Explain | Explain selected code |
| `Ctrl+Shift+Enter` | Accept Change | Accept a pending AI edit |
| `Ctrl+Shift+Backspace` | Reject Change | Reject a pending AI edit |

### Using the Workflow Engine

1. Type a request in the Agent Panel (e.g., "Add input validation to the login form")
2. EchoCoder generates a **structured plan** with steps and file impacts
3. Review the plan in the **Plan Viewer** panel
4. Click **Approve & Execute** or **Reject Plan**
5. After execution, automated verification runs (TypeScript, lint, tests)

### Using @echo in Chat

Type `@echo` in VS Code's native Chat panel to use slash commands:
- `@echo /edit` — Edit code with AI
- `@echo /explain` — Explain code
- `@echo /fix` — Fix diagnostics
- `@echo /refactor` — Refactor across files
- `@echo /compose` — Multi-file composer mode

# Changelog

## [0.1.0] - 2026-04-03

### Phase 1 Complete 🎉

#### Core Infrastructure
- 🤖 **Agent Runtime** — `ProcessManager` for OpenClaude process lifecycle, spawn, abort, and health validation
- 📡 **Stream Engine** — `NDJSONParser` for safe NDJSON stream parsing with fragment buffering; `EventRouter` for typed event fan-out
- 🧠 **Context Engine** — `PromptAssembler`, `EditorContext`, `DiagnosticsEngine`, `WorkspaceIndexer` for rich prompt construction
- 💾 **Session Manager** — Conversation history tracking with `workspaceState` persistence and `<echo_history>` prompt injection

#### Workflow Engine (Plan → Approve → Execute → Verify)
- 📋 **Planner** — Two-phase planning with `--disallowedTools` for safe plan generation
- ✅ **Approval Gate** — Plan Viewer webview with Approve & Execute / Reject buttons
- ⚡ **Executor** — Full agent execution with per-step progress tracking
- 🔍 **Verifier** — Automated post-execution checks (TypeScript, ESLint/Biome, tests, build)

#### AI Features
- 👻 **Ghost Text** — AI autocomplete via `InlineCompletionItemProvider` with configurable debounce
- ✏️ **Inline Edit** — `Ctrl+K` edit flow with diff decorations and CodeLens Accept/Reject
- 🎼 **Composer** — Multi-file atomic edits via `WorkspaceEdit`
- 💬 **Chat Participant** — `@echo` integration with VS Code Chat API and slash commands
- 💻 **AI Terminal** — Dedicated terminal for agent-initiated commands

#### Security
- 🛡️ **Tool Interceptor** — Tiered approval (read/write/exec/network) with sensitive path blocking
- 🔒 **Sandbox Detector** — Environment detection (Codespaces, Dev Containers, WSL2)
- 🧹 **Sanitizer** — ANSI stripping, path normalization, secret redaction, output truncation
- 📦 **Sandbox** — Execution isolation stub (pass-through in Phase 1)

#### UI
- 🖥️ **Agent Panel** — Rich chat webview with streaming markdown, tool progress, and token meter
- 📊 **Plan Viewer** — Structured plan display with live execution tracking
- 📈 **Status Bar** — Agent status, model display, and token counter
- 📓 **Session History** — Past sessions tree view with `globalState` persistence

#### Developer Experience
- ⚙️ **Multi-provider support** — Anthropic, OpenAI, DeepSeek, Ollama, Custom endpoints
- 🎹 **Keybindings** — `Ctrl+L` (panel), `Ctrl+K` (edit), `Ctrl+I` (chat), `Ctrl+Shift+K` (explain)
- 🧪 **Tests** — Parser and Workflow engine test suites
- 📦 **VSIX packaging** — Single-command `npm run package` distribution

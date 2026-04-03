# Changelog

## [0.1.0] - 2026-04-03

### Phase 1 Complete 🎉

#### Core Infrastructure
- 🤖 Agent Runtime — ProcessManager for OpenClaude process lifecycle
- 📡 Stream Engine — NDJSONParser + EventRouter for typed event fan-out
- 🧠 Context Engine — PromptAssembler, EditorContext, DiagnosticsEngine, WorkspaceIndexer
- 💾 Session Manager — Conversation history with workspaceState persistence

#### Workflow Engine (Plan → Approve → Execute → Verify)
- 📋 Planner — Two-phase planning with `--disallowedTools`
- ✅ Approval Gate — Plan Viewer webview with Approve/Reject buttons
- ⚡ Executor — Full agent execution with per-step progress tracking
- 🔍 Verifier — Automated post-execution checks (tsc, eslint, tests, build)

#### AI Features
- 👻 Ghost Text — AI autocomplete via InlineCompletionItemProvider
- ✏️ Inline Edit — Ctrl+K edit flow with diff decorations and CodeLens
- 🎼 Composer — Multi-file atomic edits via WorkspaceEdit
- 💬 Chat Participant — @echo integration with slash commands
- 💻 AI Terminal — Dedicated terminal for agent commands

#### Security
- 🛡️ Tool Interceptor — Tiered approval with sensitive path blocking
- 🔒 Sandbox Detector — Environment detection (Codespaces, Dev Containers, WSL2)
- 🧹 Sanitizer — ANSI stripping, path normalization, secret redaction
- 📦 Sandbox — Execution isolation stub

#### UI
- 🖥️ Agent Panel — Rich chat webview with streaming markdown and token meter
- 📊 Plan Viewer — Structured plan display with live execution tracking
- 📈 Status Bar — Agent status, model display, and token counter
- 📓 Session History — Past sessions tree view

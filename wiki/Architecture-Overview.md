# Architecture Overview

EchoCoder is a **standalone VS Code extension** (`.vsix`) that bridges the OpenClaude CLI agent into native VS Code surfaces. It does **not** fork VS Code — it runs as a standard extension for easy distribution and fast iteration.

---

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  VS Code Extension Host                                          │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────┐      │
│  │ ProcessMgr  │───▶│ NDJSONParser │───▶│  EventRouter   │      │
│  │ (spawn/     │    │ (stream      │    │ (typed fan-out │      │
│  │  lifecycle) │    │  buffering)  │    │  to surfaces)  │      │
│  └─────────────┘    └──────────────┘    └───────┬────────┘      │
│         │                                       │               │
│         │                          ┌────────────┼──────────┐    │
│         │                          │            │          │    │
│  ┌──────▼──────┐    ┌──────────────▼──┐  ┌─────▼─────┐   │    │
│  │ Workflow    │    │  Agent Panel    │  │ Status Bar│   │    │
│  │ Loop        │    │  (Webview)      │  │ Manager   │   │    │
│  │ ┌────────┐  │    └─────────────────┘  └───────────┘   │    │
│  │ │Planner │  │    ┌─────────────────┐  ┌───────────┐   │    │
│  │ │Executor│  │    │  Plan Viewer    │  │ Session   │   │    │
│  │ │Verifier│  │    │  (Webview)      │  │ History   │   │    │
│  │ └────────┘  │    └─────────────────┘  └───────────┘   │    │
│  └─────────────┘                                          │    │
│         │           ┌──────────────────────────────────────┘    │
│  ┌──────▼──────┐    │                                          │
│  │ Tool        │    │   ┌─────────────┐  ┌───────────────┐    │
│  │ Interceptor │    │   │ Ghost Text  │  │ Inline Edit   │    │
│  │ (security)  │    │   │ Provider    │  │ Controller    │    │
│  └─────────────┘    │   └─────────────┘  └───────────────┘    │
│                     │   ┌─────────────┐  ┌───────────────┐    │
│  ┌─────────────┐    │   │ Composer    │  │ Chat          │    │
│  │ Prompt      │    │   │ Engine      │  │ Participant   │    │
│  │ Assembler   │    │   └─────────────┘  └───────────────┘    │
│  └─────────────┘    │                                          │
│                     └──────────────────────────────────────────┘
└──────────────────────────────────────────────────────────────────┘
         │
         │ NDJSON over stdin/stdout
         ▼
┌──────────────────┐
│  OpenClaude CLI  │
│  (child process) │
└──────────────────┘
```

---

## Module Directory

```
src/
├── extension.ts              # Activation entry point
├── core/
│   ├── ProcessManager.ts     # Agent spawn, lifecycle, abort
│   ├── NDJSONParser.ts       # Stream-safe NDJSON parser
│   ├── EventRouter.ts        # Typed event fan-out
│   ├── SessionManager.ts     # Conversation history management
│   └── workflow/
│       ├── types.ts          # Plan, ExecutionResult, VerificationReport
│       ├── planner.ts        # Phase 1: generate structured plan
│       ├── executor.ts       # Phase 3: execute approved plan
│       ├── verifier.ts       # Phase 4: post-execution checks
│       └── loop.ts           # Orchestrates the full lifecycle
├── context/
│   ├── PromptAssembler.ts    # Builds context-rich prompts
│   ├── EditorContext.ts      # Active file, selection, cursor
│   ├── DiagnosticsEngine.ts  # VS Code diagnostic extraction
│   └── WorkspaceIndexer.ts   # Project type and structure analysis
├── security/
│   ├── ToolInterceptor.ts    # Tool approval and policy enforcement
│   ├── SandboxDetector.ts    # Environment detection
│   ├── Sanitizer.ts          # Input/output cleaning
│   └── Sandbox.ts            # Execution sandbox (stub)
├── ui/
│   ├── AgentPanelProvider.ts # Main chat webview
│   ├── PlanViewerProvider.ts # Plan approval webview
│   ├── StatusBarManager.ts   # Status bar items
│   └── SessionHistoryProvider.ts # Past sessions tree
├── chat/
│   └── ChatParticipantHandler.ts # @echo chat participant
├── commands/
│   └── CommandRegistry.ts    # All commands and keybindings
├── completions/
│   └── GhostTextProvider.ts  # AI autocomplete
├── composer/
│   ├── ComposerEngine.ts     # Multi-file edit orchestration
│   └── FileChangeTracker.ts  # File mutation accumulator
├── editor/
│   ├── InlineEditController.ts # Ctrl+K inline edit
│   ├── DiffDecorator.ts      # Green/red/yellow diff decorations
│   └── CodeLensApprovalProvider.ts # Accept/Reject CodeLens
├── terminal/
│   ├── AITerminalManager.ts  # Dedicated agent terminal
│   └── TerminalOutputCapture.ts # Terminal output buffer
└── types/
    ├── agent-events.ts       # Canonical event types and type guards
    └── config.ts             # Configuration interface and getters
```

---

## Data Flow

1. **User Input** → `PromptAssembler` enriches with context (workspace, editor, diagnostics, session history)
2. **ProcessManager** spawns OpenClaude with the enriched prompt
3. **NDJSONParser** buffers raw stdout into complete JSON lines
4. **EventRouter** normalizes events and fans out to typed listeners
5. **UI Surfaces** (Agent Panel, Status Bar, Plan Viewer) react to events
6. **ToolInterceptor** gates tool calls based on security policy
7. **ComposerEngine** / **DiffDecorator** apply file changes with user approval

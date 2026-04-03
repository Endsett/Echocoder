Module Ownership (RACI + Interfaces)

1) IDE Core & Fork Maintenance

Owner: IDE Platform Lead
Repo: ai-ide/ (fork of Visual Studio Code)
Scope:

Build, patch, and package the fork
Wire new panels (Agent, Plan, Diff, Tasks)
Keyboard shortcuts, commands, menus

Interfaces:

Consumes: workflow/events, agent/events
Exposes: UI commands (runPlan, approvePlan, applyEdits)

Deliverables (Phase 1):

Fork builds locally
Registers 3 panels (Agent, Plan, Output)
Command palette entries
2) Agent Runtime (Process + Session)

Owner: Systems Engineer
Repo: src/core/agent/ (integrates OpenClaude)
Scope:

Spawn + manage agent process
Persistent session (--resume)
STDIO streaming + lifecycle

Interfaces:

Input: RunRequest { prompt, context, sessionId }
Output (stream): AgentEvent

AgentEvent (contract):

{
  "type": "text_delta | tool_call | result | error | usage",
  "data": {}
}

Deliverables:

processManager.ts
sessionManager.ts
Health checks + restart
3) Stream Engine (ND-JSON + Routing)

Owner: Backend/Infra Engineer
Repo: src/core/agent/streamParser.ts
Scope:

Buffer-safe ND-JSON parsing
Event routing to UI + workflow
Backpressure handling

Interfaces:

Consumes: stdout chunks
Emits: AgentEvent (typed)

Deliverables:

Robust parser (newline boundary, partial chunks)
Event router (pub/sub)
4) Context Engine

Owner: Data/Platform Engineer
Repo: src/core/context/
Scope:

Build prompt context from:
workspace folders
active editor + selection
diagnostics
(Phase 1: no AST yet)

Interfaces:

buildContext(): {
  files: string[];
  selection?: string;
  diagnostics?: string[];
  cwd: string;
}

Deliverables:

contextBuilder.ts
diagnostics.ts
workspaceAdapter.ts
5) Workflow Engine (Plan → Execute → Verify)

Owner: AI/Agent Engineer
Repo: src/core/workflow/
Scope:

Enforce phases
Gate execution on approval
Aggregate edits

Interfaces:

runTask(userPrompt): Plan
approvePlan(planId): void
executePlan(planId): ExecutionResult
verify(result): VerificationReport

Deliverables:

planner.ts
executor.ts
verifier.ts
loop.ts
6) Tool Execution & Security

Owner: Security Engineer
Repo: src/core/security/
Scope:

Intercept tool calls
Approval UI hooks
Policy enforcement

Policies:

read → auto
write → confirm (configurable)
bash → strict confirm

Interfaces:

authorize(toolCall): Promise<boolean>

Deliverables:

permissions.ts
sanitizer.ts
sandbox.ts (stub in Phase 1)
7) UI / Experience Layer

Owner: Frontend Engineer
Repo: src/ui/
Scope:

Panels: Agent, Plan, Output
Streaming markdown
Approval dialogs

Interfaces:

Subscribes to AgentEvent
Emits user actions to Workflow

Deliverables:

agentPanel.ts
planViewer.ts
outputChannel.ts

🧭 Phase 1: Detailed Execution Plan (Day 0–1)
🎯 Objective

Working MVP with:

Agent streaming in IDE
Plan → approve → execute loop
Safe tool gating
Context injection
⏱️ Hour-by-Hour Plan
🕐 Hours 0–2 — Repo Setup

All engineers

git clone https://github.com/microsoft/vscode.git ai-ide
cd ai-ide
npm install

git clone https://github.com/Gitlawb/openclaude.git agent/openclaude

IDE Lead

Verify VS Code build:
npm run compile
./scripts/code.sh
🕒 Hours 2–5 — Agent Runtime + Stream

Systems + Infra

Implement processManager.ts
spawn("openclaude", [
  "-p",
  "--output-format", "stream-json"
]);
Critical:
write prompt → stdin
call stdin.end()
Implement streamParser.ts
buffer string
split on \n
safe JSON.parse
🕔 Hours 5–8 — Context Engine

Platform Engineer

Extract:
active file
selection
workspace path
vscode.window.activeTextEditor
vscode.workspace.workspaceFolders
Build prompt template
🕗 Hours 8–12 — Workflow Engine (Core)

AI Engineer

Implement:
1. Planner
runs agent in "plan-only mode"
2. Approval Gate
UI confirmation
3. Executor
runs full execution
🕛 Hours 12–16 — UI Integration

Frontend + IDE Lead

Add:
Agent panel (stream output)
Plan viewer (markdown)
Approval buttons
🕓 Hours 16–20 — Tool Security

Security Engineer

Intercept:

{ "type": "tool_call", "name": "run_bash" }

Show:

vscode.window.showWarningMessage(...)

Block until approved

🕗 Hours 20–22 — End-to-End Flow

Test:

User prompt
Plan generated
Plan approved
Execution runs
Output streamed
🕙 Hours 22–24 — Stabilization
Handle:
JSON parse errors
process crashes
empty context cases
Add logging channel
🧪 Definition of Done (Phase 1)

✔ Agent responds inside IDE
✔ Streaming works without crashes
✔ Plan → approval → execution enforced
✔ Tool calls gated
✔ Context injected correctly

⚠️ Critical Constraints (Do NOT Ignore)
❗ Never allow direct run_bash without approval
❗ Always close stdin after writing
❗ Never parse partial JSON
❗ Keep agent stateless fallback if session fails
🚀 Immediate Next Step

Assign owners → create branches:

feature/agent-runtime
feature/stream-engine
feature/context-engine
feature/workflow-engine
feature/ui-panels
feature/security-layer
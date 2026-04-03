# Workflow Engine

The Workflow Engine is the central orchestration layer that enforces a **Plan → Approve → Execute → Verify** loop for all agent tasks. This prevents the AI from making unreviewed changes to your codebase.

---

## How It Works

```
User Prompt
     │
     ▼
┌─────────────┐
│   PLANNER   │  Agent runs with mutating tools DISABLED
│             │  Produces structured JSON plan
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  APPROVAL   │  Plan displayed in Plan Viewer panel
│   GATE      │  User clicks Approve or Reject
└──────┬──────┘
       │ (Approved)
       ▼
┌─────────────┐
│  EXECUTOR   │  Agent runs with ALL tools enabled
│             │  Tracks per-step progress
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  VERIFIER   │  Runs tsc, eslint, tests, build
│             │  Reports pass/fail
└─────────────┘
```

---

## Phase 1: Planning

**File**: `src/core/workflow/planner.ts`

The planner runs the agent with all mutating tools blocked using `--disallowedTools`:

```
Blocked tools: Write, Edit, Bash, PowerShell, MultiEdit, WebFetch, WebSearch, Fetch, Curl, TodoWrite
```

A system prompt instructs the agent to produce a structured JSON plan:

```json
{
  "summary": "One-line description",
  "risk": "low|medium|high",
  "steps": [
    {
      "index": 1,
      "description": "What this step does",
      "category": "read|write|create|delete|execute|refactor|test|other",
      "affectedFiles": ["path/to/file.ts"],
      "risk": "low"
    }
  ],
  "readFiles": ["files/to/read.ts"],
  "writeFiles": ["files/to/modify.ts"]
}
```

If the agent's output cannot be parsed as structured JSON, a **fallback single-step plan** is created from the raw markdown response.

---

## Phase 2: Approval Gate

**File**: `src/ui/PlanViewerProvider.ts`

The Plan Viewer webview displays the plan with:
- Summary and risk badge (green / yellow / red)
- List of files to be read and written
- Numbered steps with category labels
- **Approve & Execute** and **Reject Plan** buttons

The workflow pauses at the `awaiting_approval` phase until the user makes a decision.

---

## Phase 3: Execution

**File**: `src/core/workflow/executor.ts`

After approval, the executor:
1. Builds an execution prompt that includes the plan steps and the original user request
2. Spawns the agent with **full tool access** (subject to `ToolInterceptor` policies)
3. Tracks file mutations (`file_edit`, `file_create` events) and advances step status
4. Produces an `ExecutionResult` with modified/created file lists and timing

---

## Phase 4: Verification

**File**: `src/core/workflow/verifier.ts`

Post-execution checks run automatically if config files are present:

| Check | Trigger | Command |
|-------|---------|---------|
| TypeScript | `tsconfig.json` exists | `npx tsc --noEmit` |
| ESLint | `.eslintrc.*` or `eslint.config.*` exists | `npx eslint .` |
| Biome | `biome.json` exists | `npx biome check .` |
| Tests | `package.json` has `test` script | `npm test` |
| Build | `package.json` has `build` script | `npm run build` |

Each check has a 30-second timeout and captures stdout/stderr for the verification report.

---

## Workflow State Machine

The `WorkflowLoop` emits phase transitions via `onPhaseChange`:

```
idle → planning → awaiting_approval → executing → verifying → completed
                       │                   │            │
                       └─ (rejected) ──────┴── (error) ─┴──▶ failed → idle
```

### Events

| Event | Fired When |
|-------|-----------|
| `onPhaseChange` | Any phase transition |
| `onPlanReady` | Plan generated, awaiting approval |
| `onExecutionComplete` | Agent execution finished |
| `onVerificationComplete` | All checks finished |
| `onError` | Any workflow error |

---

## Commands

| Command | Description |
|---------|-------------|
| `echocoder.approvePlan` | Approve the current plan and start execution |
| `echocoder.rejectPlan` | Reject the current plan and return to idle |

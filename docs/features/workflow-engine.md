# Feature: Workflow Engine (Plan → Approve → Execute → Verify)

## Overview
The Workflow Engine is the brains of EchoCoder, orchestrating the step-by-step lifecycle of an autonomous agent task. It ensures that every major modification is planned, approved by the developer, executed, and then verified for correctness.

## Key Components

### 1. `Planner.ts`
**What it does**: Runs the agent in "planning mode" to generate a systematic JSON strategy.
- **Key Method**: `generatePlan(prompt)`.
- **How it works**:
  - Injects a restricted prompt that forbids the use of mutating tools (`--disallowedTools`).
  - Expects a strict NDJSON response with the `plan` field.
  - Returns a structured `Plan` object with steps, risk assessment, and file impacts.

### 2. `Executor.ts`
**What it does**: Carries out the implementation phase after the user approves the plan.
- **Key Method**: `execute(plan)`.
- **How it works**:
  - Runs the agent in `compose` mode (full tool access).
  - Tracks individual `PlanStep` progress by watching for `tool_call` and `file_edit` events.
  - Captures `oldContent` and `newContent` for diff previews.

### 3. `Verifier.ts`
**What it does**: Runs automated sanity checks after the execution completes.
- **Key Method**: `verify(executionResult)`.
- **How it works**:
  - Triggers a background build (e.g., `tsc`) or linter.
  - Analyzes output for new errors or warnings.

### 4. `WorkflowLoop.ts`
**What it does**: The state machine that drives the transition between phases.
- **States**: `idle` → `planning` → `awaiting_approval` → `executing` → `verifying` → `completed | failed`.

## Implementation Instructions

### Step 1: Immutable Planning
- Ensure the `Planner` uses a separate agent session that has zero side effects on the filesystem.
- Force the agent to think before writing steps.

### Step 2: Step-Level Tracking
- Update the `PlanStep` status (`running`, `done`, `failed`) based on granular event tracking.
- Emit a `phase_changed` event for UI reactive updates.

### Step 3: Self-Healing (Phase 1+)
- If verification fails, give the user the option to trigger a `repairPlan`.
- This injects the verification error back into the planner to generate a fix-only strategy.

## Verification
1. Prompt "Refactor main.ts to use classes".
2. Verify that a plan appears in the "Plan Viewer" sidebar.
3. Approve the plan and watch the steps turn green one by one.
4. Verify that the agent correctly self-heals if a syntax error is introduced.

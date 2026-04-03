# Feature: Stream Engine (NDJSON + Routing)

## Overview
The Stream Engine is the communication backbone of EchoCoder. It transforms raw, fragmented bytes from the OpenClaude process into high-level, typed events that the UI can easily consume.

## Key Components

### 1. `NDJSONParser.ts`
**What it does**: Parses the incoming stream of NDJSON (Newline Delimited JSON) chunks.
- **Key Method**: `push(chunk)`.
- **How it works**:
  - Buffers incoming string chunks.
  - Splits by newline (`\n`).
  - Gracefully handles partial lines by keeping the last fragment in the buffer.
  - Emits normalized `AgentEvent` objects.

### 2. `EventRouter.ts`
**What it does**: A central hub for distributing events to multiple subscribers (UI, Workflow, Logs).
- **Key Method**: `on(type, callback)`.
- **How it works**:
  - Simple pub/sub pattern.
  - Allows the UI to listen for `text_delta` to stream responses.
  - Allows the Workflow Engine to listen for `tool_call` to track progress.

## Implementation Instructions

### Step 1: Buffer Management
- Never use `JSON.parse` on a raw chunk; it will crash on partial JSON.
- Maintain a `buffer: string` inside the parser class.
- After splitting, if the last element of the split doesn't end with a newline, store it for the next chunk.

### Step 2: Event Normalization
- Map raw OpenClaude events (like `assistant`, `result`) to a consistent `AgentEvent` interface.
- Add metadata like `timestamp` and `session_id` if missing.

### Step 3: Error Resilience
- Wrap `JSON.parse` in a `try/catch`.
- If parsing fails, log the erroneous chunk to the `Output` channel instead of crashing the process.

## Verification
1. Run a long-running prompt (e.g., "Write 10 functions").
2. Verify that the response streams smoothly in the sidebar.
3. Check devtools console for any "JSON parse error" logs during streaming.

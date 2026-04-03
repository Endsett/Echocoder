# Feature: Context Engine (Context Aggregation)

## Overview
The Context Engine is the data aggregator of EchoCoder. It builds a comprehensive view of the developer's work (active file, selection, diagnostics, workspace) and injects it into the agent's prompt to ensure highly relevant responses.

## Key Components

### 1. `PromptAssembler.ts`
**What it does**: Orchestrates the aggregation of multiple context sources into a single XML-tagged prompt.
- **Key Method**: `assembleChatPrompt(prompt)`.
- **How it works**:
  - Tags the user's active editor with `<active_file>`.
  - Injects selected code with `<selection>`.
  - Adds workspace metadata with `<workspace_context>`.
  - Appends diagnostic data with `<diagnostics>`.

### 2. `EditorContext.ts`
**What it does**: Interacts directly with `vscode.window.activeTextEditor` to fetch editor state.
- **Key Method**: `getContext()`.
- **How it works**:
  - Fetches the active file's URI and full text.
  - Returns the zero-indexed line/column cursor position.
  - Grabs selected text for targeted edits.

### 3. `DiagnosticsEngine.ts`
**What it does**: Collects all current errors and warnings from the workspace.
- **Key Method**: `getSummary()`.
- **How it works**:
  - Calls `vscode.languages.getDiagnostics()`.
  - Formats output with severity indicators (❌ for Error, ⚠️ for Warning).
  - Includes `relatedInformation` for better context during complex fixes.

## Implementation Instructions

### Step 1: Resource Limitation
- Never inject the *entire* workspace on every request; it will exceed context windows. 
- Use the `EditorContext` to focus on the active file and recent history.

### Step 2: XML Tagging
- XML tags are the industry standard for LLM context injection.
- Be consistent with tag naming (e.g., `<file path="src/main.ts">... content ...</file>`).

### Step 3: Diagnostic Scrubbing
- Scrub extremely long paths from diagnostics to save tokens.
- Cap the number of diagnostics per file (e.g., 5 errors, 3 warnings).

## Verification
1. Open a specific file and highlight a snippet.
2. Send a prompt "Fix the selection".
3. Verify that the agent correctly identifies the selected text and its surrounding context.
4. Check the `Output` channel to see the assembled XML-tagged prompt sent to the LLM.

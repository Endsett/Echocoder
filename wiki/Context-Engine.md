# Context Engine

The Context Engine is responsible for assembling rich, workspace-aware prompts that give the AI agent full situational awareness about the user's project and editor state.

---

## Components

### PromptAssembler (`src/context/PromptAssembler.ts`)

Central orchestrator that combines context from all sources into a single enriched prompt:

```
User Prompt
     │
     ├── + Workspace Context (project type, structure, CLAUDE.md)
     ├── + Editor Context (active file, selection, cursor)
     ├── + Diagnostics (errors, warnings from VS Code)
     └── + Session History (prior conversation turns)
     │
     ▼
Enriched Prompt → ProcessManager
```

The assembler supports multiple prompt profiles:
- **Chat prompt**: Full context for the Agent Panel
- **Inline edit prompt**: Focused on the selected code and surrounding context
- **Ghost text prompt**: Minimal context for fast autocomplete
- **Compose prompt**: Multi-file context for the Composer

### EditorContext (`src/context/EditorContext.ts`)

Extracts the current editor state:

| Field | Source |
|-------|--------|
| `filePath` | Active editor document URI |
| `language` | Document `languageId` |
| `selection` | Selected text (if any) |
| `cursorLine` | Current cursor line number |
| `surroundingCode` | Lines around the cursor (configurable window) |
| `fileContent` | Full document text (for small files) |

### DiagnosticsEngine (`src/context/DiagnosticsEngine.ts`)

Queries VS Code's diagnostic system and formats issues for the agent:

```
Error (line 42): Property 'foo' does not exist on type 'Bar'. [ts(2339)]
Warning (line 15): 'unused' is assigned but never used. [ts(6133)]
```

Diagnostics are filtered to the active file and limited to prevent context overflow.

### WorkspaceIndexer (`src/context/WorkspaceIndexer.ts`)

Provides project-level context:

| Analysis | Output |
|----------|--------|
| Project type detection | `typescript`, `python`, `rust`, `go`, etc. |
| Structure mapping | Root files, directories, important config files |
| Build system | `package.json`, `Cargo.toml`, `pyproject.toml`, etc. |
| CLAUDE.md discovery | Finds and includes `CLAUDE.md` project instructions |

---

## Session History

**File**: `src/core/SessionManager.ts`

Maintains conversation continuity without relying on the OpenClaude `--resume` flag:

- Stores up to **10 recent turns** (user + assistant) in memory
- Formats history as `<echo_history>` XML blocks injected into prompts
- Persists to `workspaceState` for IDE restart survival
- `resetSession()` clears history for a fresh start

```xml
<echo_history>
<turn role="User">
Add input validation to the login form
</turn>

<turn role="Assistant">
I've added email format validation and password length checks...
</turn>
</echo_history>
```

---

## Context Budget

The `maxTokenBudget` setting (default: 85%) triggers warnings when token usage approaches the model's limit. The Status Bar shows a yellow warning icon when the threshold is exceeded.

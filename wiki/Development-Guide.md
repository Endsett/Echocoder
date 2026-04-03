# Development Guide

## Building from Source

### Prerequisites
- Node.js 18+
- npm 9+
- VS Code 1.100.0+ (for testing)

### Setup

```bash
git clone https://github.com/Endsett/Echocoder.git
cd Echocoder
npm install
```

### Build

```bash
# Development build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Production bundle + VSIX package
npm run package
```

The build uses **esbuild** for fast bundling. The entry point is `src/extension.ts` and the output is `out/extension.js`.

---

## Testing

### Parser Tests

```bash
npm run test:parser
```

Tests the NDJSON parser and EventRouter integration:
- Stream buffering across fragmented chunks
- Event normalization from raw OpenClaude output
- Typed event routing and token accounting

### Workflow Tests

```bash
npm run test:workflow
```

Tests the Workflow Engine:
- Plan JSON extraction and schema validation
- Fallback plan generation for unparseable responses
- Workflow state machine transitions

### Running Tests

Tests use a lightweight mock for `vscode` module (located in `tests/*/node_modules/vscode/`). They compile with a dedicated `tsconfig.json` that excludes UI modules requiring the real VS Code API.

---

## Project Structure

```
echo-coding/
├── src/                    # TypeScript source
│   ├── extension.ts        # Activation entry point
│   ├── core/               # Process management, events, workflow
│   ├── context/            # Prompt assembly, editor/workspace context
│   ├── security/           # Tool gating, sanitization, sandbox
│   ├── ui/                 # Webview panels, status bar, tree views
│   ├── chat/               # VS Code Chat API integration
│   ├── commands/           # Command registry
│   ├── completions/        # Ghost Text provider
│   ├── composer/           # Multi-file edit engine
│   ├── editor/             # Inline edit, diff decorations, CodeLens
│   ├── terminal/           # AI terminal management
│   └── types/              # Shared type definitions
├── tests/
│   ├── parser/             # NDJSONParser and EventRouter tests
│   └── workflow/           # Workflow engine tests
├── wiki/                   # GitHub Wiki source pages
├── package.json            # Extension manifest
├── tsconfig.json           # TypeScript config
├── esbuild.js              # Build script
└── phase1.md               # Phase 1 specification
```

---

## Architecture Principles

1. **Event-Driven**: All agent output flows through `NDJSONParser → EventRouter → UI`. No polling.
2. **Stateless Process Model**: Each agent run is a fresh child process. Session continuity is managed by `SessionManager` injecting history into prompts.
3. **Security by Default**: All mutating operations require explicit approval. The Workflow Engine enforces a planning phase before any execution.
4. **Graceful Degradation**: If the agent produces unparseable output, fallback paths ensure the extension never crashes.
5. **Separation of Concerns**: Each module has a single responsibility and communicates via typed events.

---

## Adding a New Command

1. Add the command to `package.json` under `contributes.commands`
2. Register the handler in `src/commands/CommandRegistry.ts`
3. (Optional) Add a keybinding in `package.json` under `contributes.keybindings`
4. Wire any needed dependencies through the `CommandRegistry` constructor

---

## Adding a New Tool Category

1. Add the category to `ToolInterceptor.toolCategories` in `src/security/ToolInterceptor.ts`
2. Define the approval policy based on user settings
3. Add a configuration option in `package.json` if user-configurable

---

## Packaging for Distribution

```bash
npm run package
```

This produces `echocoder-0.1.0.vsix` in the project root. Install it with:

```bash
code --install-extension echocoder-0.1.0.vsix
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run tests (`npm run test:parser && npm run test:workflow`)
5. Build (`npm run build`)
6. Submit a Pull Request

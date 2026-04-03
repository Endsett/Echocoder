# EchoCoder: Tech Stack and Constraints

## Core Technologies
- **Language**: TypeScript (ESNext)
- **Runtime**: Node.js 18.x+, VS Code 1.100.0+
- **Build**: Esbuild (Extension), TSC (Tests)
- **Agent Framework**: OpenClaude (CLI), JSON-RPC (NDJSON)

## High-Rigor Frameworks
- **Property Testing**: `fast-check`
- **Mutation Testing**: `@stryker-mutator/core`
- **Static Analysis**: `ESLint`, `CodeQL`

## CI/CD Architecture
- **Provider**: GitHub Actions
- **Security**: SHA-pinned actions, scoped GITHUB_TOKEN
- **Remediation**: AI-driven failure analysis

# EchoCoder: Architectural Structure

## Directory Conventions
- `/src/core`: Core logic (Process, Session, Supervisor, NDJSON).
- `/src/agents`: Specialized AI sub-agents (Plan, Code, Test).
- `/src/types`: Global type definitions and configuration.
- `/tests`: High-rigor test suites (Property, Mutation, Unit).
- `/.github/workflows`: Unified CI/CD and security actions.
- `/.kiro/steering`: Machine-readable architectural intent.

## Core Component Logic
- **Supervisor**: Orchestrator (LangGraph-style).
- **ProcessManager**: Lifecycle and binary resolution.
- **SessionManager**: Deduplication and metadata context.
- **NDJSONParser**: Safe event stream parsing.

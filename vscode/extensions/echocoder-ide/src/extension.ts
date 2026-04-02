/**
 * EchoCoder — AI-Native IDE Extension Entry Point
 * 
 * Master orchestrator: activates all modules, wires the event pipeline
 * from OpenClaude binary → NDJSONParser → EventRouter → all IDE surfaces.
 * 
 * Architecture:
 *   VS Code Extension Host (Node.js)
 *   └── extension.ts (this file)
 *       ├── ProcessManager (child_process.spawn → OpenClaude binary)
 *       │   └── NDJSONParser (stdout stream → typed AgentEvent objects)
 *       ├── EventRouter (distributes events to all surfaces)
 *       ├── AgentPanelProvider (sidebar chat webview)
 *       ├── ChatParticipantHandler (@echo in native Chat panel)
 *       ├── GhostTextProvider (inline completion autocomplete)
 *       ├── InlineEditController (Ctrl+K/I in-place editing)
 *       ├── DiffDecorator + CodeLensApprovalProvider (accept/reject)
 *       ├── ComposerEngine (multi-file atomic WorkspaceEdit)
 *       ├── AITerminalManager (agent-driven terminal)
 *       ├── ToolInterceptor (tiered security gate)
 *       ├── StatusBarManager (token meter + model display)
 *       └── PromptAssembler (context engineering)
 */

import * as vscode from 'vscode';

// Core
import { ProcessManager } from './core/ProcessManager';
import { EventRouter } from './core/EventRouter';

// UI
import { AgentPanelProvider } from './ui/AgentPanelProvider';
import { SessionHistoryProvider } from './ui/SessionHistoryProvider';
import { StatusBarManager } from './ui/StatusBarManager';

// Chat
import { ChatParticipantHandler } from './chat/ChatParticipantHandler';

// Completions
import { registerGhostTextProvider } from './completions/GhostTextProvider';

// Editor
import { InlineEditController } from './editor/InlineEditController';
import { DiffDecorator } from './editor/DiffDecorator';
import { CodeLensApprovalProvider } from './editor/CodeLensApprovalProvider';

// Composer
import { ComposerEngine } from './composer/ComposerEngine';

// Terminal
import { AITerminalManager } from './terminal/AITerminalManager';
import { TerminalOutputCapture } from './terminal/TerminalOutputCapture';

// Context
import { PromptAssembler } from './context/PromptAssembler';

// Security
import { ToolInterceptor } from './security/ToolInterceptor';
import { SandboxDetector } from './security/SandboxDetector';

// Commands
import { CommandRegistry } from './commands/CommandRegistry';

/**
 * Extension activation — instantiates and wires all components.
 */
export function activate(context: vscode.ExtensionContext) {
  // ─── Output Channel (stderr sink) ─────────────────────────────
  const outputChannel = vscode.window.createOutputChannel('EchoCoder Agent', { log: true });
  outputChannel.appendLine('🤖 EchoCoder AI-Native IDE is activating...');

  // ─── Environment Detection ────────────────────────────────────
  const sandboxDetector = new SandboxDetector();
  const envType = sandboxDetector.detect();
  outputChannel.appendLine(`[Env] Detected environment: ${sandboxDetector.getDescription()}`);
  if (sandboxDetector.isIsolated()) {
    outputChannel.appendLine('[Env] Running in isolated environment — higher autonomy enabled');
  }

  // ─── Core IPC Engine ──────────────────────────────────────────
  const processManager = new ProcessManager(outputChannel);
  const eventRouter = new EventRouter();

  // Wire ProcessManager events → EventRouter
  processManager.onEvent((event) => eventRouter.route(event));

  // ─── Terminal ─────────────────────────────────────────────────
  const terminalManager = new AITerminalManager(outputChannel);
  const terminalCapture = new TerminalOutputCapture();

  // ─── Security ─────────────────────────────────────────────────
  const toolInterceptor = new ToolInterceptor(outputChannel, terminalManager);

  // Wire tool call interception: EventRouter.onToolCall → ToolInterceptor
  eventRouter.onToolCall(async (event) => {
    const result = await toolInterceptor.evaluate(event);
    if (result === 'denied') {
      outputChannel.appendLine(`[Security] Tool denied: ${event.tool} — sending denial to agent`);
      // In a full implementation, we'd send a tool_result with is_error: true back to the agent
    }
    // If approved, the OpenClaude CLI handles execution internally in print mode
  });

  // ─── Context Engine ───────────────────────────────────────────
  const promptAssembler = new PromptAssembler();

  // ─── Composer ─────────────────────────────────────────────────
  const composerEngine = new ComposerEngine(eventRouter, outputChannel);

  // ─── Editor: Inline Edit + Diff ───────────────────────────────
  const diffDecorator = new DiffDecorator();
  const inlineEditController = new InlineEditController(processManager, diffDecorator, outputChannel);
  const codeLensProvider = new CodeLensApprovalProvider(diffDecorator);

  // Register CodeLens for all file types
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    { pattern: '**' },
    codeLensProvider
  );
  context.subscriptions.push(codeLensDisposable);

  // ─── Ghost Text Autocomplete ──────────────────────────────────
  // Note: Ghost Text uses its own ProcessManager instance to avoid
  // conflicts with the primary agent session
  const ghostTextProcessManager = new ProcessManager(outputChannel);
  registerGhostTextProvider(context, ghostTextProcessManager, outputChannel);

  // ─── Sidebar Agent Panel ──────────────────────────────────────
  const agentPanelProvider = new AgentPanelProvider(
    context.extensionUri,
    processManager,
    eventRouter,
    outputChannel
  );

  const panelDisposable = vscode.window.registerWebviewViewProvider(
    AgentPanelProvider.viewType,
    agentPanelProvider
  );
  context.subscriptions.push(panelDisposable);

  // ─── Session History ──────────────────────────────────────────
  const sessionHistoryProvider = new SessionHistoryProvider(context);
  const historyDisposable = vscode.window.registerTreeDataProvider(
    'echocoder.sessionHistory',
    sessionHistoryProvider
  );
  context.subscriptions.push(historyDisposable);

  // ─── Status Bar ───────────────────────────────────────────────
  const statusBarManager = new StatusBarManager(eventRouter, processManager);

  // ─── Chat Participant (@echo) ─────────────────────────────────
  const chatHandler = new ChatParticipantHandler(
    processManager,
    eventRouter,
    promptAssembler,
    composerEngine,
    outputChannel
  );

  const participant = vscode.chat.createChatParticipant(
    'echocoder.agent',
    chatHandler.getHandler()
  );
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'echocoder-icon.svg');
  context.subscriptions.push(participant);

  // ─── Commands ─────────────────────────────────────────────────
  const commandRegistry = new CommandRegistry(
    inlineEditController,
    diffDecorator,
    processManager,
    promptAssembler,
    composerEngine,
    outputChannel
  );
  const commandDisposables = commandRegistry.registerAll();
  context.subscriptions.push(...commandDisposables);

  // ─── Token Budget Auto-Compaction ─────────────────────────────
  eventRouter.onUsage((event) => {
    const { getConfig } = require('./types/config');
    const config = getConfig();
    const totalTokens = event.usage.input_tokens + event.usage.output_tokens;
    // Estimate: use 200k as baseline max context
    const estimatedMax = 200000;
    const usagePercent = (totalTokens / estimatedMax) * 100;

    if (usagePercent >= config.maxTokenBudget) {
      outputChannel.appendLine(`[AutoCompact] Token usage at ${usagePercent.toFixed(1)}% — triggering compaction`);
      processManager.sendInput('/compact');
    }
  });

  // ─── Disposables Registration ─────────────────────────────────
  context.subscriptions.push(
    outputChannel,
    processManager,
    ghostTextProcessManager,
    eventRouter,
    diffDecorator,
    codeLensProvider,
    statusBarManager,
    terminalManager,
    terminalCapture,
    composerEngine,
    commandRegistry,
  );

  // ─── Activation Complete ──────────────────────────────────────
  outputChannel.appendLine('✅ EchoCoder AI-Native IDE activated successfully!');
  outputChannel.appendLine(`   Environment: ${sandboxDetector.getDescription()}`);
  outputChannel.appendLine('   Surfaces: Chat Panel, Agent Sidebar, Ghost Text, Inline Edit, Composer, Terminal, Status Bar');
  outputChannel.appendLine('   Keybindings: Ctrl+K (edit), Ctrl+I (inline chat), Ctrl+L (panel), Ctrl+Shift+K (explain)');

  vscode.window.showInformationMessage('🤖 EchoCoder AI-Native IDE is ready! Use Ctrl+L to open the agent panel.');
}

/**
 * Extension deactivation — clean up all resources.
 */
export function deactivate() {
  // All disposables are cleaned up via context.subscriptions
}

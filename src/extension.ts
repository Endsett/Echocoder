import * as vscode from 'vscode';
import { ProcessManager } from './core/ProcessManager';
import { EventRouter } from './core/EventRouter';
import { AgentPanelProvider } from './ui/AgentPanelProvider';
import { SessionHistoryProvider } from './ui/SessionHistoryProvider';
import { StatusBarManager } from './ui/StatusBarManager';
import { ChatParticipantHandler } from './chat/ChatParticipantHandler';
import { registerGhostTextProvider } from './completions/GhostTextProvider';
import { InlineEditController } from './editor/InlineEditController';
import { DiffDecorator } from './editor/DiffDecorator';
import { CodeLensApprovalProvider } from './editor/CodeLensApprovalProvider';
import { ComposerEngine } from './composer/ComposerEngine';
import { AITerminalManager } from './terminal/AITerminalManager';
import { TerminalOutputCapture } from './terminal/TerminalOutputCapture';
import { PromptAssembler } from './context/PromptAssembler';
import { ToolInterceptor } from './security/ToolInterceptor';
import { SandboxDetector } from './security/SandboxDetector';
import { CommandRegistry } from './commands/CommandRegistry';
import { SessionManager } from './core/SessionManager';
import { WorkflowLoop } from './core/workflow/loop';
import { PlanViewerProvider } from './ui/PlanViewerProvider';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('EchoCoder Agent', { log: true });
  outputChannel.appendLine('[EchoCoder] Activating extension');

  const sandboxDetector = new SandboxDetector();
  outputChannel.appendLine(`[Env] ${sandboxDetector.getDescription()}`);
  if (sandboxDetector.isIsolated()) {
    outputChannel.appendLine('[Env] Isolated environment detected; higher autonomy is safer here.');
  }

  const processManager = new ProcessManager(outputChannel);
  const eventRouter = new EventRouter();
  processManager.onEvent((event) => eventRouter.route(event));

  const initialPreflight = processManager.validateEnvironment({
    cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
  });
  outputChannel.appendLine(`[Preflight] Agent target: ${initialPreflight.displayLabel}`);
  for (const warning of initialPreflight.warnings) {
    outputChannel.appendLine(`[Preflight] Warning: ${warning}`);
  }
  for (const issue of initialPreflight.issues) {
    outputChannel.appendLine(`[Preflight] Issue: ${issue}`);
  }

  const terminalManager = new AITerminalManager(outputChannel);
  const terminalCapture = new TerminalOutputCapture();
  const toolInterceptor = new ToolInterceptor(outputChannel);
  const promptAssembler = new PromptAssembler();
  const composerEngine = new ComposerEngine(eventRouter, outputChannel);
  const diffDecorator = new DiffDecorator();
  const inlineEditController = new InlineEditController(
    processManager,
    diffDecorator,
    outputChannel,
    promptAssembler
  );
  const codeLensProvider = new CodeLensApprovalProvider(diffDecorator);

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ pattern: '**' }, codeLensProvider)
  );

  const ghostTextProcessManager = new ProcessManager(outputChannel);
  registerGhostTextProvider(
    context,
    ghostTextProcessManager,
    outputChannel,
    processManager,
    promptAssembler
  );

  const agentPanelProvider = new AgentPanelProvider(
    context.extensionUri,
    processManager,
    eventRouter,
    promptAssembler,
    outputChannel
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(AgentPanelProvider.viewType, agentPanelProvider)
  );

  const sessionManager = new SessionManager(context);
  const workflowLoop = new WorkflowLoop(
    processManager,
    eventRouter,
    promptAssembler,
    outputChannel
  );

  const planViewerProvider = new PlanViewerProvider(
    context.extensionUri,
    workflowLoop
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('echocoder.planViewer', planViewerProvider)
  );

  const sessionHistoryProvider = new SessionHistoryProvider(context);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('echocoder.sessionHistory', sessionHistoryProvider)
  );

  const statusBarManager = new StatusBarManager(eventRouter, processManager);
  const chatHandler = new ChatParticipantHandler(
    processManager,
    eventRouter,
    promptAssembler,
    composerEngine,
    outputChannel
  );

  const participant = vscode.chat.createChatParticipant('echocoder.agent', chatHandler.getHandler());
  participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'echocoder-icon.svg');
  context.subscriptions.push(participant);

  const commandRegistry = new CommandRegistry(
    inlineEditController,
    diffDecorator,
    processManager,
    promptAssembler,
    composerEngine,
    workflowLoop,
    sessionManager,
    outputChannel
  );
  context.subscriptions.push(...commandRegistry.registerAll());

  eventRouter.onToolCall(async (event) => {
    const result = await toolInterceptor.evaluate(event);
    if (result === 'denied' || result === 'cancelled') {
      outputChannel.appendLine(`[Security] Tool blocked: ${event.tool} (${result}). Aborting run.`);
      processManager.abort(`tool ${event.tool} blocked by extension policy`);
    }
  });

  eventRouter.onAnyEvent((event) => {
    if (event.type === 'system' && event.subtype === 'session_state_changed') {
      outputChannel.appendLine(`[Session] state=${event.state || 'unknown'} session=${event.session_id || 'n/a'}`);
      return;
    }

    if (event.type === 'system' && event.subtype.startsWith('hook_')) {
      const hookEvent = event as any;
      if (hookEvent.stderr) {
        outputChannel.appendLine(`[Hook][stderr] ${hookEvent.stderr}`);
      }
      if (hookEvent.stdout) {
        outputChannel.appendLine(`[Hook][stdout] ${hookEvent.stdout}`);
      }
    }
  });

  eventRouter.onUsage((event) => {
    const { getConfig } = require('./types/config');
    const config = getConfig();
    const totalTokens = event.usage.input_tokens + event.usage.output_tokens;
    const usagePercent = (totalTokens / 200000) * 100;

    if (usagePercent >= config.maxTokenBudget) {
      outputChannel.appendLine(
        `[Context] Token usage is ${usagePercent.toFixed(1)}%. Auto-compaction is not injected in print mode.`
      );
    }
  });

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
    sessionManager,
    workflowLoop
  );

  outputChannel.appendLine('[EchoCoder] Extension activated');
  vscode.window.showInformationMessage('EchoCoder is ready. Use Ctrl+L to open the agent panel.');
}

export function deactivate() {
  // VS Code disposes registered subscriptions automatically.
}

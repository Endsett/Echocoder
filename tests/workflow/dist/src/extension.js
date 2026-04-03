"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ProcessManager_1 = require("./core/ProcessManager");
const EventRouter_1 = require("./core/EventRouter");
const AgentPanelProvider_1 = require("./ui/AgentPanelProvider");
const SessionHistoryProvider_1 = require("./ui/SessionHistoryProvider");
const StatusBarManager_1 = require("./ui/StatusBarManager");
const ChatParticipantHandler_1 = require("./chat/ChatParticipantHandler");
const GhostTextProvider_1 = require("./completions/GhostTextProvider");
const InlineEditController_1 = require("./editor/InlineEditController");
const DiffDecorator_1 = require("./editor/DiffDecorator");
const CodeLensApprovalProvider_1 = require("./editor/CodeLensApprovalProvider");
const ComposerEngine_1 = require("./composer/ComposerEngine");
const AITerminalManager_1 = require("./terminal/AITerminalManager");
const TerminalOutputCapture_1 = require("./terminal/TerminalOutputCapture");
const PromptAssembler_1 = require("./context/PromptAssembler");
const ToolInterceptor_1 = require("./security/ToolInterceptor");
const SandboxDetector_1 = require("./security/SandboxDetector");
const CommandRegistry_1 = require("./commands/CommandRegistry");
const SessionManager_1 = require("./core/SessionManager");
const loop_1 = require("./core/workflow/loop");
const PlanViewerProvider_1 = require("./ui/PlanViewerProvider");
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('EchoCoder Agent', { log: true });
    outputChannel.appendLine('[EchoCoder] Activating extension');
    const sandboxDetector = new SandboxDetector_1.SandboxDetector();
    outputChannel.appendLine(`[Env] ${sandboxDetector.getDescription()}`);
    if (sandboxDetector.isIsolated()) {
        outputChannel.appendLine('[Env] Isolated environment detected; higher autonomy is safer here.');
    }
    const processManager = new ProcessManager_1.ProcessManager(outputChannel);
    const eventRouter = new EventRouter_1.EventRouter();
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
    const terminalManager = new AITerminalManager_1.AITerminalManager(outputChannel);
    const terminalCapture = new TerminalOutputCapture_1.TerminalOutputCapture();
    const toolInterceptor = new ToolInterceptor_1.ToolInterceptor(outputChannel);
    const promptAssembler = new PromptAssembler_1.PromptAssembler();
    const composerEngine = new ComposerEngine_1.ComposerEngine(eventRouter, outputChannel);
    const diffDecorator = new DiffDecorator_1.DiffDecorator();
    const inlineEditController = new InlineEditController_1.InlineEditController(processManager, diffDecorator, outputChannel, promptAssembler);
    const codeLensProvider = new CodeLensApprovalProvider_1.CodeLensApprovalProvider(diffDecorator);
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ pattern: '**' }, codeLensProvider));
    const ghostTextProcessManager = new ProcessManager_1.ProcessManager(outputChannel);
    (0, GhostTextProvider_1.registerGhostTextProvider)(context, ghostTextProcessManager, outputChannel, processManager, promptAssembler);
    const agentPanelProvider = new AgentPanelProvider_1.AgentPanelProvider(context.extensionUri, processManager, eventRouter, promptAssembler, outputChannel);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider(AgentPanelProvider_1.AgentPanelProvider.viewType, agentPanelProvider));
    const sessionManager = new SessionManager_1.SessionManager(context);
    const workflowLoop = new loop_1.WorkflowLoop(processManager, eventRouter, promptAssembler, outputChannel);
    const planViewerProvider = new PlanViewerProvider_1.PlanViewerProvider(context.extensionUri, workflowLoop);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('echocoder.planViewer', planViewerProvider));
    const sessionHistoryProvider = new SessionHistoryProvider_1.SessionHistoryProvider(context);
    context.subscriptions.push(vscode.window.registerTreeDataProvider('echocoder.sessionHistory', sessionHistoryProvider));
    const statusBarManager = new StatusBarManager_1.StatusBarManager(eventRouter, processManager);
    const chatHandler = new ChatParticipantHandler_1.ChatParticipantHandler(processManager, eventRouter, promptAssembler, composerEngine, outputChannel);
    const participant = vscode.chat.createChatParticipant('echocoder.agent', chatHandler.getHandler());
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'echocoder-icon.svg');
    context.subscriptions.push(participant);
    const commandRegistry = new CommandRegistry_1.CommandRegistry(inlineEditController, diffDecorator, processManager, promptAssembler, composerEngine, workflowLoop, sessionManager, outputChannel);
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
            const hookEvent = event;
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
            outputChannel.appendLine(`[Context] Token usage is ${usagePercent.toFixed(1)}%. Auto-compaction is not injected in print mode.`);
        }
    });
    context.subscriptions.push(outputChannel, processManager, ghostTextProcessManager, eventRouter, diffDecorator, codeLensProvider, statusBarManager, terminalManager, terminalCapture, composerEngine, commandRegistry, sessionManager, workflowLoop);
    outputChannel.appendLine('[EchoCoder] Extension activated');
    vscode.window.showInformationMessage('EchoCoder is ready. Use Ctrl+L to open the agent panel.');
}
function deactivate() {
    // VS Code disposes registered subscriptions automatically.
}

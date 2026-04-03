"use strict";
/**
 * CommandRegistry — All EchoCoder Commands & Keybindings
 *
 * Registers all commands declared in package.json and wires them
 * to the appropriate controllers and managers.
 */
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
exports.CommandRegistry = void 0;
const vscode = __importStar(require("vscode"));
class CommandRegistry {
    constructor(inlineEditController, diffDecorator, processManager, promptAssembler, composerEngine, workflowLoop, sessionManager, outputChannel) {
        this.inlineEditController = inlineEditController;
        this.diffDecorator = diffDecorator;
        this.processManager = processManager;
        this.promptAssembler = promptAssembler;
        this.composerEngine = composerEngine;
        this.workflowLoop = workflowLoop;
        this.sessionManager = sessionManager;
        this.outputChannel = outputChannel;
        this.disposables = [];
    }
    /**
     * Register all commands.
     */
    registerAll() {
        // Inline Edit (Ctrl+K)
        this.register('echocoder.inlineEdit', () => {
            this.inlineEditController.executeInlineEdit();
        });
        // Inline Chat (Ctrl+I) — same as inline edit for Phase 1
        this.register('echocoder.inlineChat', () => {
            this.inlineEditController.executeInlineEdit();
        });
        // Open Agent Panel (Ctrl+L)
        this.register('echocoder.openPanel', () => {
            vscode.commands.executeCommand('echocoder.agentPanel.focus');
        });
        // Explain Selection (Ctrl+Shift+K)
        this.register('echocoder.explain', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.selection.isEmpty) {
                vscode.window.showWarningMessage('EchoCoder: Select code to explain first.');
                return;
            }
            const selectedText = editor.document.getText(editor.selection);
            const language = editor.document.languageId;
            const prompt = `Explain the following ${language} code in detail:\n\n\`\`\`${language}\n${selectedText}\n\`\`\``;
            this.openChat(`@echo /explain ${prompt}`);
        });
        // Fix Diagnostics
        this.register('echocoder.fix', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
            if (diagnostics.length === 0) {
                vscode.window.showInformationMessage('EchoCoder: No diagnostics to fix.');
                return;
            }
            const errors = diagnostics.map(d => `Line ${d.range.start.line + 1}: ${d.message}`).join('\n');
            this.openChat(`@echo /fix Fix these errors in ${editor.document.fileName}:\n${errors}`);
        });
        // Refactor
        this.register('echocoder.refactor', () => {
            this.openChat('@echo /refactor ');
        });
        // Composer Mode
        this.register('echocoder.compose', () => {
            this.openChat('@echo /compose ');
        });
        // Accept Change
        this.register('echocoder.acceptChange', (changeId) => {
            this.diffDecorator.acceptChange(changeId);
        });
        // Reject Change
        this.register('echocoder.rejectChange', (changeId) => {
            this.diffDecorator.rejectChange(changeId);
        });
        // Accept All Changes
        this.register('echocoder.acceptAllChanges', () => {
            this.diffDecorator.acceptAllChanges();
        });
        // Approve Plan
        this.register('echocoder.approvePlan', () => {
            this.workflowLoop.approvePlan();
        });
        // Reject Plan
        this.register('echocoder.rejectPlan', () => {
            this.workflowLoop.rejectPlan();
        });
        // New Session
        this.register('echocoder.newSession', () => {
            this.processManager.abort('new session requested');
            this.composerEngine.cancelCompose();
            this.diffDecorator.rejectAllChanges();
            this.sessionManager.resetSession();
            this.workflowLoop.reset();
            vscode.window.showInformationMessage('EchoCoder: Session state cleared.');
        });
        // Compact Context
        this.register('echocoder.compact', () => {
            if (this.processManager.running) {
                vscode.window.showInformationMessage('EchoCoder: Auto-compaction cannot be injected in print mode. End this run and start a fresh chat turn instead.');
                return;
            }
            this.openChat('@echo /compact Summarize and compact context for the next turn.');
        });
        // Terminal Run
        this.register('echocoder.terminalRun', () => {
            this.openChat('@echo Run this command: ');
        });
        return this.disposables;
    }
    register(command, handler) {
        this.disposables.push(vscode.commands.registerCommand(command, handler));
    }
    dispose() {
        this.disposables.forEach(d => d.dispose());
    }
    openChat(query) {
        vscode.commands.executeCommand('workbench.action.chat.open', { query });
    }
}
exports.CommandRegistry = CommandRegistry;

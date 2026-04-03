"use strict";
/**
 * InlineEditController — Ctrl+K / Ctrl+I In-Place AI Editing
 *
 * Orchestrates the inline edit workflow:
 * 1. User selects code + presses Ctrl+K (or Ctrl+I)
 * 2. InputBox overlay asks for edit instruction
 * 3. Captures selection + file + surrounding context
 * 4. Sends targeted prompt to OpenClaude
 * 5. Receives replacement code from agent
 * 6. Triggers DiffDecorator to show inline green/red diff
 * 7. Waits for Accept/Reject action via CodeLens
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
exports.InlineEditController = void 0;
const vscode = __importStar(require("vscode"));
const agent_events_1 = require("../types/agent-events");
class InlineEditController {
    constructor(processManager, diffDecorator, outputChannel, promptAssembler) {
        this.processManager = processManager;
        this.diffDecorator = diffDecorator;
        this.outputChannel = outputChannel;
        this.promptAssembler = promptAssembler;
    }
    /**
     * Execute the inline edit workflow triggered by Ctrl+K or Ctrl+I.
     */
    async executeInlineEdit() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('EchoCoder: No active editor to edit.');
            return;
        }
        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        if (!selectedText || selectedText.trim().length === 0) {
            vscode.window.showWarningMessage('EchoCoder: Select code to edit first.');
            return;
        }
        // Ask for the edit instruction
        const instruction = await vscode.window.showInputBox({
            prompt: '✏️ EchoCoder: What should I change?',
            placeHolder: 'e.g., "Add error handling", "Convert to async/await", "Add TypeScript types"',
            ignoreFocusOut: true,
        });
        if (!instruction) {
            return; // User cancelled
        }
        // Show progress in status bar
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '🤖 EchoCoder: Generating edit...',
            cancellable: true,
        }, async (progress, token) => {
            await this.generateEdit(editor, selection, selectedText, instruction, token);
        });
    }
    /**
     * Generate the edit by sending a targeted prompt to OpenClaude.
     */
    async generateEdit(editor, selection, selectedText, instruction, token) {
        const document = editor.document;
        const filePath = document.fileName;
        const language = document.languageId;
        const startLine = selection.start.line + 1;
        const endLine = selection.end.line + 1;
        // Get surrounding context (20 lines before and after)
        const contextStart = Math.max(0, selection.start.line - 20);
        const contextEnd = Math.min(document.lineCount - 1, selection.end.line + 20);
        const beforeContext = document.getText(new vscode.Range(contextStart, 0, selection.start.line, 0));
        const afterContext = document.getText(new vscode.Range(selection.end.line + 1, 0, contextEnd, document.lineAt(contextEnd).text.length));
        const assembled = await this.promptAssembler.assembleInlineEditPrompt({
            filePath,
            language,
            startLine,
            endLine,
            instruction,
            beforeContext,
            selectedText,
            afterContext,
        });
        const prompt = assembled.prompt;
        return new Promise((resolve) => {
            let resultText = '';
            let resolved = false;
            const cleanup = () => {
                eventSub.dispose();
                exitSub.dispose();
            };
            const eventSub = this.processManager.onEvent((event) => {
                if ((0, agent_events_1.isTextDelta)(event)) {
                    resultText += event.text;
                }
                else if ((0, agent_events_1.isResultSuccess)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        this.applyInlineDiff(editor, selection, selectedText, resultText.trim());
                        resolve();
                    }
                }
                else if ((0, agent_events_1.isResultError)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        vscode.window.showErrorMessage(`EchoCoder: ${event.error}`);
                        resolve();
                    }
                }
            });
            const exitSub = this.processManager.onExit(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    if (resultText.trim()) {
                        this.applyInlineDiff(editor, selection, selectedText, resultText.trim());
                    }
                    resolve();
                }
            });
            const cwd = assembled.cwd;
            this.processManager.ensureReady({ cwd }).then(() => this.processManager.spawn({
                prompt,
                cwd,
                mode: 'inline-edit',
                toolPolicy: 'none',
            }, token)).catch((error) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    const message = error instanceof Error ? error.message : String(error);
                    vscode.window.showErrorMessage(`EchoCoder could not start inline edit: ${message}`);
                    resolve();
                }
            });
        });
    }
    /**
     * Apply the inline diff decorations showing old vs new code.
     */
    applyInlineDiff(editor, selection, originalText, newText) {
        // Strip any markdown code fences the model might have added
        let cleanedText = newText;
        const fenceMatch = cleanedText.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
        if (fenceMatch) {
            cleanedText = fenceMatch[1];
        }
        if (cleanedText === originalText) {
            vscode.window.showInformationMessage('EchoCoder: No changes suggested.');
            return;
        }
        // Create a pending change and apply decorations
        const change = {
            id: `edit-${Date.now()}`,
            uri: editor.document.uri,
            range: new vscode.Range(selection.start, selection.end),
            originalText,
            newText: cleanedText,
            timestamp: Date.now(),
        };
        this.diffDecorator.addPendingChange(change);
        vscode.window.showInformationMessage('🤖 EchoCoder: Edit ready — use Accept/Reject above the code or Ctrl+Shift+Enter / Ctrl+Shift+Backspace');
    }
    dispose() {
        // Nothing to dispose
    }
}
exports.InlineEditController = InlineEditController;

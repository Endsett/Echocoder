"use strict";
/**
 * GhostTextProvider — Inline Completion Item Provider
 *
 * Implements vscode.InlineCompletionItemProvider to deliver proactive
 * AI code predictions as dimmed "ghost text" in the editor while
 * the user types — the hallmark of an AI-native IDE.
 *
 * Uses a lightweight OpenClaude execution loop optimized for speed:
 * sends surrounding code context and receives completion predictions.
 * Debounced to prevent excessive API calls on rapid typing.
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
exports.GhostTextProvider = void 0;
exports.registerGhostTextProvider = registerGhostTextProvider;
const vscode = __importStar(require("vscode"));
const config_1 = require("../types/config");
const agent_events_1 = require("../types/agent-events");
const PromptAssembler_1 = require("../context/PromptAssembler");
class GhostTextProvider {
    constructor(processManager, outputChannel, primaryProcessManager, promptAssembler) {
        this.debounceTimer = null;
        this.lastCompletion = '';
        this.processManager = processManager;
        this.outputChannel = outputChannel;
        this.primaryProcessManager = primaryProcessManager;
        this.promptAssembler = promptAssembler || new PromptAssembler_1.PromptAssembler();
    }
    async provideInlineCompletionItems(document, position, context, token) {
        const config = (0, config_1.getConfig)();
        if (!config.ghostTextEnabled) {
            return undefined;
        }
        // Don't trigger on auto-trigger if agent is busy with a main task
        if (this.processManager.running || this.primaryProcessManager?.running) {
            return undefined;
        }
        // Build context window: lines before and after cursor
        const lineCount = document.lineCount;
        const startLine = Math.max(0, position.line - 50);
        const endLine = Math.min(lineCount - 1, position.line + 10);
        const prefixRange = new vscode.Range(startLine, 0, position.line, position.character);
        const suffixRange = new vscode.Range(position.line, position.character, endLine, document.lineAt(endLine).text.length);
        const prefix = document.getText(prefixRange);
        const suffix = document.getText(suffixRange);
        const language = document.languageId;
        const fileName = document.fileName;
        const assembled = this.promptAssembler.assembleCompletionPrompt({
            filePath: fileName,
            language,
            prefix,
            suffix,
        });
        const prompt = assembled.prompt;
        try {
            const completion = await this.getCompletion(prompt, assembled.cwd, token);
            if (!completion || token.isCancellationRequested) {
                return undefined;
            }
            // Create the inline completion item
            const item = new vscode.InlineCompletionItem(completion, new vscode.Range(position, position));
            return [item];
        }
        catch (err) {
            this.outputChannel.appendLine(`[GhostText] Error: ${err}`);
            return undefined;
        }
    }
    /**
     * Execute a fast completion via OpenClaude and collect the result.
     */
    getCompletion(prompt, cwd, token) {
        return new Promise((resolve) => {
            let result = '';
            let resolved = false;
            const cleanup = () => {
                eventDisposable.dispose();
                exitDisposable.dispose();
            };
            const eventDisposable = this.processManager.onEvent((event) => {
                if ((0, agent_events_1.isTextDelta)(event)) {
                    result += event.text;
                }
                else if ((0, agent_events_1.isResultSuccess)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        resolve(result.trim() || null);
                    }
                }
            });
            const exitDisposable = this.processManager.onExit(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(result.trim() || null);
                }
            });
            token.onCancellationRequested(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    this.processManager.abort();
                    resolve(null);
                }
            });
            this.processManager.ensureReady({ cwd }).then(() => this.processManager.spawn({
                prompt,
                cwd,
                mode: 'completion',
                toolPolicy: 'none',
            }, token)).catch(() => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    resolve(null);
                }
            });
        });
    }
    dispose() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
}
exports.GhostTextProvider = GhostTextProvider;
/**
 * Register the Ghost Text provider for all supported languages.
 */
function registerGhostTextProvider(context, processManager, outputChannel, primaryProcessManager, promptAssembler) {
    const provider = new GhostTextProvider(processManager, outputChannel, primaryProcessManager, promptAssembler);
    const disposable = vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, // All file types
    provider);
    context.subscriptions.push(disposable);
    return disposable;
}

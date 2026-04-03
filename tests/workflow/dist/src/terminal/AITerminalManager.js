"use strict";
/**
 * AITerminalManager — Agent Terminal Execution
 *
 * Creates a dedicated EchoCoder terminal and manages agent-initiated
 * command execution. All commands pass through the ToolInterceptor
 * for security approval before execution.
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
exports.AITerminalManager = void 0;
const vscode = __importStar(require("vscode"));
class AITerminalManager {
    constructor(outputChannel) {
        this.terminal = null;
        this.outputChannel = outputChannel;
        // Clean up if terminal is closed
        vscode.window.onDidCloseTerminal((t) => {
            if (t === this.terminal) {
                this.terminal = null;
            }
        });
    }
    /**
     * Get or create the EchoCoder terminal.
     */
    getTerminal() {
        if (!this.terminal || this.terminal.exitStatus !== undefined) {
            this.terminal = vscode.window.createTerminal({
                name: '🤖 EchoCoder Terminal',
                iconPath: new vscode.ThemeIcon('hubot'),
            });
        }
        return this.terminal;
    }
    /**
     * Execute a command in the EchoCoder terminal.
     * The command should already be approved by the ToolInterceptor.
     */
    executeCommand(command) {
        const terminal = this.getTerminal();
        terminal.show(true); // Preserve focus on editor
        terminal.sendText(command);
        this.outputChannel.appendLine(`[Terminal] Executed: ${command}`);
    }
    /**
     * Show the terminal without executing anything.
     */
    show() {
        this.getTerminal().show();
    }
    dispose() {
        this.terminal?.dispose();
    }
}
exports.AITerminalManager = AITerminalManager;

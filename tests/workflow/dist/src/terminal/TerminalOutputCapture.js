"use strict";
/**
 * TerminalOutputCapture — Captures Terminal Output for Agent Feedback
 *
 * Buffers terminal output so the agent can react to command results,
 * build errors, test failures, etc.
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
exports.TerminalOutputCapture = void 0;
const vscode = __importStar(require("vscode"));
class TerminalOutputCapture {
    constructor() {
        this.buffer = '';
        this.maxBufferSize = 10000; // characters
        // Use onDidWriteTerminalData if available (proposed API)
        // Fallback: agent will need to read from stdout of spawned processes
        try {
            vscode.window.onDidWriteTerminalData?.((e) => {
                this.buffer += e.data;
                // Trim buffer if too large
                if (this.buffer.length > this.maxBufferSize) {
                    this.buffer = this.buffer.slice(-this.maxBufferSize);
                }
            });
        }
        catch {
            // Proposed API not available — gracefully degrade
        }
    }
    /**
     * Get the current buffer contents.
     */
    getOutput() {
        return this.buffer;
    }
    /**
     * Clear the buffer.
     */
    clear() {
        this.buffer = '';
    }
    /**
     * Get the last N characters of output.
     */
    getLastOutput(chars = 2000) {
        return this.buffer.slice(-chars);
    }
    dispose() {
        this.buffer = '';
    }
}
exports.TerminalOutputCapture = TerminalOutputCapture;

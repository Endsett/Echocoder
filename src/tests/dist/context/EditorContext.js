"use strict";
/**
 * EditorContext — Active Editor State Extraction
 *
 * Captures the current editor state for agent context injection:
 * active file, selection, open tabs, cursor position.
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
exports.EditorContext = void 0;
const vscode = __importStar(require("vscode"));
class EditorContext {
    /**
     * Extract the current editor state.
     */
    getState() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                activeFile: null,
                activeLanguage: null,
                selectedText: null,
                selectedRange: null,
                cursorLine: null,
                openFiles: this.getOpenFiles(),
            };
        }
        const selection = editor.selection;
        const selectedText = selection.isEmpty ? null : editor.document.getText(selection);
        const selectedRange = selection.isEmpty ? null : {
            startLine: selection.start.line + 1,
            endLine: selection.end.line + 1,
        };
        return {
            activeFile: editor.document.fileName,
            activeLanguage: editor.document.languageId,
            selectedText,
            selectedRange,
            cursorLine: editor.selection.active.line + 1,
            openFiles: this.getOpenFiles(),
        };
    }
    /**
     * Get all currently open file paths.
     */
    getOpenFiles() {
        return vscode.window.tabGroups.all
            .flatMap(group => group.tabs)
            .map(tab => {
            const input = tab.input;
            if (input && typeof input === 'object' && 'uri' in input) {
                return input.uri.fsPath;
            }
            return null;
        })
            .filter((f) => f !== null);
    }
    /**
     * Format editor state as context string for the agent prompt.
     */
    formatForPrompt() {
        const state = this.getState();
        const parts = [];
        if (state.activeFile) {
            parts.push(`Active file: ${state.activeFile} (${state.activeLanguage})`);
            if (state.cursorLine) {
                parts.push(`Cursor at line: ${state.cursorLine}`);
            }
        }
        if (state.selectedText && state.selectedRange) {
            parts.push(`Selected text (lines ${state.selectedRange.startLine}-${state.selectedRange.endLine}):`);
            parts.push(state.selectedText);
        }
        if (state.openFiles.length > 0) {
            parts.push(`Open files: ${state.openFiles.map(f => `@${f}`).join(', ')}`);
        }
        return parts.join('\n');
    }
}
exports.EditorContext = EditorContext;

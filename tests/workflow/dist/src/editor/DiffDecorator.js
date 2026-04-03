"use strict";
/**
 * DiffDecorator — Inline Diff Visualization
 *
 * Shows proposed AI changes as green (added) and red (removed) highlighted
 * lines directly in the editor. Works in concert with CodeLensApprovalProvider
 * to show Accept/Reject buttons above each change block.
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
exports.DiffDecorator = void 0;
const vscode = __importStar(require("vscode"));
class DiffDecorator {
    constructor() {
        // Track pending changes
        this.pendingChanges = new Map();
        // Event emitter for changes
        this._onDidChangeChanges = new vscode.EventEmitter();
        this.onDidChangeChanges = this._onDidChangeChanges.event;
        // Green background for additions
        this.addedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(40, 167, 69, 0.15)',
            isWholeLine: true,
            overviewRulerColor: 'rgba(40, 167, 69, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
            gutterIconPath: undefined, // Will be set per platform
            after: {
                contentText: ' ✓ AI Change',
                color: 'rgba(40, 167, 69, 0.6)',
                fontStyle: 'italic',
            },
        });
        // Red border for removed lines (shown as annotation since we can't show deleted lines)
        this.removedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(220, 53, 69, 0.1)',
            isWholeLine: true,
            overviewRulerColor: 'rgba(220, 53, 69, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });
        // Yellow border for modified lines  
        this.modifiedDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 193, 7, 0.12)',
            isWholeLine: true,
            borderWidth: '0 0 0 3px',
            borderStyle: 'solid',
            borderColor: 'rgba(255, 193, 7, 0.6)',
            overviewRulerColor: 'rgba(255, 193, 7, 0.8)',
            overviewRulerLane: vscode.OverviewRulerLane.Left,
        });
    }
    /**
     * Add a pending change and apply decorations to the editor.
     */
    addPendingChange(change) {
        this.pendingChanges.set(change.id, change);
        this.applyDecorations(change);
        this._onDidChangeChanges.fire();
        // Set context for keybinding conditions
        vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', true);
    }
    /**
     * Apply visual decorations for a pending change.
     */
    applyDecorations(change) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === change.uri.toString());
        if (!editor) {
            return;
        }
        // Highlight the entire range that will be replaced
        const decorationRange = {
            range: change.range,
            hoverMessage: new vscode.MarkdownString(`**🤖 EchoCoder Proposed Edit**\n\n` +
                `\`\`\`diff\n- ${change.originalText.split('\n').join('\n- ')}\n` +
                `+ ${change.newText.split('\n').join('\n+ ')}\n\`\`\`\n\n` +
                `Use \`Ctrl+Shift+Enter\` to accept or \`Ctrl+Shift+Backspace\` to reject.`),
        };
        editor.setDecorations(this.modifiedDecoration, [decorationRange]);
    }
    /**
     * Accept a pending change — apply the edit to the document.
     */
    async acceptChange(changeId) {
        const id = changeId || this.getFirstPendingId();
        if (!id) {
            return;
        }
        const change = this.pendingChanges.get(id);
        if (!change) {
            return;
        }
        // Apply the edit
        const edit = new vscode.WorkspaceEdit();
        edit.replace(change.uri, change.range, change.newText);
        await vscode.workspace.applyEdit(edit);
        // Remove the pending change
        this.pendingChanges.delete(id);
        this.clearDecorations(change.uri);
        this._onDidChangeChanges.fire();
        if (this.pendingChanges.size === 0) {
            vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
        }
        vscode.window.showInformationMessage('✅ EchoCoder: Change accepted.');
    }
    /**
     * Reject a pending change — clear decorations, keep original code.
     */
    rejectChange(changeId) {
        const id = changeId || this.getFirstPendingId();
        if (!id) {
            return;
        }
        const change = this.pendingChanges.get(id);
        if (!change) {
            return;
        }
        this.pendingChanges.delete(id);
        this.clearDecorations(change.uri);
        this._onDidChangeChanges.fire();
        if (this.pendingChanges.size === 0) {
            vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
        }
        vscode.window.showInformationMessage('❌ EchoCoder: Change rejected.');
    }
    /**
     * Accept all pending changes.
     */
    async acceptAllChanges() {
        const edit = new vscode.WorkspaceEdit();
        for (const change of this.pendingChanges.values()) {
            edit.replace(change.uri, change.range, change.newText);
        }
        await vscode.workspace.applyEdit(edit);
        this.pendingChanges.clear();
        this.clearAllDecorations();
        this._onDidChangeChanges.fire();
        vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
        vscode.window.showInformationMessage('✅ EchoCoder: All changes accepted.');
    }
    /**
     * Reject all pending changes and clear decorations.
     */
    rejectAllChanges() {
        if (this.pendingChanges.size === 0) {
            return;
        }
        this.pendingChanges.clear();
        this.clearAllDecorations();
        this._onDidChangeChanges.fire();
        vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
    }
    /**
     * Get all pending changes (for CodeLens rendering).
     */
    getPendingChanges() {
        return Array.from(this.pendingChanges.values());
    }
    getFirstPendingId() {
        const first = this.pendingChanges.keys().next();
        return first.done ? undefined : first.value;
    }
    clearDecorations(uri) {
        const editor = vscode.window.visibleTextEditors.find(e => e.document.uri.toString() === uri.toString());
        if (editor) {
            editor.setDecorations(this.addedDecoration, []);
            editor.setDecorations(this.removedDecoration, []);
            editor.setDecorations(this.modifiedDecoration, []);
        }
    }
    clearAllDecorations() {
        for (const editor of vscode.window.visibleTextEditors) {
            editor.setDecorations(this.addedDecoration, []);
            editor.setDecorations(this.removedDecoration, []);
            editor.setDecorations(this.modifiedDecoration, []);
        }
    }
    dispose() {
        this.addedDecoration.dispose();
        this.removedDecoration.dispose();
        this.modifiedDecoration.dispose();
        this._onDidChangeChanges.dispose();
        this.pendingChanges.clear();
    }
}
exports.DiffDecorator = DiffDecorator;

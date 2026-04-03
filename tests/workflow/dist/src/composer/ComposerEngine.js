"use strict";
/**
 * ComposerEngine - Multi-file orchestration and atomic apply flow.
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
exports.ComposerEngine = void 0;
const vscode = __importStar(require("vscode"));
const FileChangeTracker_1 = require("./FileChangeTracker");
class ComposerEngine {
    constructor(eventRouter, outputChannel) {
        this.eventRouter = eventRouter;
        this.outputChannel = outputChannel;
        this.isComposing = false;
        this._onComposerStart = new vscode.EventEmitter();
        this._onComposerComplete = new vscode.EventEmitter();
        this._onFileChanged = new vscode.EventEmitter();
        this.onComposerStart = this._onComposerStart.event;
        this.onComposerComplete = this._onComposerComplete.event;
        this.onFileChanged = this._onFileChanged.event;
        this.changeTracker = new FileChangeTracker_1.FileChangeTracker();
        this.wireEvents();
    }
    wireEvents() {
        this.eventRouter.onFileEdit((event) => {
            if (!this.isComposing) {
                return;
            }
            const change = this.changeTracker.trackEdit(event);
            this._onFileChanged.fire(change);
            this.outputChannel.appendLine(`[Composer] File edit tracked: ${event.path}`);
        });
        this.eventRouter.onFileCreate((event) => {
            if (!this.isComposing) {
                return;
            }
            const change = this.changeTracker.trackCreate(event);
            this._onFileChanged.fire(change);
            this.outputChannel.appendLine(`[Composer] File create tracked: ${event.path}`);
        });
        this.eventRouter.onSuccess(() => {
            if (this.isComposing) {
                void this.finalizeCompose();
            }
        });
        this.eventRouter.onError((event) => {
            if (!this.isComposing) {
                return;
            }
            this.outputChannel.appendLine(`[Composer] Agent error while composing: ${event.error || event.result || 'unknown error'}`);
            this.cancelCompose();
        });
    }
    startCompose() {
        this.isComposing = true;
        this.changeTracker.clear();
        this._onComposerStart.fire();
        this.outputChannel.appendLine('[Composer] Composition started - accumulating file changes');
    }
    async finalizeCompose() {
        this.isComposing = false;
        const changes = this.changeTracker.getChanges();
        if (changes.length === 0) {
            this.outputChannel.appendLine('[Composer] No file changes to apply');
            this._onComposerComplete.fire([]);
            return;
        }
        const summary = this.buildChangeSummary(changes);
        const choice = await vscode.window.showInformationMessage(`EchoCoder Composer prepared ${changes.length} change(s): ${summary}. Apply now?`, { modal: true }, 'Apply', 'Discard');
        if (choice !== 'Apply') {
            this.outputChannel.appendLine(`[Composer] User discarded ${changes.length} pending file changes`);
            this._onComposerComplete.fire([]);
            this.changeTracker.clear();
            return;
        }
        this.outputChannel.appendLine(`[Composer] Applying ${changes.length} file changes atomically`);
        const workspaceEdit = new vscode.WorkspaceEdit();
        for (const change of changes) {
            const uri = vscode.Uri.file(change.absolutePath);
            if (change.type === 'create') {
                workspaceEdit.createFile(uri, { ignoreIfExists: true });
                workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
                continue;
            }
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                const fullRange = new vscode.Range(doc.positionAt(0), doc.positionAt(doc.getText().length));
                workspaceEdit.replace(uri, fullRange, change.newContent);
            }
            catch {
                workspaceEdit.createFile(uri, { ignoreIfExists: true });
                workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
            }
        }
        const success = await vscode.workspace.applyEdit(workspaceEdit);
        if (success) {
            this.outputChannel.appendLine(`[Composer] Applied ${changes.length} change(s) successfully`);
            vscode.window.showInformationMessage(`EchoCoder Composer: ${changes.length} file(s) modified atomically.`);
        }
        else {
            this.outputChannel.appendLine('[Composer] Failed to apply workspace edit');
            vscode.window.showErrorMessage(`EchoCoder Composer: Failed to apply changes (${summary}).`);
        }
        this._onComposerComplete.fire(changes);
        this.changeTracker.clear();
    }
    cancelCompose() {
        this.isComposing = false;
        const count = this.changeTracker.getChanges().length;
        this.changeTracker.clear();
        this.outputChannel.appendLine(`[Composer] Composition cancelled - ${count} changes discarded`);
    }
    dispose() {
        this._onComposerStart.dispose();
        this._onComposerComplete.dispose();
        this._onFileChanged.dispose();
    }
    buildChangeSummary(changes) {
        const created = changes.filter((change) => change.type === 'create').length;
        const edited = changes.filter((change) => change.type === 'edit').length;
        const firstPaths = changes.slice(0, 3).map((change) => change.relativePath).join(', ');
        const moreCount = Math.max(changes.length - 3, 0);
        const counts = `${edited} edit(s), ${created} create(s)`;
        if (!firstPaths) {
            return counts;
        }
        return moreCount > 0
            ? `${counts} (${firstPaths}, +${moreCount} more)`
            : `${counts} (${firstPaths})`;
    }
}
exports.ComposerEngine = ComposerEngine;

"use strict";
/**
 * CodeLensApprovalProvider — Accept/Reject Buttons for AI Changes
 *
 * Renders CodeLens buttons directly above AI-proposed change blocks:
 *   ✅ Accept  |  ❌ Reject  |  ✅ Accept All
 *
 * Dynamically registered when inline edits are pending and
 * automatically cleared when changes are resolved.
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
exports.CodeLensApprovalProvider = void 0;
const vscode = __importStar(require("vscode"));
class CodeLensApprovalProvider {
    constructor(diffDecorator) {
        this._onDidChangeCodeLenses = new vscode.EventEmitter();
        this.onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
        this.diffDecorator = diffDecorator;
        // Refresh CodeLenses when pending changes are updated
        this.diffDecorator.onDidChangeChanges(() => {
            this._onDidChangeCodeLenses.fire();
        });
    }
    provideCodeLenses(document, _token) {
        const lenses = [];
        for (const change of this.diffDecorator.getPendingChanges()) {
            // Only show for matching document
            if (change.uri.toString() !== document.uri.toString()) {
                continue;
            }
            const range = new vscode.Range(change.range.start.line, 0, change.range.start.line, 0);
            // Accept button
            lenses.push(new vscode.CodeLens(range, {
                title: '✅ Accept',
                command: 'echocoder.acceptChange',
                arguments: [change.id],
                tooltip: 'Accept this AI-proposed change',
            }));
            // Reject button
            lenses.push(new vscode.CodeLens(range, {
                title: '❌ Reject',
                command: 'echocoder.rejectChange',
                arguments: [change.id],
                tooltip: 'Reject this change and keep original code',
            }));
            // Accept All (only if multiple changes)
            if (this.diffDecorator.getPendingChanges().length > 1) {
                lenses.push(new vscode.CodeLens(range, {
                    title: '✅ Accept All',
                    command: 'echocoder.acceptAllChanges',
                    tooltip: 'Accept all pending AI changes',
                }));
            }
        }
        return lenses;
    }
    dispose() {
        this._onDidChangeCodeLenses.dispose();
    }
}
exports.CodeLensApprovalProvider = CodeLensApprovalProvider;

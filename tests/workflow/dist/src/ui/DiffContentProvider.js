"use strict";
/**
 * DiffContentProvider — Virtual Document Provider for Diff Previews
 *
 * Handles the 'echocoder-diff' scheme to provide pre-mutation and
 * post-mutation content for VS Code's native diff editor.
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
exports.DiffContentProvider = void 0;
const vscode = __importStar(require("vscode"));
class DiffContentProvider {
    constructor() {
        this._onDidChange = new vscode.EventEmitter();
        this.onDidChange = this._onDidChange.event;
    }
    /**
     * Provide the content for a given virtual URI.
     *
     * URI format: echocoder-diff:original/filename?content
     * or: echocoder-diff:modified/filename?content
     */
    provideTextDocumentContent(uri) {
        // The content is passed in the query string (encoded)
        const content = decodeURIComponent(uri.query);
        return content;
    }
    /**
     * Trigger an update for a specific URI.
     */
    update(uri) {
        this._onDidChange.fire(uri);
    }
}
exports.DiffContentProvider = DiffContentProvider;
DiffContentProvider.SCHEME = 'echocoder-diff';

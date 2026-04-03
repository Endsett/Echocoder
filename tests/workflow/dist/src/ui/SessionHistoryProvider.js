"use strict";
/**
 * SessionHistoryProvider — Past Agent Sessions Tree View
 *
 * Shows a chronological list of past agent sessions in the sidebar.
 * Each session stores a summary and timestamp. Persisted to globalState.
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
exports.SessionHistoryProvider = void 0;
const vscode = __importStar(require("vscode"));
class SessionHistoryProvider {
    constructor(context) {
        this.sessions = [];
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
        this.context = context;
        this.loadSessions();
    }
    getTreeItem(element) {
        const item = new vscode.TreeItem(element.summary, vscode.TreeItemCollapsibleState.None);
        item.description = new Date(element.timestamp).toLocaleString();
        item.tooltip = `${element.messageCount} messages`;
        item.iconPath = new vscode.ThemeIcon('comment-discussion');
        return item;
    }
    getChildren() {
        return this.sessions.sort((a, b) => b.timestamp - a.timestamp);
    }
    addSession(summary, messageCount) {
        this.sessions.push({
            id: `session-${Date.now()}`,
            summary: summary.substring(0, 80),
            timestamp: Date.now(),
            messageCount,
        });
        this.saveSessions();
        this._onDidChangeTreeData.fire();
    }
    loadSessions() {
        this.sessions = this.context.globalState.get('echocoder.sessions', []);
    }
    saveSessions() {
        // Keep only last 50 sessions
        if (this.sessions.length > 50) {
            this.sessions = this.sessions.slice(-50);
        }
        this.context.globalState.update('echocoder.sessions', this.sessions);
    }
    dispose() {
        this._onDidChangeTreeData.dispose();
    }
}
exports.SessionHistoryProvider = SessionHistoryProvider;

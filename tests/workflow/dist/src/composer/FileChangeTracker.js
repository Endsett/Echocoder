"use strict";
/**
 * FileChangeTracker — Tracks File Mutations from Agent Stream
 *
 * Accumulates file_edit and file_create events from the NDJSON stream
 * into a structured list for the ComposerEngine to apply atomically.
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
exports.FileChangeTracker = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
class FileChangeTracker {
    constructor() {
        this.changes = new Map();
    }
    /**
     * Track a file edit event.
     */
    trackEdit(event) {
        const absolutePath = this.resolveAbsolutePath(event.path);
        const change = {
            id: `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            type: 'edit',
            relativePath: event.path,
            absolutePath,
            oldContent: event.old_content,
            newContent: event.new_content,
            timestamp: Date.now(),
        };
        // If we already have a change for this file, update it
        // (agent may have edited the same file multiple times in one turn)
        const existing = this.findByPath(absolutePath);
        if (existing) {
            existing.newContent = event.new_content;
            existing.timestamp = Date.now();
            return existing;
        }
        this.changes.set(change.id, change);
        return change;
    }
    /**
     * Track a file create event.
     */
    trackCreate(event) {
        const absolutePath = this.resolveAbsolutePath(event.path);
        const change = {
            id: `create-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            type: 'create',
            relativePath: event.path,
            absolutePath,
            oldContent: '',
            newContent: event.content,
            timestamp: Date.now(),
        };
        this.changes.set(change.id, change);
        return change;
    }
    /**
     * Get all tracked changes.
     */
    getChanges() {
        return Array.from(this.changes.values());
    }
    /**
     * Clear all tracked changes.
     */
    clear() {
        this.changes.clear();
    }
    /**
     * Find a change by absolute path.
     */
    findByPath(absolutePath) {
        for (const change of this.changes.values()) {
            if (change.absolutePath === absolutePath) {
                return change;
            }
        }
        return undefined;
    }
    /**
     * Resolve a potentially relative path to absolute using workspace folders.
     */
    resolveAbsolutePath(filePath) {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (workspaceFolder) {
            return path.resolve(workspaceFolder.uri.fsPath, filePath);
        }
        return path.resolve(filePath);
    }
}
exports.FileChangeTracker = FileChangeTracker;

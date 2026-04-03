"use strict";
/**
 * SessionManager — Agent Conversation History
 *
 * Maintains the session history within the IDE instead of relying on
 * the unstable \`--resume\` flag. Keeps track of conversation turns and
 * injects them into future prompts using \`<echo_history>\` blocks.
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
exports.SessionManager = void 0;
const vscode = __importStar(require("vscode"));
/** Maximum number of turns to keep in context to prevent token explosion. */
const MAX_TURNS_IN_CONTEXT = 10;
class SessionManager {
    context;
    activeSession = null;
    _onSessionChanged = new vscode.EventEmitter();
    onSessionChanged = this._onSessionChanged.event;
    constructor(context) {
        this.context = context;
        this.restoreSession();
    }
    /**
     * Add a new conversation turn to the active session.
     * Automatically creates a new session if none exists.
     */
    addTurn(role, content) {
        if (!this.activeSession) {
            const config = require('../types/config').getConfig();
            this.activeSession = {
                id: `session-${Date.now()}`,
                turns: [],
                startTime: Date.now(),
                lastUpdated: Date.now(),
                model: config.model,
            };
        }
        // Deduplication: Don't add if it's identical to the last turn of the same role
        const lastTurn = this.activeSession.turns[this.activeSession.turns.length - 1];
        if (lastTurn && lastTurn.role === role && lastTurn.content === content) {
            return;
        }
        this.activeSession.turns.push({
            role,
            content,
            timestamp: Date.now(),
        });
        this.activeSession.lastUpdated = Date.now();
        this.persistSession();
        this._onSessionChanged.fire(this.activeSession);
    }
    /**
     * Reset the active session, clearing history.
     */
    resetSession() {
        const oldSession = this.activeSession;
        this.activeSession = null;
        this.persistSession();
        if (oldSession) {
            this._onSessionChanged.fire(null);
        }
    }
    /**
     * Format the current history as an XML-like block to be appended
     * or prepended to the prompt assembly.
     */
    getHistoryContext() {
        if (!this.activeSession || this.activeSession.turns.length === 0) {
            return '';
        }
        // Only take the last N turns to avoid blowing up the context window
        const recentTurns = this.activeSession.turns.slice(-MAX_TURNS_IN_CONTEXT);
        const historyBlock = recentTurns.map(t => {
            const roleStr = t.role === 'user' ? 'User' : 'Assistant';
            return `<turn role="${roleStr}">\n${t.content}\n</turn>`;
        }).join('\n\n');
        return `\n<echo_history>\n${historyBlock}\n</echo_history>\n`;
    }
    /**
     * Simple character-based token estimator (Roughly 4 chars per token)
     */
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    updateUsage(input, output) {
        if (this.activeSession) {
            this.activeSession.totalTokens = {
                input: (this.activeSession.totalTokens?.input || 0) + input,
                output: (this.activeSession.totalTokens?.output || 0) + output,
            };
            this.persistSession();
        }
    }
    getActiveSession() {
        return this.activeSession;
    }
    persistSession() {
        if (this.activeSession) {
            // Keep storage light by only saving recent turns
            const sessionToSave = {
                ...this.activeSession,
                turns: this.activeSession.turns.slice(-MAX_TURNS_IN_CONTEXT)
            };
            this.context.workspaceState.update('echocoder.activeSession', sessionToSave);
        }
        else {
            this.context.workspaceState.update('echocoder.activeSession', undefined);
        }
    }
    restoreSession() {
        const saved = this.context.workspaceState.get('echocoder.activeSession');
        if (saved) {
            this.activeSession = saved;
            this._onSessionChanged.fire(this.activeSession);
        }
    }
    dispose() {
        this._onSessionChanged.dispose();
    }
}
exports.SessionManager = SessionManager;

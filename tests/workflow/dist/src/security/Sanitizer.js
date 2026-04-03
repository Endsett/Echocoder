"use strict";
/**
 * Sanitizer — Security Data Sanitization
 *
 * Cleans input and output to prevent injection attacks and secret leakage.
 * Truncates oversized payloads and strips ANSI escape sequences.
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
exports.Sanitizer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
class Sanitizer {
    constructor(context) {
        this.context = context;
    }
    /**
     * Strip ANSI escape codes from output strings.
     * Useful for cleaning CLI output before sending it to the agent.
     */
    stripAnsi(text) {
        // Standard ANSI escape code regex
        // eslint-disable-next-line no-control-regex
        const ansiRegex = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
        return text.replace(ansiRegex, '');
    }
    /**
     * Normalize an absolute path to prevent directory traversal
     * and ensure it falls within the current workspace.
     */
    normalizeWorkspacePath(rawPath) {
        if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
            return null; // No workspace open
        }
        const root = vscode.workspace.workspaceFolders[0].uri.fsPath;
        const normalized = path.normalize(path.resolve(root, rawPath));
        // Ensure the resolved path actually starts with the root
        if (!normalized.startsWith(root)) {
            return null; // Directory traversal attempted
        }
        return normalized;
    }
    /**
     * Redact common API keys and secrets from output logs
     * to prevent sending user secrets to the AI model.
     */
    redactSecrets(text) {
        let scrubbed = text;
        // AWS keys
        scrubbed = scrubbed.replace(/(AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, '[REDACTED_AWS_KEY]');
        // Generic API keys (naive heuristic for bearer tokens/keys)
        scrubbed = scrubbed.replace(/Bearer [a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, 'Bearer [REDACTED_JWT]');
        scrubbed = scrubbed.replace(/api_key[=:][a-zA-Z0-9_\-]+/gi, 'api_key=[REDACTED]');
        // Provider API keys from config
        const config = vscode.workspace.getConfiguration('echocoder');
        const userApiKey = config.get('apiKey');
        if (userApiKey && userApiKey.length > 5) {
            // Escape special regex chars just in case
            const escapedKey = userApiKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            scrubbed = scrubbed.replace(new RegExp(escapedKey, 'g'), '[REDACTED_ECHOCODER_API_KEY]');
        }
        return scrubbed;
    }
    /**
     * Enforce length limits on tool outputs to prevent the agent
     * from blowing up the context window.
     */
    truncateOutput(text, maxChars = 8000) {
        if (text.length <= maxChars) {
            return text;
        }
        const half = Math.floor(maxChars / 2) - 100;
        const start = text.substring(0, half);
        const end = text.substring(text.length - half);
        return `${start}\n\n... [TRUNCATED ${text.length - maxChars} CHARACTERS] ...\n\n${end}`;
    }
}
exports.Sanitizer = Sanitizer;

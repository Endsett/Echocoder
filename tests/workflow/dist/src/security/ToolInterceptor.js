"use strict";
/**
 * ToolInterceptor - Security Gate for Agent Tool Executions
 *
 * Tiered model:
 * - Auto-approve reads when enabled
 * - Writes are blocked for sensitive paths and outside-workspace paths
 * - Terminal and network tools require explicit approval unless configured
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
exports.ToolInterceptor = void 0;
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const config_1 = require("../types/config");
const READ_TOOLS = new Set([
    'read', 'ls', 'glob', 'grep', 'search', 'read_file',
    'list_files', 'list_directory', 'file_search', 'get_file',
]);
const WRITE_TOOLS = new Set([
    'write', 'edit', 'write_file', 'edit_file', 'create_file', 'delete_file',
    'rename_file', 'move_file', 'patch_file',
]);
const EXEC_TOOLS = new Set([
    'bash', 'powershell', 'run_bash', 'execute_command', 'shell', 'terminal',
    'run_command',
]);
const NETWORK_TOOLS = new Set([
    'fetch', 'curl', 'http_request', 'web_request', 'webfetch', 'web_search', 'websearch',
]);
const SENSITIVE_SEGMENTS = [
    '/.ssh/',
    '/secrets/',
    '/.aws/',
    '/.gnupg/',
];
const SENSITIVE_PATH_REGEXES = [
    /(^|\/)\.env($|[./-])/i,
    /(^|\/)\.env\.[^/]+$/i,
    /(^|\/)\.git\/config$/i,
    /(^|\/)credentials[^/]*$/i,
    /(^|\/)[^/]*\.pem$/i,
    /(^|\/)[^/]*\.key$/i,
    /(^|\/)[^/]*(password|token|secret)[^/]*$/i,
];
class ToolInterceptor {
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    async evaluate(event) {
        const config = (0, config_1.getConfig)();
        const tool = event.tool.toLowerCase();
        this.outputChannel.appendLine(`[Security] Tool call: ${event.tool} - ${JSON.stringify(event.input).substring(0, 200)}`);
        if (READ_TOOLS.has(tool)) {
            if (config.autoApproveReads) {
                this.outputChannel.appendLine(`[Security] Auto-approved (read): ${event.tool}`);
                return 'approved';
            }
            return this.promptUser(event, 'read');
        }
        if (WRITE_TOOLS.has(tool)) {
            const filePath = this.extractFilePath(event);
            if (filePath && this.isSensitivePath(filePath)) {
                this.outputChannel.appendLine(`[Security] BLOCKED (sensitive path): ${filePath}`);
                vscode.window.showWarningMessage(`EchoCoder blocked write to sensitive file: ${filePath}`);
                return 'denied';
            }
            if (filePath && !this.isInWorkspace(filePath)) {
                this.outputChannel.appendLine(`[Security] BLOCKED (outside workspace): ${filePath}`);
                vscode.window.showWarningMessage(`EchoCoder blocked write outside workspace: ${filePath}`);
                return 'denied';
            }
            if (config.autoApproveWrites) {
                this.outputChannel.appendLine(`[Security] Auto-approved (write): ${event.tool}`);
                return 'approved';
            }
            return this.promptUser(event, 'write');
        }
        if (EXEC_TOOLS.has(tool)) {
            if (config.terminalAutoRun) {
                this.outputChannel.appendLine(`[Security] Auto-approved (terminal auto-run): ${event.tool}`);
                return 'approved';
            }
            return this.promptUser(event, 'execute');
        }
        if (NETWORK_TOOLS.has(tool)) {
            if (!config.allowNetworkTools) {
                this.outputChannel.appendLine(`[Security] BLOCKED (network disabled): ${event.tool}`);
                vscode.window.showWarningMessage(`EchoCoder blocked network tool ${event.tool}. Enable echocoder.allowNetworkTools to permit it.`);
                return 'denied';
            }
            return this.promptUser(event, 'network');
        }
        return this.promptUser(event, 'unknown');
    }
    async promptUser(event, category) {
        const inputSummary = JSON.stringify(event.input, null, 2).substring(0, 600);
        const icons = {
            read: '[read]',
            write: '[write]',
            execute: '[exec]',
            network: '[network]',
            unknown: '[tool]',
        };
        const result = await vscode.window.showWarningMessage(`${icons[category] || '[tool]'} EchoCoder wants to run: ${event.tool}\n\n${inputSummary}`, { modal: true }, 'Approve', 'Deny');
        if (result === 'Approve') {
            this.outputChannel.appendLine(`[Security] User approved: ${event.tool}`);
            return 'approved';
        }
        if (result === 'Deny') {
            this.outputChannel.appendLine(`[Security] User denied: ${event.tool}`);
            return 'denied';
        }
        this.outputChannel.appendLine(`[Security] User dismissed approval prompt: ${event.tool}`);
        return 'cancelled';
    }
    extractFilePath(event) {
        const input = event.input;
        const candidate = (typeof input.path === 'string' && input.path) ||
            (typeof input.file_path === 'string' && input.file_path) ||
            (typeof input.filename === 'string' && input.filename) ||
            null;
        return candidate;
    }
    isInWorkspace(filePath) {
        const workspaceFolders = vscode.workspace.workspaceFolders || [];
        if (workspaceFolders.length === 0) {
            return true;
        }
        const resolved = this.resolvePath(filePath).toLowerCase();
        return workspaceFolders.some((folder) => {
            const root = path.resolve(folder.uri.fsPath).replace(/\\/g, '/').toLowerCase();
            return resolved === root || resolved.startsWith(`${root}/`);
        });
    }
    isSensitivePath(filePath) {
        const normalized = this.resolvePath(filePath).replace(/\\/g, '/').toLowerCase();
        if (SENSITIVE_SEGMENTS.some((segment) => normalized.includes(segment))) {
            return true;
        }
        return SENSITIVE_PATH_REGEXES.some((regex) => regex.test(normalized));
    }
    resolvePath(filePath) {
        const normalized = filePath.replace(/\\/g, '/');
        if (path.isAbsolute(normalized)) {
            return normalized;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        return path.resolve(workspaceRoot, filePath);
    }
    dispose() {
        // Nothing to dispose.
    }
}
exports.ToolInterceptor = ToolInterceptor;

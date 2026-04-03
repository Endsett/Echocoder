"use strict";
/**
 * ProcessManager
 *
 * Canonical launcher for OpenClaude print-mode runs. It owns binary
 * resolution, preflight validation, child-process lifecycle, NDJSON
 * parsing, and session-scoped logging used by all agent-backed
 * surfaces in the extension.
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
exports.ProcessManager = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const NDJSONParser_1 = require("./NDJSONParser");
const config_1 = require("../types/config");
class ProcessManager {
    outputChannel;
    process = null;
    parser = null;
    isRunning = false;
    currentRunLabel = null;
    traceChannel;
    eventCallbacks = [];
    errorCallbacks = [];
    exitCallbacks = [];
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
        this.traceChannel = vscode.window.createOutputChannel('EchoCoder: Agent Trace');
    }
    get running() {
        return this.isRunning;
    }
    get healthy() {
        return !this.isRunning;
    }
    onEvent(callback) {
        this.eventCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.eventCallbacks.indexOf(callback);
            if (idx !== -1) {
                this.eventCallbacks.splice(idx, 1);
            }
        });
    }
    onError(callback) {
        this.errorCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.errorCallbacks.indexOf(callback);
            if (idx !== -1) {
                this.errorCallbacks.splice(idx, 1);
            }
        });
    }
    onExit(callback) {
        this.exitCallbacks.push(callback);
        return new vscode.Disposable(() => {
            const idx = this.exitCallbacks.indexOf(callback);
            if (idx !== -1) {
                this.exitCallbacks.splice(idx, 1);
            }
        });
    }
    validateEnvironment(options, config = (0, config_1.getConfig)()) {
        const launchTarget = this.resolveLaunchTarget(config);
        const issues = [];
        const warnings = [];
        if (!options.cwd || !fs.existsSync(options.cwd)) {
            issues.push(`Working directory does not exist: ${options.cwd}`);
        }
        if (!config.model || config.model.trim().length === 0) {
            issues.push('No model is configured. Set `echocoder.model` before launching the agent.');
        }
        const providerVars = (0, config_1.getProviderEnv)(config);
        if (!this.hasProviderCredentials(config, providerVars)) {
            warnings.push(`No ${config.provider} credentials were found in settings or environment variables.`);
        }
        if (!launchTarget.command) {
            issues.push('No OpenClaude binary could be resolved.');
        }
        return {
            ok: issues.length === 0,
            command: launchTarget.command,
            commandArgsPrefix: launchTarget.commandArgsPrefix,
            resolvedBinaryPath: launchTarget.resolvedBinaryPath,
            displayLabel: launchTarget.displayLabel,
            issues,
            warnings,
        };
    }
    async ensureReady(options) {
        const result = this.validateEnvironment(options);
        if (!result.ok) {
            const message = `EchoCoder cannot start OpenClaude:\n- ${result.issues.join('\n- ')}`;
            this.outputChannel.appendLine(`[Preflight] ${message.replace(/\n/g, ' ')}`);
            throw new Error(message);
        }
        for (const warning of result.warnings) {
            this.outputChannel.appendLine(`[Preflight] Warning: ${warning}`);
        }
        return result;
    }
    async spawn(options, token) {
        if (this.isRunning) {
            this.abort('superseded by a new run');
        }
        const mode = options.mode || 'chat';
        const toolPolicy = options.toolPolicy || 'default';
        const config = (0, config_1.getConfig)();
        const preflight = await this.ensureReady({ cwd: options.cwd });
        const args = this.buildArgs(options, preflight);
        const providerEnv = (0, config_1.getProviderEnv)(config);
        this.currentRunLabel = `${mode}:${toolPolicy}`;
        if (config.agentTraceEnabled) {
            this.traceChannel.clear();
            this.traceChannel.show(true);
            this.traceChannel.appendLine(`[Agent Trace] Starting ${this.currentRunLabel} at ${new Date().toISOString()}`);
            this.traceChannel.appendLine(`[Agent Trace] CMD: ${preflight.command} ${preflight.commandArgsPrefix.join(' ')} ${args.join(' ')}`);
            this.traceChannel.appendLine(`[Agent Trace] CWD: ${options.cwd}`);
        }
        this.outputChannel.appendLine(`[Agent] Starting ${this.currentRunLabel} via ${preflight.displayLabel}`);
        this.process = (0, child_process_1.spawn)(preflight.command, [...preflight.commandArgsPrefix, ...args], {
            cwd: options.cwd,
            env: {
                ...process.env,
                ...providerEnv,
                TERM: 'dumb',
                NO_COLOR: '1',
                FORCE_COLOR: '0',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
        });
        if (this.process.stdin) {
            this.process.stdin.setDefaultEncoding('utf-8');
            this.process.stdin.write(options.prompt);
            this.process.stdin.end();
        }
        this.isRunning = true;
        this.parser = new NDJSONParser_1.NDJSONParser((event) => this.emitEvent(event), (line, error) => {
            this.outputChannel.appendLine(`[Parser] ${error.message}`);
            this.outputChannel.appendLine(`[Parser] Line: ${line.substring(0, 400)}`);
        });
        // Notify listeners that the system has initialized
        this.emitEvent({
            type: 'system',
            subtype: 'init',
            model: config.model,
            cwd: options.cwd,
        });
        this.process.stdout?.setEncoding('utf-8');
        this.process.stdout?.on('data', (chunk) => {
            if (config.agentTraceEnabled) {
                this.traceChannel.appendLine(`[stdout] ${chunk}`);
            }
            this.parser?.feed(chunk);
        });
        this.process.stderr?.setEncoding('utf-8');
        this.process.stderr?.on('data', (chunk) => {
            if (config.agentTraceEnabled) {
                this.traceChannel.appendLine(`[stderr] ${chunk}`);
            }
            for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
                this.outputChannel.appendLine(`[stderr] ${line}`);
                this.emitError(line);
            }
        });
        const timeoutMs = config.executionTimeout || 60000;
        const timeout = setTimeout(() => {
            if (this.isRunning) {
                this.outputChannel.appendLine(`[Agent] Execution timed out after ${timeoutMs}ms`);
                this.abort('timeout');
            }
        }, timeoutMs);
        this.process.on('exit', (code) => {
            clearTimeout(timeout);
            this.outputChannel.appendLine(`[Agent] ${this.currentRunLabel || 'run'} exited with code ${code}`);
            this.parser?.flush();
            this.cleanupAfterRun();
            this.emitExit(code);
        });
        this.process.on('error', (error) => {
            this.outputChannel.appendLine(`[Agent] Spawn error: ${error.message}`);
            this.emitError(error.message);
            this.cleanupAfterRun();
        });
        if (token) {
            token.onCancellationRequested(() => {
                this.outputChannel.appendLine(`[Agent] Cancellation requested for ${this.currentRunLabel || 'run'}`);
                this.abort('cancelled');
            });
        }
    }
    abort(reason = 'aborted') {
        if (!this.process || !this.isRunning) {
            return;
        }
        this.outputChannel.appendLine(`[Agent] Aborting ${this.currentRunLabel || 'run'} (${reason})`);
        this.process.kill('SIGTERM');
        setTimeout(() => {
            if (this.process && this.isRunning) {
                this.outputChannel.appendLine('[Agent] Force-killing unresponsive child process');
                this.process.kill('SIGKILL');
            }
        }, 3000);
    }
    dispose() {
        this.abort('dispose');
        this.eventCallbacks = [];
        this.errorCallbacks = [];
        this.exitCallbacks = [];
    }
    buildArgs(options, preflight) {
        const config = (0, config_1.getConfig)();
        const args = [
            '-p',
            '--output-format',
            'stream-json',
            '--verbose',
            '--cwd',
            options.cwd,
            '--model',
            config.model,
        ];
        if (options.toolPolicy === 'none') {
            args.push('--tools', '');
        }
        const disallowedTools = this.resolveDisallowedTools(options, config);
        if (disallowedTools.length > 0) {
            args.push('--disallowedTools', disallowedTools.join(','));
            this.outputChannel.appendLine(`[Policy] Disallowed tools: ${disallowedTools.join(', ')}`);
        }
        if (options.additionalFlags?.length) {
            args.push(...options.additionalFlags);
        }
        args.push(options.prompt);
        this.outputChannel.appendLine(`[Preflight] Resolved agent command: ${preflight.command} ${preflight.commandArgsPrefix.join(' ')}`.trim());
        return args;
    }
    resolveDisallowedTools(options, config) {
        if (options.toolPolicy === 'none') {
            return [];
        }
        const disallowed = new Set();
        const mode = options.mode || 'chat';
        // Keep terminal execution opt-in across chat/panel/compose runs.
        if (!config.terminalAutoRun) {
            disallowed.add('Bash');
            disallowed.add('PowerShell');
        }
        // Network tools are opt-in; keep them disabled unless explicitly enabled.
        if (!config.allowNetworkTools) {
            disallowed.add('WebFetch');
            disallowed.add('WebSearch');
            disallowed.add('Fetch');
            disallowed.add('Curl');
        }
        // Outside compose flows, avoid direct file mutation tools unless explicitly allowed.
        if (!config.autoApproveWrites && mode !== 'compose') {
            disallowed.add('Write');
            disallowed.add('Edit');
        }
        return Array.from(disallowed);
    }
    resolveLaunchTarget(config) {
        const explicit = this.resolveExplicitBinary(config.binaryPath);
        if (explicit) {
            return explicit;
        }
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
        const localBin = path.join(workspaceRoot, 'openclaude', 'bin', 'openclaude');
        const localDist = path.join(workspaceRoot, 'openclaude', 'dist', 'cli.mjs');
        if (fs.existsSync(localBin)) {
            return {
                command: process.execPath,
                commandArgsPrefix: [localBin],
                resolvedBinaryPath: localBin,
                displayLabel: 'workspace openclaude/bin/openclaude',
            };
        }
        if (fs.existsSync(localDist)) {
            return {
                command: process.execPath,
                commandArgsPrefix: [localDist],
                resolvedBinaryPath: localDist,
                displayLabel: 'workspace openclaude/dist/cli.mjs',
            };
        }
        const home = process.env.HOME || process.env.USERPROFILE || '';
        const candidates = process.platform === 'win32'
            ? [
                path.join(home, '.bun', 'bin', 'openclaude'),
                path.join(home, '.bun', 'bin', 'claude.exe'),
                path.join(home, 'AppData', 'Roaming', 'npm', 'openclaude.cmd'),
                path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
                'openclaude',
                'claude',
            ]
            : [
                path.join(home, '.bun', 'bin', 'openclaude'),
                path.join(home, '.bun', 'bin', 'claude'),
                '/usr/local/bin/openclaude',
                '/usr/local/bin/claude',
                'openclaude',
                'claude',
            ];
        for (const candidate of candidates) {
            const resolved = this.resolveExplicitBinary(candidate);
            if (resolved) {
                return resolved;
            }
        }
        // Last resort: raw command if it exists in PATH
        try {
            const { execSync } = require('child_process');
            const testCmd = process.platform === 'win32' ? 'where' : 'which';
            execSync(`${testCmd} openclaude`);
            return {
                command: 'openclaude',
                commandArgsPrefix: [],
                resolvedBinaryPath: 'PATH',
                displayLabel: 'openclaude (from PATH)',
            };
        }
        catch {
            // openclaude not in PATH
        }
        return {
            command: 'openclaude',
            commandArgsPrefix: [],
            resolvedBinaryPath: 'openclaude',
            displayLabel: 'openclaude',
        };
    }
    resolveExplicitBinary(binaryPath) {
        if (!binaryPath || binaryPath.trim().length === 0) {
            return null;
        }
        const trimmed = binaryPath.trim();
        const isJsEntrypoint = trimmed.endsWith('.js') || trimmed.endsWith('.mjs');
        const isExistingFile = this.isExistingFile(trimmed);
        if (isExistingFile && isJsEntrypoint) {
            return {
                command: process.execPath,
                commandArgsPrefix: [trimmed],
                resolvedBinaryPath: trimmed,
                displayLabel: trimmed,
            };
        }
        if (isExistingFile) {
            return {
                command: trimmed,
                commandArgsPrefix: [],
                resolvedBinaryPath: trimmed,
                displayLabel: trimmed,
            };
        }
        if (!trimmed.includes(path.sep)) {
            return {
                command: trimmed,
                commandArgsPrefix: [],
                resolvedBinaryPath: trimmed,
                displayLabel: trimmed,
            };
        }
        return null;
    }
    isExistingFile(candidate) {
        try {
            return fs.existsSync(candidate);
        }
        catch {
            return false;
        }
    }
    hasProviderCredentials(config, providerEnv) {
        if (config.provider === 'ollama') {
            return true;
        }
        const keysToCheck = Object.keys(providerEnv).filter((key) => key.endsWith('_API_KEY'));
        return keysToCheck.some((key) => Boolean(providerEnv[key] || process.env[key]));
    }
    cleanupAfterRun() {
        this.isRunning = false;
        this.currentRunLabel = null;
        this.process = null;
        this.parser = null;
    }
    emitEvent(event) {
        for (const cb of this.eventCallbacks) {
            try {
                cb(event);
            }
            catch {
                // Keep the agent stream alive even if one surface handler fails.
            }
        }
    }
    emitError(message) {
        for (const cb of this.errorCallbacks) {
            try {
                cb(message);
            }
            catch {
                // Ignore callback failures.
            }
        }
    }
    emitExit(code) {
        for (const cb of this.exitCallbacks) {
            try {
                cb(code);
            }
            catch {
                // Ignore callback failures.
            }
        }
    }
}
exports.ProcessManager = ProcessManager;

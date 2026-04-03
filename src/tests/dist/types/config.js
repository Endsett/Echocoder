"use strict";
/**
 * EchoCoder Configuration Types
 *
 * Type-safe interface mirroring the contributes.configuration
 * settings defined in package.json.
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
exports.getConfig = getConfig;
exports.getProviderEnv = getProviderEnv;
const vscode = __importStar(require("vscode"));
/**
 * Reads the current EchoCoder configuration from VS Code settings.
 * Always returns fresh values (no caching — config changes are immediate).
 */
function getConfig() {
    const cfg = vscode.workspace.getConfiguration('echocoder');
    return {
        binaryPath: cfg.get('binaryPath', ''),
        provider: cfg.get('provider', 'anthropic'),
        apiKey: cfg.get('apiKey', ''),
        apiBaseUrl: cfg.get('apiBaseUrl', ''),
        model: cfg.get('model', 'claude-sonnet-4-20250514'),
        maxTokenBudget: cfg.get('maxTokenBudget', 85),
        autoApproveReads: cfg.get('autoApproveReads', true),
        autoApproveWrites: cfg.get('autoApproveWrites', false),
        terminalAutoRun: cfg.get('terminalAutoRun', false),
        allowNetworkTools: cfg.get('allowNetworkTools', false),
        ghostTextEnabled: cfg.get('ghostText.enabled', true),
        ghostTextDebounceMs: cfg.get('ghostText.debounceMs', 300),
        contextFiles: cfg.get('contextFiles', 10),
        executionTimeout: cfg.get('executionTimeout', 60000),
        agentTraceEnabled: cfg.get('agentTraceEnabled', false),
    };
}
/**
 * Resolves the environment variables to inject into the OpenClaude
 * child process based on the current provider configuration.
 */
function getProviderEnv(config) {
    const env = {};
    switch (config.provider) {
        case 'anthropic':
            if (config.apiKey) {
                env['ANTHROPIC_API_KEY'] = config.apiKey;
            }
            env['ANTHROPIC_MODEL'] = config.model;
            break;
        case 'openai':
            if (config.apiKey) {
                env['OPENAI_API_KEY'] = config.apiKey;
            }
            env['OPENAI_MODEL'] = config.model;
            if (config.apiBaseUrl) {
                env['OPENAI_BASE_URL'] = config.apiBaseUrl;
            }
            break;
        case 'deepseek':
            if (config.apiKey) {
                env['OPENAI_API_KEY'] = config.apiKey;
            }
            env['OPENAI_MODEL'] = config.model;
            env['OPENAI_BASE_URL'] = config.apiBaseUrl || 'https://api.deepseek.com/v1';
            break;
        case 'ollama':
            env['OPENAI_API_KEY'] = 'ollama';
            env['OPENAI_MODEL'] = config.model;
            env['OPENAI_BASE_URL'] = config.apiBaseUrl || 'http://localhost:11434/v1';
            break;
        case 'custom':
            if (config.apiKey) {
                env['OPENAI_API_KEY'] = config.apiKey;
            }
            env['OPENAI_MODEL'] = config.model;
            if (config.apiBaseUrl) {
                env['OPENAI_BASE_URL'] = config.apiBaseUrl;
            }
            break;
    }
    return env;
}

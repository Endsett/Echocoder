"use strict";
/**
 * StatusBarManager — Persistent Status Bar Items
 *
 * Displays agent status, active model, and token budget in the
 * VS Code status bar. Provides real-time feedback on agent activity.
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
exports.StatusBarManager = void 0;
const vscode = __importStar(require("vscode"));
const config_1 = require("../types/config");
class StatusBarManager {
    constructor(eventRouter, processManager) {
        this.eventRouter = eventRouter;
        this.processManager = processManager;
        // Left side: Agent status
        this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.statusItem.command = 'echocoder.openPanel';
        this.setIdle();
        this.statusItem.show();
        // Right side: Model name
        this.modelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
        this.updateModel();
        this.modelItem.show();
        // Right side: Token counter
        this.tokenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.tokenItem.command = 'echocoder.compact';
        this.tokenItem.tooltip = 'Click to compact context';
        this.tokenItem.hide(); // Hidden until first usage event
        this.wireEvents();
    }
    wireEvents() {
        this.eventRouter.onInit(() => {
            this.setWorking('Initializing...');
        });
        this.eventRouter.onTextDelta(() => {
            this.setWorking('Generating...');
        });
        this.eventRouter.onToolCall((event) => {
            this.setWorking(`Running ${event.tool}...`);
        });
        this.eventRouter.onUsage((event) => {
            const total = event.usage.input_tokens + event.usage.output_tokens;
            this.updateTokens(total);
        });
        this.eventRouter.onSuccess(() => {
            this.setIdle();
        });
        this.eventRouter.onError(() => {
            this.setError();
        });
        this.processManager.onExit(() => {
            this.setIdle();
        });
        // Listen for config changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('echocoder.model') || e.affectsConfiguration('echocoder.provider')) {
                this.updateModel();
            }
        });
    }
    setIdle() {
        this.statusItem.text = '$(hubot) EchoCoder';
        this.statusItem.tooltip = 'EchoCoder AI — Ready';
        this.statusItem.backgroundColor = undefined;
    }
    setWorking(detail) {
        this.statusItem.text = `$(sync~spin) EchoCoder: ${detail}`;
        this.statusItem.tooltip = 'EchoCoder AI — Working...';
    }
    setError() {
        this.statusItem.text = '$(error) EchoCoder: Error';
        this.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        setTimeout(() => this.setIdle(), 5000);
    }
    updateModel() {
        const config = (0, config_1.getConfig)();
        const shortModel = config.model.split('/').pop()?.substring(0, 20) || config.model;
        this.modelItem.text = `$(symbol-misc) ${shortModel}`;
        this.modelItem.tooltip = `EchoCoder Model: ${config.model} (${config.provider})`;
    }
    updateTokens(total) {
        this.tokenItem.show();
        const config = (0, config_1.getConfig)();
        const formatted = total.toLocaleString();
        // Color coding based on budget threshold
        const threshold = config.maxTokenBudget;
        // Estimate max tokens (varies by model, use 200k as baseline)
        const estimatedMax = 200000;
        const percentage = (total / estimatedMax) * 100;
        if (percentage > threshold) {
            this.tokenItem.text = `$(warning) ${formatted} tokens`;
            this.tokenItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else if (percentage > 60) {
            this.tokenItem.text = `$(dashboard) ${formatted} tokens`;
            this.tokenItem.backgroundColor = undefined;
        }
        else {
            this.tokenItem.text = `$(dashboard) ${formatted} tokens`;
            this.tokenItem.backgroundColor = undefined;
        }
    }
    dispose() {
        this.statusItem.dispose();
        this.tokenItem.dispose();
        this.modelItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;

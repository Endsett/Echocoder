"use strict";
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
exports.EventRouter = void 0;
const vscode = __importStar(require("vscode"));
const agent_events_1 = require("../types/agent-events");
class EventRouter {
    constructor() {
        this._onTextDelta = new vscode.EventEmitter();
        this._onThinkingDelta = new vscode.EventEmitter();
        this._onToolCall = new vscode.EventEmitter();
        this._onToolResult = new vscode.EventEmitter();
        this._onToolProgress = new vscode.EventEmitter();
        this._onFileEdit = new vscode.EventEmitter();
        this._onFileCreate = new vscode.EventEmitter();
        this._onUsage = new vscode.EventEmitter();
        this._onInit = new vscode.EventEmitter();
        this._onSuccess = new vscode.EventEmitter();
        this._onError = new vscode.EventEmitter();
        this._onAnyEvent = new vscode.EventEmitter();
        this.onTextDelta = this._onTextDelta.event;
        this.onThinkingDelta = this._onThinkingDelta.event;
        this.onToolCall = this._onToolCall.event;
        this.onToolResult = this._onToolResult.event;
        this.onToolProgress = this._onToolProgress.event;
        this.onFileEdit = this._onFileEdit.event;
        this.onFileCreate = this._onFileCreate.event;
        this.onUsage = this._onUsage.event;
        this.onInit = this._onInit.event;
        this.onSuccess = this._onSuccess.event;
        this.onError = this._onError.event;
        this.onAnyEvent = this._onAnyEvent.event;
        this._totalInputTokens = 0;
        this._totalOutputTokens = 0;
    }
    get totalInputTokens() {
        return this._totalInputTokens;
    }
    get totalOutputTokens() {
        return this._totalOutputTokens;
    }
    get totalTokens() {
        return this._totalInputTokens + this._totalOutputTokens;
    }
    route(event) {
        this._onAnyEvent.fire(event);
        if ((0, agent_events_1.isTextDelta)(event)) {
            this._onTextDelta.fire(event);
            return;
        }
        if ((0, agent_events_1.isThinkingDelta)(event)) {
            this._onThinkingDelta.fire(event);
            return;
        }
        if ((0, agent_events_1.isToolCall)(event)) {
            this._onToolCall.fire(event);
            return;
        }
        if ((0, agent_events_1.isToolResult)(event)) {
            this._onToolResult.fire(event);
            return;
        }
        if ((0, agent_events_1.isRawToolProgressEvent)(event)) {
            this._onToolProgress.fire(event);
            return;
        }
        if ((0, agent_events_1.isFileEdit)(event)) {
            this._onFileEdit.fire(event);
            return;
        }
        if ((0, agent_events_1.isFileCreate)(event)) {
            this._onFileCreate.fire(event);
            return;
        }
        if ((0, agent_events_1.isUsageEvent)(event)) {
            this._totalInputTokens = event.usage.input_tokens;
            this._totalOutputTokens = event.usage.output_tokens;
            this._onUsage.fire(event);
            return;
        }
        if (event.type === 'system' && event.subtype === 'init') {
            this._onInit.fire(event);
            return;
        }
        if ((0, agent_events_1.isResultSuccess)(event)) {
            if (event.usage) {
                this._totalInputTokens = event.usage.input_tokens;
                this._totalOutputTokens = event.usage.output_tokens;
            }
            this._onSuccess.fire(event);
            return;
        }
        if ((0, agent_events_1.isResultError)(event)) {
            this._onError.fire(event);
        }
    }
    resetTokens() {
        this._totalInputTokens = 0;
        this._totalOutputTokens = 0;
    }
    dispose() {
        this._onTextDelta.dispose();
        this._onThinkingDelta.dispose();
        this._onToolCall.dispose();
        this._onToolResult.dispose();
        this._onToolProgress.dispose();
        this._onFileEdit.dispose();
        this._onFileCreate.dispose();
        this._onUsage.dispose();
        this._onInit.dispose();
        this._onSuccess.dispose();
        this._onError.dispose();
        this._onAnyEvent.dispose();
    }
}
exports.EventRouter = EventRouter;

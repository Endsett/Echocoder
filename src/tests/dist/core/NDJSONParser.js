"use strict";
/**
 * NDJSONParser
 *
 * Parses the OpenClaude `--output-format stream-json --verbose`
 * stream, preserves the raw top-level event objects, and derives
 * normalized text/tool/file events used by the rest of the extension.
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
exports.NDJSONParser = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class NDJSONParser {
    buffer = '';
    onEvent;
    onError;
    pendingTools = new Map();
    constructor(onEvent, onError) {
        this.onEvent = onEvent;
        this.onError = onError || (() => { });
    }
    feed(chunk) {
        this.buffer += chunk;
        this.processBuffer();
    }
    processBuffer() {
        const MAX_BUFFER_SIZE = 5 * 1024 * 1024; // 5MB limit
        if (this.buffer.length > MAX_BUFFER_SIZE) {
            this.onError(this.buffer.substring(0, 100), new Error('Buffer overflow: stream exceeded 5MB without a newline.'));
            this.buffer = '';
            return;
        }
        let newlineIndex;
        while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
            const line = this.buffer.slice(0, newlineIndex).trim();
            this.buffer = this.buffer.slice(newlineIndex + 1);
            if (line.length === 0) {
                continue;
            }
            // Check if line is likely JSON before parsing
            if (!line.startsWith('{')) {
                // Log non-JSON output separately instead of as a parse error
                this.emitRawDebug(line);
                continue;
            }
            this.parseLine(line);
        }
    }
    emitRawDebug(line) {
        this.onEvent({
            type: 'system',
            subtype: 'log',
            message: `[Raw CLI] ${line}`,
        });
    }
    parseLine(line) {
        try {
            const parsed = JSON.parse(line);
            const events = this.normalizeParsedObject(parsed);
            if (events.length === 0) {
                this.onError(line, new Error('Parsed JSON did not match a supported event shape'));
                return;
            }
            for (const event of events) {
                this.onEvent(event);
            }
        }
        catch (err) {
            this.onError(line, err instanceof Error ? err : new Error(String(err)));
        }
    }
    normalizeParsedObject(parsed) {
        if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
            return [];
        }
        const event = parsed;
        const type = typeof event.type === 'string' ? event.type : '';
        const normalized = [];
        switch (type) {
            case 'assistant':
                normalized.push(...this.handleAssistantEvent(event));
                break;
            case 'user':
                normalized.push(...this.handleUserEvent(event));
                break;
            case 'result':
                normalized.push(this.normalizeResultEvent(event));
                break;
            case 'system':
            case 'tool_progress':
                normalized.push(event);
                break;
            default:
                break;
        }
        return normalized;
    }
    handleAssistantEvent(event) {
        const events = [event];
        const content = Array.isArray(event.message?.content) ? event.message.content : [];
        for (const block of content) {
            if (!block || typeof block !== 'object' || !('type' in block)) {
                continue;
            }
            if (block.type === 'text' && typeof block.text === 'string') {
                events.push({
                    type: 'normalized',
                    subtype: 'text_delta',
                    text: block.text,
                });
                continue;
            }
            if (block.type === 'thinking' && typeof block.thinking === 'string') {
                events.push({
                    type: 'normalized',
                    subtype: 'thinking_delta',
                    text: block.thinking,
                });
                continue;
            }
            if (block.type === 'tool_use') {
                const toolBlock = block;
                if (!toolBlock.id || !toolBlock.name || typeof toolBlock.input !== 'object' || toolBlock.input === null) {
                    continue;
                }
                this.pendingTools.set(toolBlock.id, this.captureToolSnapshot(toolBlock));
                events.push({
                    type: 'normalized',
                    subtype: 'tool_call',
                    tool: toolBlock.name,
                    tool_call_id: toolBlock.id,
                    input: toolBlock.input,
                });
            }
        }
        return events;
    }
    handleUserEvent(event) {
        const events = [event];
        const content = Array.isArray(event.message?.content) ? event.message.content : [];
        for (const block of content) {
            if (!block || typeof block !== 'object' || !('type' in block) || block.type !== 'tool_result') {
                continue;
            }
            const toolUseId = typeof block.tool_use_id === 'string' ? block.tool_use_id : '';
            if (!toolUseId) {
                continue;
            }
            const pendingTool = this.pendingTools.get(toolUseId);
            const output = this.stringifyToolResultContent(block.content);
            const isError = Boolean(block.is_error);
            const toolResultEvent = {
                type: 'normalized',
                subtype: 'tool_result',
                tool: pendingTool?.tool || 'unknown',
                tool_call_id: toolUseId,
                output,
                is_error: isError,
            };
            events.push(toolResultEvent);
            if (!isError && pendingTool) {
                const fileEvent = this.createSyntheticFileEvent(pendingTool);
                if (fileEvent) {
                    events.push(fileEvent);
                }
            }
            this.pendingTools.delete(toolUseId);
        }
        return events;
    }
    normalizeResultEvent(event) {
        const subtype = typeof event.subtype === 'string' ? event.subtype : 'error';
        const result = typeof event.result === 'string' ? event.result : '';
        const error = typeof event.error === 'string'
            ? event.error
            : result || 'OpenClaude exited without returning a successful result.';
        if (subtype === 'success') {
            return {
                type: 'result',
                subtype: 'success',
                result,
                usage: this.extractUsage(event.usage),
                session_id: typeof event.session_id === 'string' ? event.session_id : undefined,
                is_error: false,
            };
        }
        return {
            type: 'result',
            subtype: subtype,
            result,
            error,
            usage: this.extractUsage(event.usage),
            session_id: typeof event.session_id === 'string' ? event.session_id : undefined,
            is_error: Boolean(event.is_error ?? true),
        };
    }
    extractUsage(usage) {
        if (!usage || typeof usage !== 'object') {
            return undefined;
        }
        const candidate = usage;
        if (typeof candidate.input_tokens !== 'number' || typeof candidate.output_tokens !== 'number') {
            return undefined;
        }
        return candidate;
    }
    captureToolSnapshot(block) {
        const snapshot = {
            tool: block.name,
            input: block.input,
        };
        const rawPath = this.extractFilePath(block.input);
        if (!rawPath) {
            return snapshot;
        }
        const resolvedPath = this.resolvePath(rawPath);
        snapshot.resolvedPath = resolvedPath;
        snapshot.existedBefore = fs.existsSync(resolvedPath);
        if (snapshot.existedBefore) {
            try {
                snapshot.oldContent = fs.readFileSync(resolvedPath, 'utf8');
            }
            catch {
                snapshot.oldContent = '';
            }
        }
        else {
            snapshot.oldContent = '';
        }
        return snapshot;
    }
    createSyntheticFileEvent(snapshot) {
        const toolName = snapshot.tool.toLowerCase();
        if (!snapshot.resolvedPath) {
            return null;
        }
        if (toolName !== 'write' && toolName !== 'edit') {
            return null;
        }
        let newContent = '';
        try {
            if (fs.existsSync(snapshot.resolvedPath)) {
                newContent = fs.readFileSync(snapshot.resolvedPath, 'utf8');
            }
        }
        catch {
            if (typeof snapshot.input.content === 'string') {
                newContent = snapshot.input.content;
            }
        }
        if (toolName === 'write' && !snapshot.existedBefore) {
            return {
                type: 'normalized',
                subtype: 'file_create',
                path: this.extractFilePath(snapshot.input) || snapshot.resolvedPath,
                content: newContent || (typeof snapshot.input.content === 'string' ? snapshot.input.content : ''),
                derived_from_tool: true,
            };
        }
        return {
            type: 'normalized',
            subtype: 'file_edit',
            path: this.extractFilePath(snapshot.input) || snapshot.resolvedPath,
            old_content: snapshot.oldContent || '',
            new_content: newContent || snapshot.oldContent || '',
            derived_from_tool: true,
        };
    }
    stringifyToolResultContent(content) {
        if (typeof content === 'string') {
            return content;
        }
        if (Array.isArray(content)) {
            return content.map((entry) => this.stringifyToolResultContent(entry)).join('\n');
        }
        if (content && typeof content === 'object') {
            try {
                return JSON.stringify(content, null, 2);
            }
            catch {
                return String(content);
            }
        }
        return String(content ?? '');
    }
    extractFilePath(input) {
        const value = input.file_path ?? input.path ?? input.filename;
        return typeof value === 'string' && value.trim().length > 0 ? value : null;
    }
    resolvePath(filePath) {
        if (path.isAbsolute(filePath)) {
            return filePath;
        }
        const workspaceFolder = require('vscode').workspace.workspaceFolders?.[0]?.uri.fsPath;
        return path.resolve(workspaceFolder || process.cwd(), filePath);
    }
    flush() {
        const remaining = this.buffer.trim();
        if (remaining.length > 0) {
            this.parseLine(remaining);
        }
        this.buffer = '';
    }
    reset() {
        this.buffer = '';
        this.pendingTools.clear();
    }
}
exports.NDJSONParser = NDJSONParser;

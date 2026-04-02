/**
 * NDJSONParser
 *
 * Parses the OpenClaude `--output-format stream-json --verbose`
 * stream, preserves the raw top-level event objects, and derives
 * normalized text/tool/file events used by the rest of the extension.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  AgentEvent,
  AssistantThinkingBlock,
  AssistantToolUseBlock,
  AssistantTextBlock,
  FileCreateEvent,
  FileEditEvent,
  RawAssistantEvent,
  RawUserEvent,
  ResultErrorEvent,
  ResultSuccessEvent,
  ToolCallEvent,
  ToolResultEvent,
} from '../types/agent-events';

export type ParsedEventCallback = (event: AgentEvent) => void;
export type ParseErrorCallback = (line: string, error: Error) => void;

interface PendingToolSnapshot {
  tool: string;
  input: Record<string, unknown>;
  resolvedPath?: string;
  existedBefore?: boolean;
  oldContent?: string;
}

export class NDJSONParser {
  private buffer = '';
  private readonly onEvent: ParsedEventCallback;
  private readonly onError: ParseErrorCallback;
  private readonly pendingTools = new Map<string, PendingToolSnapshot>();

  constructor(onEvent: ParsedEventCallback, onError?: ParseErrorCallback) {
    this.onEvent = onEvent;
    this.onError = onError || (() => {});
  }

  public feed(chunk: string): void {
    this.buffer += chunk;
    this.processBuffer();
  }

  private processBuffer(): void {
    let newlineIndex: number;

    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length === 0) {
        continue;
      }

      this.parseLine(line);
    }
  }

  private parseLine(line: string): void {
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
    } catch (err) {
      this.onError(line, err instanceof Error ? err : new Error(String(err)));
    }
  }

  private normalizeParsedObject(parsed: unknown): AgentEvent[] {
    if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) {
      return [];
    }

    const event = parsed as Record<string, unknown>;
    const type = typeof event.type === 'string' ? event.type : '';
    const normalized: AgentEvent[] = [];

    switch (type) {
      case 'assistant':
        normalized.push(...this.handleAssistantEvent(event as unknown as RawAssistantEvent));
        break;
      case 'user':
        normalized.push(...this.handleUserEvent(event as unknown as RawUserEvent));
        break;
      case 'result':
        normalized.push(this.normalizeResultEvent(event));
        break;
      case 'system':
      case 'tool_progress':
        normalized.push(event as unknown as AgentEvent);
        break;
      default:
        break;
    }

    return normalized;
  }

  private handleAssistantEvent(event: RawAssistantEvent): AgentEvent[] {
    const events: AgentEvent[] = [event];
    const content = Array.isArray(event.message?.content) ? event.message.content : [];

    for (const block of content) {
      if (!block || typeof block !== 'object' || !('type' in block)) {
        continue;
      }

      if (block.type === 'text' && typeof (block as AssistantTextBlock).text === 'string') {
        events.push({
          type: 'normalized',
          subtype: 'text_delta',
          text: (block as AssistantTextBlock).text,
        });
        continue;
      }

      if (block.type === 'thinking' && typeof (block as AssistantThinkingBlock).thinking === 'string') {
        events.push({
          type: 'normalized',
          subtype: 'thinking_delta',
          text: (block as AssistantThinkingBlock).thinking,
        });
        continue;
      }

      if (block.type === 'tool_use') {
        const toolBlock = block as AssistantToolUseBlock;
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

  private handleUserEvent(event: RawUserEvent): AgentEvent[] {
    const events: AgentEvent[] = [event];
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
      const output = this.stringifyToolResultContent((block as Record<string, unknown>).content);
      const isError = Boolean((block as Record<string, unknown>).is_error);

      const toolResultEvent: ToolResultEvent = {
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
    }

    return events;
  }

  private normalizeResultEvent(event: Record<string, unknown>): ResultSuccessEvent | ResultErrorEvent {
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
      subtype: subtype as ResultErrorEvent['subtype'],
      result,
      error,
      usage: this.extractUsage(event.usage),
      session_id: typeof event.session_id === 'string' ? event.session_id : undefined,
      is_error: Boolean(event.is_error ?? true),
    };
  }

  private extractUsage(usage: unknown): ResultSuccessEvent['usage'] | undefined {
    if (!usage || typeof usage !== 'object') {
      return undefined;
    }

    const candidate = usage as Record<string, unknown>;
    if (typeof candidate.input_tokens !== 'number' || typeof candidate.output_tokens !== 'number') {
      return undefined;
    }

    return candidate as unknown as ResultSuccessEvent['usage'];
  }

  private captureToolSnapshot(block: AssistantToolUseBlock): PendingToolSnapshot {
    const snapshot: PendingToolSnapshot = {
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
      } catch {
        snapshot.oldContent = '';
      }
    } else {
      snapshot.oldContent = '';
    }

    return snapshot;
  }

  private createSyntheticFileEvent(snapshot: PendingToolSnapshot): FileEditEvent | FileCreateEvent | null {
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
    } catch {
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
      };
    }

    return {
      type: 'normalized',
      subtype: 'file_edit',
      path: this.extractFilePath(snapshot.input) || snapshot.resolvedPath,
      old_content: snapshot.oldContent || '',
      new_content: newContent || snapshot.oldContent || '',
    };
  }

  private stringifyToolResultContent(content: unknown): string {
    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content.map((entry) => this.stringifyToolResultContent(entry)).join('\n');
    }

    if (content && typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch {
        return String(content);
      }
    }

    return String(content ?? '');
  }

  private extractFilePath(input: Record<string, unknown>): string | null {
    const value = input.file_path ?? input.path ?? input.filename;
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private resolvePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    const workspaceFolder = require('vscode').workspace.workspaceFolders?.[0]?.uri.fsPath;
    return path.resolve(workspaceFolder || process.cwd(), filePath);
  }

  public flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      this.parseLine(remaining);
    }
    this.buffer = '';
  }

  public reset(): void {
    this.buffer = '';
    this.pendingTools.clear();
  }
}

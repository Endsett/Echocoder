/**
 * EventRouter — Central Event Bus for All IDE Surfaces
 * 
 * Distributes parsed AgentEvent objects from the NDJSONParser to
 * all registered IDE surfaces: Agent Panel, Inline Editor, Diff
 * Review, Status Bar, Terminal, and Security Interceptor.
 * 
 * Uses VS Code's EventEmitter pattern for typed, decoupled subscriptions.
 */

import * as vscode from 'vscode';
import {
  AgentEvent,
  TextDeltaEvent,
  ThinkingDeltaEvent,
  ToolCallEvent,
  ToolResultEvent,
  FileEditEvent,
  FileCreateEvent,
  SystemUsageEvent,
  SystemInitEvent,
  ResultSuccessEvent,
  ResultErrorEvent,
  isTextDelta,
  isToolCall,
  isToolResult,
  isFileEdit,
  isFileCreate,
  isUsageEvent,
  isResultSuccess,
  isResultError,
} from '../types/agent-events';

export class EventRouter {
  // ─── Typed Event Emitters ─────────────────────────────────────
  private readonly _onTextDelta = new vscode.EventEmitter<TextDeltaEvent>();
  private readonly _onThinkingDelta = new vscode.EventEmitter<ThinkingDeltaEvent>();
  private readonly _onToolCall = new vscode.EventEmitter<ToolCallEvent>();
  private readonly _onToolResult = new vscode.EventEmitter<ToolResultEvent>();
  private readonly _onFileEdit = new vscode.EventEmitter<FileEditEvent>();
  private readonly _onFileCreate = new vscode.EventEmitter<FileCreateEvent>();
  private readonly _onUsage = new vscode.EventEmitter<SystemUsageEvent>();
  private readonly _onInit = new vscode.EventEmitter<SystemInitEvent>();
  private readonly _onSuccess = new vscode.EventEmitter<ResultSuccessEvent>();
  private readonly _onError = new vscode.EventEmitter<ResultErrorEvent>();
  private readonly _onAnyEvent = new vscode.EventEmitter<AgentEvent>();

  // ─── Public Event Subscriptions ───────────────────────────────
  /** Fired for each text chunk the agent streams (typewriter text). */
  public readonly onTextDelta = this._onTextDelta.event;

  /** Fired for agent thinking/reasoning text (may be hidden from user). */
  public readonly onThinkingDelta = this._onThinkingDelta.event;

  /** Fired when the agent requests to execute a tool. */
  public readonly onToolCall = this._onToolCall.event;

  /** Fired when a tool execution completes. */
  public readonly onToolResult = this._onToolResult.event;

  /** Fired when the agent proposes a file edit (inline diff). */
  public readonly onFileEdit = this._onFileEdit.event;

  /** Fired when the agent creates a new file. */
  public readonly onFileCreate = this._onFileCreate.event;

  /** Fired when token usage metrics are updated. */
  public readonly onUsage = this._onUsage.event;

  /** Fired when the agent session initializes. */
  public readonly onInit = this._onInit.event;

  /** Fired on successful agent completion. */
  public readonly onSuccess = this._onSuccess.event;

  /** Fired on agent error. */
  public readonly onError = this._onError.event;

  /** Fired for every event (for logging/debugging). */
  public readonly onAnyEvent = this._onAnyEvent.event;

  // ─── Token Tracking ───────────────────────────────────────────
  private _totalInputTokens: number = 0;
  private _totalOutputTokens: number = 0;

  public get totalInputTokens(): number { return this._totalInputTokens; }
  public get totalOutputTokens(): number { return this._totalOutputTokens; }
  public get totalTokens(): number { return this._totalInputTokens + this._totalOutputTokens; }

  /**
   * Route a single AgentEvent to the appropriate typed emitter.
   * This is the main entry point called by the ProcessManager.
   */
  public route(event: AgentEvent): void {
    // Always emit on the catch-all
    this._onAnyEvent.fire(event);

    // Route to specific typed emitter
    if (isTextDelta(event)) {
      this._onTextDelta.fire(event);
    } else if (event.type === 'assistant' && event.subtype === 'thinking_delta') {
      this._onThinkingDelta.fire(event as ThinkingDeltaEvent);
    } else if (isToolCall(event)) {
      this._onToolCall.fire(event);
    } else if (isToolResult(event)) {
      this._onToolResult.fire(event);
    } else if (isFileEdit(event)) {
      this._onFileEdit.fire(event);
    } else if (isFileCreate(event)) {
      this._onFileCreate.fire(event);
    } else if (isUsageEvent(event)) {
      this._totalInputTokens = event.usage.input_tokens;
      this._totalOutputTokens = event.usage.output_tokens;
      this._onUsage.fire(event);
    } else if (event.type === 'system' && event.subtype === 'init') {
      this._onInit.fire(event as SystemInitEvent);
    } else if (isResultSuccess(event)) {
      if (event.usage) {
        this._totalInputTokens = event.usage.input_tokens;
        this._totalOutputTokens = event.usage.output_tokens;
      }
      this._onSuccess.fire(event);
    } else if (isResultError(event)) {
      this._onError.fire(event);
    }
  }

  /**
   * Reset token counters for a new session.
   */
  public resetTokens(): void {
    this._totalInputTokens = 0;
    this._totalOutputTokens = 0;
  }

  /**
   * Dispose all event emitters.
   */
  public dispose(): void {
    this._onTextDelta.dispose();
    this._onThinkingDelta.dispose();
    this._onToolCall.dispose();
    this._onToolResult.dispose();
    this._onFileEdit.dispose();
    this._onFileCreate.dispose();
    this._onUsage.dispose();
    this._onInit.dispose();
    this._onSuccess.dispose();
    this._onError.dispose();
    this._onAnyEvent.dispose();
  }
}

import * as vscode from 'vscode';
import {
  AgentEvent,
  FileCreateEvent,
  FileEditEvent,
  RawToolProgressEvent,
  ResultErrorEvent,
  ResultSuccessEvent,
  SystemInitEvent,
  SystemUsageEvent,
  TextDeltaEvent,
  ThinkingDeltaEvent,
  ToolCallEvent,
  ToolResultEvent,
  isFileCreate,
  isFileEdit,
  isRawToolProgressEvent,
  isResultError,
  isResultSuccess,
  isTextDelta,
  isThinkingDelta,
  isToolCall,
  isToolResult,
  isUsageEvent,
} from '../types/agent-events';

export class EventRouter {
  private readonly _onTextDelta = new vscode.EventEmitter<TextDeltaEvent>();
  private readonly _onThinkingDelta = new vscode.EventEmitter<ThinkingDeltaEvent>();
  private readonly _onToolCall = new vscode.EventEmitter<ToolCallEvent>();
  private readonly _onToolResult = new vscode.EventEmitter<ToolResultEvent>();
  private readonly _onToolProgress = new vscode.EventEmitter<RawToolProgressEvent>();
  private readonly _onFileEdit = new vscode.EventEmitter<FileEditEvent>();
  private readonly _onFileCreate = new vscode.EventEmitter<FileCreateEvent>();
  private readonly _onUsage = new vscode.EventEmitter<SystemUsageEvent>();
  private readonly _onInit = new vscode.EventEmitter<SystemInitEvent>();
  private readonly _onSuccess = new vscode.EventEmitter<ResultSuccessEvent>();
  private readonly _onError = new vscode.EventEmitter<ResultErrorEvent>();
  private readonly _onAnyEvent = new vscode.EventEmitter<AgentEvent>();

  public readonly onTextDelta = this._onTextDelta.event;
  public readonly onThinkingDelta = this._onThinkingDelta.event;
  public readonly onToolCall = this._onToolCall.event;
  public readonly onToolResult = this._onToolResult.event;
  public readonly onToolProgress = this._onToolProgress.event;
  public readonly onFileEdit = this._onFileEdit.event;
  public readonly onFileCreate = this._onFileCreate.event;
  public readonly onUsage = this._onUsage.event;
  public readonly onInit = this._onInit.event;
  public readonly onSuccess = this._onSuccess.event;
  public readonly onError = this._onError.event;
  public readonly onAnyEvent = this._onAnyEvent.event;

  private _totalInputTokens = 0;
  private _totalOutputTokens = 0;

  public get totalInputTokens(): number {
    return this._totalInputTokens;
  }

  public get totalOutputTokens(): number {
    return this._totalOutputTokens;
  }

  public get totalTokens(): number {
    return this._totalInputTokens + this._totalOutputTokens;
  }

  public route(event: AgentEvent): void {
    this._onAnyEvent.fire(event);

    if (isTextDelta(event)) {
      this._onTextDelta.fire(event);
      return;
    }

    if (isThinkingDelta(event)) {
      this._onThinkingDelta.fire(event);
      return;
    }

    if (isToolCall(event)) {
      this._onToolCall.fire(event);
      return;
    }

    if (isToolResult(event)) {
      this._onToolResult.fire(event);
      return;
    }

    if (isRawToolProgressEvent(event)) {
      this._onToolProgress.fire(event);
      return;
    }

    if (isFileEdit(event)) {
      this._onFileEdit.fire(event);
      return;
    }

    if (isFileCreate(event)) {
      this._onFileCreate.fire(event);
      return;
    }

    if (isUsageEvent(event)) {
      this._totalInputTokens = event.usage.input_tokens;
      this._totalOutputTokens = event.usage.output_tokens;
      this._onUsage.fire(event);
      return;
    }

    if (event.type === 'system' && event.subtype === 'init') {
      this._onInit.fire(event);
      return;
    }

    if (isResultSuccess(event)) {
      if (event.usage) {
        this._totalInputTokens = event.usage.input_tokens;
        this._totalOutputTokens = event.usage.output_tokens;
      }
      this._onSuccess.fire(event);
      return;
    }

    if (isResultError(event)) {
      this._onError.fire(event);
    }
  }

  public resetTokens(): void {
    this._totalInputTokens = 0;
    this._totalOutputTokens = 0;
  }

  public dispose(): void {
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

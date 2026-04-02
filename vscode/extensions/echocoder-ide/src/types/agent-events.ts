/**
 * EchoCoder Agent Events — NDJSON Event Type System
 * 
 * Discriminated union of all events emitted by the OpenClaude binary
 * through its stdout stream when running with --output-format stream-json.
 * 
 * Each line of the stdout stream is a single JSON object matching one
 * of these event types. The NDJSONParser deserializes them and the
 * EventRouter distributes them to the appropriate IDE surface.
 */

// ─── Token Usage Metrics ────────────────────────────────────────────
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

// ─── System Events ──────────────────────────────────────────────────
export interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  session_id: string;
  tools: string[];
  model?: string;
  cwd?: string;
}

export interface SystemUsageEvent {
  type: 'system';
  subtype: 'usage';
  usage: TokenUsage;
}

export interface SystemHookEvent {
  type: 'system';
  subtype: 'hook';
  hook_name: string;
  status: 'start' | 'complete' | 'error';
  message?: string;
}

// ─── Assistant Output Events ────────────────────────────────────────
export interface TextDeltaEvent {
  type: 'assistant';
  subtype: 'text_delta';
  text: string;
}

export interface ThinkingDeltaEvent {
  type: 'assistant';
  subtype: 'thinking_delta';
  text: string;
}

export interface ToolCallEvent {
  type: 'assistant';
  subtype: 'tool_call';
  tool: string;
  tool_call_id: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'assistant';
  subtype: 'tool_result';
  tool_call_id: string;
  output: string;
  is_error: boolean;
}

// ─── File Mutation Events ───────────────────────────────────────────
export interface FileEditEvent {
  type: 'assistant';
  subtype: 'file_edit';
  path: string;
  old_content: string;
  new_content: string;
}

export interface FileCreateEvent {
  type: 'assistant';
  subtype: 'file_create';
  path: string;
  content: string;
}

// ─── Result Events ──────────────────────────────────────────────────
export interface ResultSuccessEvent {
  type: 'result';
  subtype: 'success';
  content: string;
  usage: TokenUsage;
  session_id?: string;
}

export interface ResultErrorEvent {
  type: 'result';
  subtype: 'error';
  error: string;
  error_code?: string;
}

// ─── Discriminated Union ────────────────────────────────────────────
export type AgentEvent =
  | SystemInitEvent
  | SystemUsageEvent
  | SystemHookEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FileEditEvent
  | FileCreateEvent
  | ResultSuccessEvent
  | ResultErrorEvent;

// ─── Type Guards ────────────────────────────────────────────────────
export function isSystemEvent(event: AgentEvent): event is SystemInitEvent | SystemUsageEvent | SystemHookEvent {
  return event.type === 'system';
}

export function isAssistantEvent(event: AgentEvent): event is TextDeltaEvent | ThinkingDeltaEvent | ToolCallEvent | ToolResultEvent | FileEditEvent | FileCreateEvent {
  return event.type === 'assistant';
}

export function isResultEvent(event: AgentEvent): event is ResultSuccessEvent | ResultErrorEvent {
  return event.type === 'result';
}

export function isTextDelta(event: AgentEvent): event is TextDeltaEvent {
  return event.type === 'assistant' && event.subtype === 'text_delta';
}

export function isToolCall(event: AgentEvent): event is ToolCallEvent {
  return event.type === 'assistant' && event.subtype === 'tool_call';
}

export function isToolResult(event: AgentEvent): event is ToolResultEvent {
  return event.type === 'assistant' && event.subtype === 'tool_result';
}

export function isFileEdit(event: AgentEvent): event is FileEditEvent {
  return event.type === 'assistant' && event.subtype === 'file_edit';
}

export function isFileCreate(event: AgentEvent): event is FileCreateEvent {
  return event.type === 'assistant' && event.subtype === 'file_create';
}

export function isUsageEvent(event: AgentEvent): event is SystemUsageEvent {
  return event.type === 'system' && event.subtype === 'usage';
}

export function isResultSuccess(event: AgentEvent): event is ResultSuccessEvent {
  return event.type === 'result' && event.subtype === 'success';
}

export function isResultError(event: AgentEvent): event is ResultErrorEvent {
  return event.type === 'result' && event.subtype === 'error';
}

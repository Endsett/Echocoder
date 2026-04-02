/**
 * EchoCoder Agent Events
 *
 * Canonical event types used inside the extension. The OpenClaude
 * print-mode stream emits rich top-level events such as `assistant`,
 * `user`, `system`, and `result`; the parser keeps those raw events
 * and also derives a small set of normalized events for the editor
 * surfaces to consume consistently.
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  server_tool_use?: Record<string, number>;
}

export interface AssistantTextBlock {
  type: 'text';
  text: string;
}

export interface AssistantThinkingBlock {
  type: 'thinking';
  thinking: string;
  signature?: string;
}

export interface AssistantToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface RawAssistantMessage {
  role: 'assistant';
  content: Array<AssistantTextBlock | AssistantThinkingBlock | AssistantToolUseBlock | Record<string, unknown>> | string;
}

export interface RawUserToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: unknown;
  is_error?: boolean;
}

export interface RawUserMessage {
  role: 'user';
  content: Array<RawUserToolResultBlock | Record<string, unknown>> | string;
}

export interface RawAssistantEvent {
  type: 'assistant';
  message: RawAssistantMessage;
  session_id?: string;
  uuid?: string;
  parent_tool_use_id?: string | null;
  error?: string;
}

export interface RawUserEvent {
  type: 'user';
  message: RawUserMessage;
  session_id?: string;
  uuid?: string;
  timestamp?: string;
  parent_tool_use_id?: string | null;
  isSynthetic?: boolean;
  tool_use_result?: unknown;
}

export interface RawToolProgressEvent {
  type: 'tool_progress';
  tool_use_id: string;
  tool_name: string;
  parent_tool_use_id?: string | null;
  elapsed_time_seconds?: number;
  task_id?: string;
  session_id?: string;
  uuid?: string;
}

export interface SystemInitEvent {
  type: 'system';
  subtype: 'init';
  session_id?: string;
  tools?: string[];
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
  subtype: 'hook_started' | 'hook_progress' | 'hook_response';
  hook_id?: string;
  hook_name?: string;
  hook_event?: string;
  stdout?: string;
  stderr?: string;
  output?: string;
  exit_code?: number;
  outcome?: string;
  session_id?: string;
  uuid?: string;
}

export interface SystemSessionStateEvent {
  type: 'system';
  subtype: 'session_state_changed';
  session_id?: string;
  uuid?: string;
  state?: string;
  details?: unknown;
}

export interface ResultSuccessEvent {
  type: 'result';
  subtype: 'success';
  result: string;
  usage?: TokenUsage;
  session_id?: string;
  is_error?: false;
}

export interface ResultErrorEvent {
  type: 'result';
  subtype:
    | 'error'
    | 'error_during_execution'
    | 'error_max_turns'
    | 'error_max_budget_usd'
    | 'error_max_structured_output_retries';
  result?: string;
  error?: string;
  usage?: TokenUsage;
  session_id?: string;
  is_error?: boolean;
}

export interface TextDeltaEvent {
  type: 'normalized';
  subtype: 'text_delta';
  text: string;
}

export interface ThinkingDeltaEvent {
  type: 'normalized';
  subtype: 'thinking_delta';
  text: string;
}

export interface ToolCallEvent {
  type: 'normalized';
  subtype: 'tool_call';
  tool: string;
  tool_call_id: string;
  input: Record<string, unknown>;
}

export interface ToolResultEvent {
  type: 'normalized';
  subtype: 'tool_result';
  tool: string;
  tool_call_id: string;
  output: string;
  is_error: boolean;
}

export interface FileEditEvent {
  type: 'normalized';
  subtype: 'file_edit';
  path: string;
  old_content: string;
  new_content: string;
  derived_from_tool?: boolean;
}

export interface FileCreateEvent {
  type: 'normalized';
  subtype: 'file_create';
  path: string;
  content: string;
  derived_from_tool?: boolean;
}

export type AgentEvent =
  | RawAssistantEvent
  | RawUserEvent
  | RawToolProgressEvent
  | SystemInitEvent
  | SystemUsageEvent
  | SystemHookEvent
  | SystemSessionStateEvent
  | ResultSuccessEvent
  | ResultErrorEvent
  | TextDeltaEvent
  | ThinkingDeltaEvent
  | ToolCallEvent
  | ToolResultEvent
  | FileEditEvent
  | FileCreateEvent;

export function isSystemEvent(
  event: AgentEvent
): event is SystemInitEvent | SystemUsageEvent | SystemHookEvent | SystemSessionStateEvent {
  return event.type === 'system';
}

export function isAssistantEvent(event: AgentEvent): event is RawAssistantEvent {
  return event.type === 'assistant';
}

export function isUserEvent(event: AgentEvent): event is RawUserEvent {
  return event.type === 'user';
}

export function isRawToolProgressEvent(event: AgentEvent): event is RawToolProgressEvent {
  return event.type === 'tool_progress';
}

export function isResultEvent(event: AgentEvent): event is ResultSuccessEvent | ResultErrorEvent {
  return event.type === 'result';
}

export function isTextDelta(event: AgentEvent): event is TextDeltaEvent {
  return event.type === 'normalized' && event.subtype === 'text_delta';
}

export function isThinkingDelta(event: AgentEvent): event is ThinkingDeltaEvent {
  return event.type === 'normalized' && event.subtype === 'thinking_delta';
}

export function isToolCall(event: AgentEvent): event is ToolCallEvent {
  return event.type === 'normalized' && event.subtype === 'tool_call';
}

export function isToolResult(event: AgentEvent): event is ToolResultEvent {
  return event.type === 'normalized' && event.subtype === 'tool_result';
}

export function isFileEdit(event: AgentEvent): event is FileEditEvent {
  return event.type === 'normalized' && event.subtype === 'file_edit';
}

export function isFileCreate(event: AgentEvent): event is FileCreateEvent {
  return event.type === 'normalized' && event.subtype === 'file_create';
}

export function isUsageEvent(event: AgentEvent): event is SystemUsageEvent {
  return event.type === 'system' && event.subtype === 'usage';
}

export function isResultSuccess(event: AgentEvent): event is ResultSuccessEvent {
  return event.type === 'result' && event.subtype === 'success';
}

export function isResultError(event: AgentEvent): event is ResultErrorEvent {
  return event.type === 'result' && event.subtype !== 'success';
}

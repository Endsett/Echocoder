"use strict";
/**
 * EchoCoder Agent Events
 *
 * Canonical event types used inside the extension. The OpenClaude
 * print-mode stream emits rich top-level events such as `assistant`,
 * `user`, `system`, and `result`; the parser keeps those raw events
 * and also derives a small set of normalized events for the editor
 * surfaces to consume consistently.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSystemEvent = isSystemEvent;
exports.isAssistantEvent = isAssistantEvent;
exports.isUserEvent = isUserEvent;
exports.isRawToolProgressEvent = isRawToolProgressEvent;
exports.isResultEvent = isResultEvent;
exports.isTextDelta = isTextDelta;
exports.isThinkingDelta = isThinkingDelta;
exports.isToolCall = isToolCall;
exports.isToolResult = isToolResult;
exports.isFileEdit = isFileEdit;
exports.isFileCreate = isFileCreate;
exports.isUsageEvent = isUsageEvent;
exports.isResultSuccess = isResultSuccess;
exports.isResultError = isResultError;
function isSystemEvent(event) {
    return event.type === 'system';
}
function isAssistantEvent(event) {
    return event.type === 'assistant';
}
function isUserEvent(event) {
    return event.type === 'user';
}
function isRawToolProgressEvent(event) {
    return event.type === 'tool_progress';
}
function isResultEvent(event) {
    return event.type === 'result';
}
function isTextDelta(event) {
    return event.type === 'normalized' && event.subtype === 'text_delta';
}
function isThinkingDelta(event) {
    return event.type === 'normalized' && event.subtype === 'thinking_delta';
}
function isToolCall(event) {
    return event.type === 'normalized' && event.subtype === 'tool_call';
}
function isToolResult(event) {
    return event.type === 'normalized' && event.subtype === 'tool_result';
}
function isFileEdit(event) {
    return event.type === 'normalized' && event.subtype === 'file_edit';
}
function isFileCreate(event) {
    return event.type === 'normalized' && event.subtype === 'file_create';
}
function isUsageEvent(event) {
    return event.type === 'system' && event.subtype === 'usage';
}
function isResultSuccess(event) {
    return event.type === 'result' && event.subtype === 'success';
}
function isResultError(event) {
    return event.type === 'result' && event.subtype !== 'success';
}

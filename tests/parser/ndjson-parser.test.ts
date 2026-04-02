import { strict as assert } from 'node:assert';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NDJSONParser } from '../../src/core/NDJSONParser';
import {
  AgentEvent,
  FileCreateEvent,
  FileEditEvent,
  ToolCallEvent,
  ToolResultEvent,
} from '../../src/types/agent-events';

function collectEvents(chunks: string[]): AgentEvent[] {
  const events: AgentEvent[] = [];
  const parser = new NDJSONParser(
    (event) => events.push(event),
    (_line, error) => {
      throw error;
    }
  );

  for (const chunk of chunks) {
    parser.feed(chunk);
  }
  parser.flush();
  return events;
}

function findEvent<T extends AgentEvent>(
  events: AgentEvent[],
  predicate: (event: AgentEvent) => event is T
): T {
  const event = events.find(predicate);
  assert.ok(event, 'Expected event was not emitted');
  return event;
}

function isToolCall(event: AgentEvent): event is ToolCallEvent {
  return event.type === 'normalized' && event.subtype === 'tool_call';
}

function isToolResult(event: AgentEvent): event is ToolResultEvent {
  return event.type === 'normalized' && event.subtype === 'tool_result';
}

function isFileCreate(event: AgentEvent): event is FileCreateEvent {
  return event.type === 'normalized' && event.subtype === 'file_create';
}

function isFileEdit(event: AgentEvent): event is FileEditEvent {
  return event.type === 'normalized' && event.subtype === 'file_edit';
}

function testFragmentedAssistantTextDelta(): void {
  const payload = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'hello world' }],
    },
  }) + '\n';

  const events = collectEvents([payload.slice(0, 15), payload.slice(15)]);
  const textEvent = findEvent(
    events,
    (event): event is AgentEvent =>
      event.type === 'normalized' && event.subtype === 'text_delta'
  ) as { text: string };

  assert.equal(textEvent.text, 'hello world');
}

function testToolCallAndResultNormalization(): void {
  const toolUseId = 'tool-123';
  const assistantLine = JSON.stringify({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'tool_use', id: toolUseId, name: 'Read', input: { file_path: '/tmp/a.ts' } }],
    },
  }) + '\n';

  const userLine = JSON.stringify({
    type: 'user',
    message: {
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUseId, content: 'ok', is_error: false }],
    },
  }) + '\n';

  const events = collectEvents([assistantLine, userLine]);
  const callEvent = findEvent(events, isToolCall);
  const resultEvent = findEvent(events, isToolResult);

  assert.equal(callEvent.tool, 'Read');
  assert.equal(callEvent.tool_call_id, toolUseId);
  assert.equal(resultEvent.tool, 'Read');
  assert.equal(resultEvent.output, 'ok');
  assert.equal(resultEvent.is_error, false);
}

function testSyntheticFileCreateAndEditEvents(): void {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-parser-'));
  try {
    const createPath = path.join(tempRoot, 'create.txt');
    const editPath = path.join(tempRoot, 'edit.txt');
    fs.writeFileSync(editPath, 'old-value', 'utf8');

    const events: AgentEvent[] = [];
    const parser = new NDJSONParser((event) => events.push(event), (_line, error) => {
      throw error;
    });

    const createToolId = 'write-create';
    parser.feed(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: createToolId, name: 'Write', input: { file_path: createPath } }],
        },
      }) + '\n'
    );
    fs.writeFileSync(createPath, 'created-content', 'utf8');
    parser.feed(
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: createToolId, content: 'ok', is_error: false }],
        },
      }) + '\n'
    );

    const editToolId = 'edit-existing';
    parser.feed(
      JSON.stringify({
        type: 'assistant',
        message: {
          role: 'assistant',
          content: [{ type: 'tool_use', id: editToolId, name: 'Edit', input: { file_path: editPath } }],
        },
      }) + '\n'
    );
    fs.writeFileSync(editPath, 'new-value', 'utf8');
    parser.feed(
      JSON.stringify({
        type: 'user',
        message: {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: editToolId, content: 'ok', is_error: false }],
        },
      }) + '\n'
    );
    parser.flush();

    const createEvent = findEvent(events, isFileCreate);
    const editEvent = findEvent(events, isFileEdit);

    assert.equal(createEvent.path, createPath);
    assert.equal(createEvent.content, 'created-content');
    assert.equal(editEvent.path, editPath);
    assert.equal(editEvent.old_content, 'old-value');
    assert.equal(editEvent.new_content, 'new-value');
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function run(): void {
  testFragmentedAssistantTextDelta();
  testToolCallAndResultNormalization();
  testSyntheticFileCreateAndEditEvents();
  console.log('ndjson-parser tests passed');
}

run();

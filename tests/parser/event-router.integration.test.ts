import { strict as assert } from 'node:assert';
import { NDJSONParser } from '../../src/core/NDJSONParser';
import { EventRouter } from '../../src/core/EventRouter';
import { AgentEvent } from '../../src/types/agent-events';

function testParserToRouterPipeline(): void {
  const router = new EventRouter();
  const seen = {
    any: 0,
    text: 0,
    toolCall: 0,
    toolResult: 0,
    usage: 0,
    success: 0,
  };

  const disposables = [
    router.onAnyEvent(() => { seen.any += 1; }),
    router.onTextDelta(() => { seen.text += 1; }),
    router.onToolCall(() => { seen.toolCall += 1; }),
    router.onToolResult(() => { seen.toolResult += 1; }),
    router.onUsage(() => { seen.usage += 1; }),
    router.onSuccess(() => { seen.success += 1; }),
  ];

  const parser = new NDJSONParser(
    (event: AgentEvent) => router.route(event),
    (_line, error) => {
      throw error;
    }
  );

  const lines = [
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: '/tmp/a.ts' } },
        ],
      },
    }) + '\n',
    JSON.stringify({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 't1', content: 'ok', is_error: false },
        ],
      },
    }) + '\n',
    JSON.stringify({
      type: 'system',
      subtype: 'usage',
      usage: { input_tokens: 12, output_tokens: 8 },
    }) + '\n',
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      result: 'done',
      usage: { input_tokens: 20, output_tokens: 10 },
      is_error: false,
    }) + '\n',
  ];

  parser.feed(lines[0].slice(0, 40));
  parser.feed(lines[0].slice(40) + lines[1]);
  parser.feed(lines[2] + lines[3]);
  parser.flush();

  assert.equal(seen.text, 1, 'Expected one normalized text delta');
  assert.equal(seen.toolCall, 1, 'Expected one normalized tool call');
  assert.equal(seen.toolResult, 1, 'Expected one normalized tool result');
  assert.equal(seen.usage, 1, 'Expected one usage event');
  assert.equal(seen.success, 1, 'Expected one success event');
  assert.ok(seen.any >= 6, 'Expected all raw + normalized events to flow through onAnyEvent');
  assert.equal(router.totalInputTokens, 20);
  assert.equal(router.totalOutputTokens, 10);
  assert.equal(router.totalTokens, 30);

  for (const disposable of disposables) {
    disposable.dispose();
  }
  router.dispose();
}

function run(): void {
  testParserToRouterPipeline();
  console.log('event-router integration tests passed');
}

run();

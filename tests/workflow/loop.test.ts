/**
 * Workflow Engine Tests
 *
 * Validates the core Plan -> Execute -> Verify loop.
 * Mocks out the ProcessManager and EventRouter.
 */

import * as assert from 'assert';
import { WorkflowLoop } from '../../src/core/workflow/loop';
import { Planner } from '../../src/core/workflow/planner';
import { ExecutionResult, Plan, VerificationReport, WorkflowState } from '../../src/core/workflow/types';

// Simple mock for VS Code OutputChannel
class MockOutputChannel {
  public log: string[] = [];
  name = 'Mock';
  append(val: string) {}
  appendLine(val: string) { this.log.push(val); }
  clear() {}
  show() {}
  hide() {}
  dispose() {}
  replace() {}
}

const mockOutput = new MockOutputChannel() as any;

// A simple mock test runner
async function runTests() {
  console.log('--- Running Workflow Engine Tests ---');
  let passed = 0;
  let failed = 0;

  try {
    await testPlannerParsing();
    passed++;
  } catch (err) {
    console.error('❌ testPlannerParsing failed:', err);
    failed++;
  }

  try {
    await testWorkflowStateTransitions();
    passed++;
  } catch (err) {
    console.error('❌ testWorkflowStateTransitions failed:', err);
    failed++;
  }

  console.log(`\nTests completed: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

async function testPlannerParsing() {
  console.log('Running test: testPlannerParsing');
  
  // Create a Planner instance with completely mocked dependencies
  const mockProcessManager = {
    onEvent: () => ({ dispose: () => {} }),
    onExit: (cb: any) => {
      // Simulate immediate exit
      setTimeout(() => cb(0), 10);
      return { dispose: () => {} };
    },
    spawn: async () => {},
  } as any;

  const mockPromptAssembler = {
    assembleChatPrompt: async () => ({ prompt: '', cwd: '' })
  } as any;

  const planner = new Planner(mockProcessManager, mockPromptAssembler, mockOutput);

  // Patch the private parseAgentResponse to just test extraction logic
  const parseResponse = (planner as any).parseAgentResponse.bind(planner);

  const validResponse = `
I have analyzed the request. Here is the plan.
\`\`\`json
{
  "summary": "Implement login feature",
  "risk": "medium",
  "steps": [
    {
      "index": 1,
      "description": "Create login.ts",
      "category": "create",
      "affectedFiles": ["login.ts"],
      "risk": "low"
    }
  ],
  "readFiles": [],
  "writeFiles": ["login.ts"]
}
\`\`\`
  `;

  const plan: Plan = parseResponse(validResponse, 'User prompt');
  assert.strictEqual(plan.summary, 'Implement login feature');
  assert.strictEqual(plan.steps.length, 1);
  assert.strictEqual(plan.steps[0].category, 'create');
  assert.strictEqual(plan.risk, 'medium');

  console.log('✅ testPlannerParsing passed');
}

async function testWorkflowStateTransitions() {
  console.log('Running test: testWorkflowStateTransitions');

  const mockProcessManager = {
    abort: () => {},
  } as any;
  const mockEventRouter = {} as any;
  const mockPromptAssembler = {} as any;

  const loop = new WorkflowLoop(
    mockProcessManager,
    mockEventRouter,
    mockPromptAssembler,
    mockOutput
  );

  let phaseHistory: string[] = [];
  loop.onPhaseChange((state: WorkflowState) => {
    phaseHistory.push(state.phase);
  });

  // Verify initial state
  assert.strictEqual(loop.phase, 'idle');
  assert.strictEqual(loop.isIdle, true);

  // Directly set internal state to mock a generated plan
  (loop as any).state = { phase: 'awaiting_approval', plan: { id: 'test-plan', state: 'draft' } as any };
  
  // Call approve Plan
  // We expect it to try to execute and then verify. Since we mock execute to fail, it will transition to failed.
  (loop as any).executor = {
    execute: async () => ({ success: false, error: 'mock error' } as ExecutionResult)
  };

  await loop.approvePlan();

  // State should be failed because execution failed
  assert.strictEqual(loop.phase, 'failed');

  console.log('✅ testWorkflowStateTransitions passed');
}

// Run the tests
runTests().catch(console.error);

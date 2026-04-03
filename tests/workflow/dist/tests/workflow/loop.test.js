"use strict";
/**
 * Workflow Engine Tests
 *
 * Validates the core Plan -> Execute -> Verify loop.
 * Mocks out the ProcessManager and EventRouter.
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
const assert = __importStar(require("assert"));
const loop_1 = require("../../src/core/workflow/loop");
const planner_1 = require("../../src/core/workflow/planner");
// Simple mock for VS Code OutputChannel
class MockOutputChannel {
    constructor() {
        this.log = [];
        this.name = 'Mock';
    }
    append(val) { }
    appendLine(val) { this.log.push(val); }
    clear() { }
    show() { }
    hide() { }
    dispose() { }
    replace() { }
}
const mockOutput = new MockOutputChannel();
// A simple mock test runner
async function runTests() {
    console.log('--- Running Workflow Engine Tests ---');
    let passed = 0;
    let failed = 0;
    try {
        await testPlannerParsing();
        passed++;
    }
    catch (err) {
        console.error('❌ testPlannerParsing failed:', err);
        failed++;
    }
    try {
        await testWorkflowStateTransitions();
        passed++;
    }
    catch (err) {
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
        onEvent: () => ({ dispose: () => { } }),
        onExit: (cb) => {
            // Simulate immediate exit
            setTimeout(() => cb(0), 10);
            return { dispose: () => { } };
        },
        spawn: async () => { },
    };
    const mockPromptAssembler = {
        assembleChatPrompt: async () => ({ prompt: '', cwd: '' })
    };
    const planner = new planner_1.Planner(mockProcessManager, mockPromptAssembler, mockOutput);
    // Patch the private parseAgentResponse to just test extraction logic
    const parseResponse = planner.parseAgentResponse.bind(planner);
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
    const plan = parseResponse(validResponse, 'User prompt');
    assert.strictEqual(plan.summary, 'Implement login feature');
    assert.strictEqual(plan.steps.length, 1);
    assert.strictEqual(plan.steps[0].category, 'create');
    assert.strictEqual(plan.risk, 'medium');
    console.log('✅ testPlannerParsing passed');
}
async function testWorkflowStateTransitions() {
    console.log('Running test: testWorkflowStateTransitions');
    const mockProcessManager = {
        abort: () => { },
    };
    const mockEventRouter = {};
    const mockPromptAssembler = {};
    const loop = new loop_1.WorkflowLoop(mockProcessManager, mockEventRouter, mockPromptAssembler, mockOutput);
    let phaseHistory = [];
    loop.onPhaseChange((state) => {
        phaseHistory.push(state.phase);
    });
    // Verify initial state
    assert.strictEqual(loop.phase, 'idle');
    assert.strictEqual(loop.isIdle, true);
    // Directly set internal state to mock a generated plan
    loop.state = { phase: 'awaiting_approval', plan: { id: 'test-plan', state: 'draft' } };
    // Call approve Plan
    // We expect it to try to execute and then verify. Since we mock execute to fail, it will transition to failed.
    loop.executor = {
        execute: async () => ({ success: false, error: 'mock error' })
    };
    await loop.approvePlan();
    // State should be failed because execution failed
    assert.strictEqual(loop.phase, 'failed');
    console.log('✅ testWorkflowStateTransitions passed');
}
// Run the tests
runTests().catch(console.error);

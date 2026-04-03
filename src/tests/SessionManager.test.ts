import * as assert from 'assert';
import { SessionManager } from '../core/SessionManager';

// Mock VS Code ExtensionContext
const mockContext: any = {
  workspaceState: {
    data: new Map<string, any>(),
    get(key: string) { return this.data.get(key); },
    update(key: string, value: any) { this.data.set(key, value); }
  }
};

async function testSessionPersistence() {
  console.log('Running test: testSessionPersistence');
  const sm = new SessionManager(mockContext);
  
  sm.addTurn('user', 'Hello');
  sm.addTurn('assistant', 'Hi there!');
  
  const history = sm.getHistoryContext();
  assert.ok(history.includes('Hello'), 'History should include user message');
  assert.ok(history.includes('Hi there!'), 'History should include assistant message');
  
  // Simulate reload
  const sm2 = new SessionManager(mockContext);
  assert.strictEqual(sm2.getActiveSession()?.turns.length, 2, 'Should restore 2 turns');
  console.log('✅ testSessionPersistence passed');
}

async function testDeduplication() {
  console.log('Running test: testDeduplication');
  const sm = new SessionManager(mockContext);
  sm.resetSession();
  
  sm.addTurn('user', 'Repeat');
  sm.addTurn('user', 'Repeat'); // Identical turn
  
  assert.strictEqual(sm.getActiveSession()?.turns.length, 1, 'Should deduplicate identical user turns');
  console.log('✅ testDeduplication passed');
}

async function testTokenEstimation() {
  console.log('Running test: testTokenEstimation');
  const sm = new SessionManager(mockContext);
  const tokens = sm.estimateTokens('Hello World'); // 11 chars -> ~3 tokens
  assert.strictEqual(tokens, 3, 'Should estimate ~3 tokens for 11 chars');
  console.log('✅ testTokenEstimation passed');
}

(async () => {
  try {
    await testSessionPersistence();
    await testDeduplication();
    await testTokenEstimation();
    process.exit(0);
  } catch (err) {
    console.error('❌ Tests failed:', err);
    process.exit(1);
  }
})();

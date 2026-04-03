"use strict";
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
const SessionManager_1 = require("../core/SessionManager");
// Mock VS Code ExtensionContext
const mockContext = {
    workspaceState: {
        data: new Map(),
        get(key) { return this.data.get(key); },
        update(key, value) { this.data.set(key, value); }
    }
};
async function testSessionPersistence() {
    console.log('Running test: testSessionPersistence');
    const sm = new SessionManager_1.SessionManager(mockContext);
    sm.addTurn('user', 'Hello');
    sm.addTurn('assistant', 'Hi there!');
    const history = sm.getHistoryContext();
    assert.ok(history.includes('Hello'), 'History should include user message');
    assert.ok(history.includes('Hi there!'), 'History should include assistant message');
    // Simulate reload
    const sm2 = new SessionManager_1.SessionManager(mockContext);
    assert.strictEqual(sm2.getActiveSession()?.turns.length, 2, 'Should restore 2 turns');
    console.log('✅ testSessionPersistence passed');
}
async function testDeduplication() {
    console.log('Running test: testDeduplication');
    const sm = new SessionManager_1.SessionManager(mockContext);
    sm.resetSession();
    sm.addTurn('user', 'Repeat');
    sm.addTurn('user', 'Repeat'); // Identical turn
    assert.strictEqual(sm.getActiveSession()?.turns.length, 1, 'Should deduplicate identical user turns');
    console.log('✅ testDeduplication passed');
}
async function testTokenEstimation() {
    console.log('Running test: testTokenEstimation');
    const sm = new SessionManager_1.SessionManager(mockContext);
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
    }
    catch (err) {
        console.error('❌ Tests failed:', err);
        process.exit(1);
    }
})();

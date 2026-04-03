"use strict";
/**
 * Sandbox — Secure Execution Environment (Stub for Phase 1)
 *
 * Future abstraction for running untrusted bash scripts and Node
 * commands in a secure Docker/DevContainer, preventing them from
 * breaking the user's host environment.
 *
 * For Phase 1, this is a pass-through stub as defined in the spec.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sandbox = void 0;
class Sandbox {
    constructor() { }
    /**
     * Initialize the sandbox environment (no-op in Phase 1).
     */
    async initialize() {
        // Stub: In the future, this might spin up a Docker container
        // or detect an existing DevContainer.
        return Promise.resolve();
    }
    /**
     * Determine if a tool execution requires sandboxing.
     * For Phase 1, we allow direct host execution (subject to ToolInterceptor gates).
     */
    canExecuteSafely(_toolName, _command) {
        // Stub: Always true for Phase 1 MVP
        return true;
    }
    /**
     * Wrap a command string to execute inside the sandbox.
     * For Phase 1, returns the command unmodified.
     */
    wrapCommand(command) {
        // Stub: Return unmodified command. Future: `docker exec echo-sandbox ${command}`
        return command;
    }
    dispose() {
        // Stub
    }
}
exports.Sandbox = Sandbox;

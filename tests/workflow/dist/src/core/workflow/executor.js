"use strict";
/**
 * Executor — Phase 3 of the Workflow Engine
 *
 * Takes an approved Plan and runs the agent at full power (all tools
 * enabled, subject to ToolInterceptor policy). Tracks per-step
 * progress by watching for tool calls and file mutations from the
 * NDJSON stream.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Executor = void 0;
const agent_events_1 = require("../../types/agent-events");
/**
 * Execution prompt injected before the user's original request.
 * Reminds the agent that the plan has been approved.
 */
function buildExecutionPrompt(plan) {
    const stepList = plan.steps
        .map((s) => `${s.index}. [${s.category}] ${s.description}`)
        .join('\n');
    return `The user has approved the following plan. Execute it now.

## Approved Plan
${plan.summary}

### Steps
${stepList}

### Files to modify
${plan.writeFiles.join(', ') || '(none specified)'}

---

Original user request:
${plan.userPrompt}

Execute the plan step by step. Do not skip steps. Report any issues.`;
}
class Executor {
    constructor(processManager, eventRouter, promptAssembler, outputChannel) {
        this.processManager = processManager;
        this.eventRouter = eventRouter;
        this.promptAssembler = promptAssembler;
        this.outputChannel = outputChannel;
    }
    /**
     * Execute an approved plan.
     *
     * The plan's state must be 'approved' before calling this method.
     * Returns an ExecutionResult once the agent run completes.
     */
    async execute(plan, token) {
        if (plan.state !== 'approved') {
            throw new Error(`Cannot execute plan in state "${plan.state}" — must be "approved"`);
        }
        plan.state = 'executing';
        const startTime = Date.now();
        const modifiedFiles = new Set();
        const createdFiles = new Set();
        let currentStepIndex = 0;
        this.outputChannel.appendLine(`[Executor] Executing plan "${plan.id}" (${plan.steps.length} steps)`);
        // Mark first step as running
        if (plan.steps.length > 0) {
            plan.steps[0].status = 'running';
        }
        const executionPrompt = buildExecutionPrompt(plan);
        const assembled = await this.promptAssembler.assembleChatPrompt(executionPrompt);
        return new Promise((resolve) => {
            let resolved = false;
            let lastError;
            const cleanup = () => {
                eventSub.dispose();
                exitSub.dispose();
            };
            const advanceStep = () => {
                if (currentStepIndex < plan.steps.length) {
                    plan.steps[currentStepIndex].status = 'done';
                }
                currentStepIndex++;
                if (currentStepIndex < plan.steps.length) {
                    plan.steps[currentStepIndex].status = 'running';
                }
            };
            const eventSub = this.processManager.onEvent((event) => {
                // Track file mutations
                if ((0, agent_events_1.isFileEdit)(event)) {
                    modifiedFiles.add(event.path);
                    advanceStep();
                    return;
                }
                if ((0, agent_events_1.isFileCreate)(event)) {
                    createdFiles.add(event.path);
                    advanceStep();
                    return;
                }
                // Track tool calls for progress
                if ((0, agent_events_1.isToolCall)(event)) {
                    this.outputChannel.appendLine(`[Executor] Tool call: ${event.tool} (step ${currentStepIndex + 1}/${plan.steps.length})`);
                    return;
                }
                if ((0, agent_events_1.isToolResult)(event) && event.is_error) {
                    lastError = event.output.substring(0, 500);
                    if (currentStepIndex < plan.steps.length) {
                        plan.steps[currentStepIndex].status = 'failed';
                        plan.steps[currentStepIndex].output = lastError;
                    }
                    return;
                }
                // Handle completion
                if ((0, agent_events_1.isResultSuccess)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        // Mark remaining running steps as done
                        for (const step of plan.steps) {
                            if (step.status === 'running') {
                                step.status = 'done';
                            }
                        }
                        plan.state = 'completed';
                        resolve({
                            planId: plan.id,
                            success: true,
                            steps: plan.steps,
                            modifiedFiles: Array.from(modifiedFiles),
                            createdFiles: Array.from(createdFiles),
                            durationMs: Date.now() - startTime,
                        });
                    }
                    return;
                }
                if ((0, agent_events_1.isResultError)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        const error = event.error || event.result || 'Agent error during execution';
                        for (const step of plan.steps) {
                            if (step.status === 'running') {
                                step.status = 'failed';
                            }
                            else if (step.status === 'pending') {
                                step.status = 'skipped';
                            }
                        }
                        plan.state = 'failed';
                        resolve({
                            planId: plan.id,
                            success: false,
                            steps: plan.steps,
                            modifiedFiles: Array.from(modifiedFiles),
                            createdFiles: Array.from(createdFiles),
                            error,
                            durationMs: Date.now() - startTime,
                        });
                    }
                }
            });
            const exitSub = this.processManager.onExit((code) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    const success = code === 0;
                    for (const step of plan.steps) {
                        if (step.status === 'running') {
                            step.status = success ? 'done' : 'failed';
                        }
                        else if (step.status === 'pending') {
                            step.status = 'skipped';
                        }
                    }
                    plan.state = success ? 'completed' : 'failed';
                    resolve({
                        planId: plan.id,
                        success,
                        steps: plan.steps,
                        modifiedFiles: Array.from(modifiedFiles),
                        createdFiles: Array.from(createdFiles),
                        error: success ? undefined : lastError || `Agent exited with code ${code}`,
                        durationMs: Date.now() - startTime,
                    });
                }
            });
            this.processManager
                .spawn({
                prompt: assembled.prompt,
                cwd: assembled.cwd,
                mode: 'compose', // compose mode enables write tools
            }, token)
                .catch((error) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    plan.state = 'failed';
                    resolve({
                        planId: plan.id,
                        success: false,
                        steps: plan.steps,
                        modifiedFiles: [],
                        createdFiles: [],
                        error: error instanceof Error ? error.message : String(error),
                        durationMs: Date.now() - startTime,
                    });
                }
            });
        });
    }
}
exports.Executor = Executor;

"use strict";
/**
 * WorkflowLoop — Orchestrates Plan → Approve → Execute → Verify
 *
 * Central controller that drives the full agentic workflow lifecycle.
 * Emits typed events so the UI (Agent Panel, Plan Viewer, Status Bar)
 * can react to each phase transition.
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
exports.WorkflowLoop = void 0;
const vscode = __importStar(require("vscode"));
const planner_1 = require("./planner");
const executor_1 = require("./executor");
const verifier_1 = require("./verifier");
class WorkflowLoop {
    processManager;
    eventRouter;
    promptAssembler;
    outputChannel;
    planner;
    executor;
    verifier;
    state = { phase: 'idle' };
    _onPhaseChange = new vscode.EventEmitter();
    _onPlanReady = new vscode.EventEmitter();
    _onExecutionComplete = new vscode.EventEmitter();
    _onVerificationComplete = new vscode.EventEmitter();
    _onError = new vscode.EventEmitter();
    onPhaseChange = this._onPhaseChange.event;
    onPlanReady = this._onPlanReady.event;
    onExecutionComplete = this._onExecutionComplete.event;
    onVerificationComplete = this._onVerificationComplete.event;
    onError = this._onError.event;
    constructor(processManager, eventRouter, promptAssembler, outputChannel) {
        this.processManager = processManager;
        this.eventRouter = eventRouter;
        this.promptAssembler = promptAssembler;
        this.outputChannel = outputChannel;
        this.planner = new planner_1.Planner(processManager, promptAssembler, outputChannel);
        this.executor = new executor_1.Executor(processManager, eventRouter, promptAssembler, outputChannel);
        this.verifier = new verifier_1.Verifier(outputChannel);
    }
    /** Current workflow phase. */
    get phase() {
        return this.state.phase;
    }
    /** Current plan (if any). */
    get currentPlan() {
        return this.state.plan;
    }
    /** Whether the loop is idle and ready for a new task. */
    get isIdle() {
        return this.state.phase === 'idle';
    }
    // ── Phase 1: Planning ──────────────────────────────────────────────
    /**
     * Start a new workflow: generate a plan from the user's prompt.
     *
     * After the plan is generated, the workflow waits in the
     * `awaiting_approval` phase until `approvePlan()` or `rejectPlan()`
     * is called.
     */
    async runTask(userPrompt, token) {
        if (this.state.phase !== 'idle') {
            this.processManager.abort('new task supersedes current workflow');
            this.reset();
        }
        this.setPhase('planning');
        try {
            const plan = await this.planner.generatePlan(userPrompt, token);
            plan.state = 'draft';
            this.state.plan = plan;
            this.setPhase('awaiting_approval');
            this._onPlanReady.fire(plan);
            return plan;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.outputChannel.appendLine(`[Workflow] Planning failed: ${message}`);
            this._onError.fire(message);
            this.setPhase('failed');
            throw err;
        }
    }
    // ── Phase 2: Approval Gate ─────────────────────────────────────────
    /**
     * Approve the current plan and proceed to execution.
     */
    async approvePlan(token) {
        const plan = this.state.plan;
        if (!plan || this.state.phase !== 'awaiting_approval') {
            this.outputChannel.appendLine('[Workflow] No plan to approve');
            return;
        }
        plan.state = 'approved';
        this.outputChannel.appendLine(`[Workflow] Plan "${plan.id}" approved — starting execution`);
        await this.executeAndVerify(plan, token);
    }
    /**
     * Reject the current plan and return to idle.
     */
    rejectPlan() {
        const plan = this.state.plan;
        if (!plan) {
            return;
        }
        plan.state = 'rejected';
        this.outputChannel.appendLine(`[Workflow] Plan "${plan.id}" rejected`);
        this.reset();
    }
    /**
     * Automatically generate a repair plan for a failed verification.
     */
    async repairPlan(token) {
        const report = this.state.verificationReport;
        if (!report || report.passed) {
            throw new Error('No failed verification report to repair');
        }
        this.setPhase('repairing');
        const issues = report.checks
            .filter(c => !c.passed)
            .map(c => `[${c.name}] failed:\n${c.output || 'No output'}`)
            .join('\n\n');
        const repairPrompt = `The previous plan was executed but verification failed with the following issues:\n\n${issues}\n\nPlease generate a new plan to fix these issues. Focus ONLY on the fixes.`;
        try {
            const plan = await this.planner.generatePlan(repairPrompt, token);
            plan.state = 'draft';
            plan.summary = `Repair: ${plan.summary}`;
            this.state.plan = plan;
            this.setPhase('awaiting_approval');
            this._onPlanReady.fire(plan);
            return plan;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.outputChannel.appendLine(`[Workflow] Repair planning failed: ${message}`);
            this._onError.fire(message);
            this.setPhase('failed');
            throw err;
        }
    }
    // ── Phase 3 & 4: Execute + Verify ─────────────────────────────────
    /**
     * Execute an approved plan and then run verification.
     * If verification fails, offers the user a retry.
     */
    async executeAndVerify(plan, token) {
        // Phase 3: Execute
        this.setPhase('executing');
        let executionResult;
        try {
            executionResult = await this.executor.execute(plan, token);
            this.state.executionResult = executionResult;
            this._onExecutionComplete.fire(executionResult);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this._onError.fire(`Execution failed: ${message}`);
            this.setPhase('failed');
            return;
        }
        if (!executionResult.success) {
            this.outputChannel.appendLine(`[Workflow] Execution failed: ${executionResult.error}`);
            this._onError.fire(executionResult.error || 'Execution failed');
            this.setPhase('failed');
            return;
        }
        // Phase 4: Verify
        this.setPhase('verifying');
        const cwd = this.promptAssembler.getCwd();
        const report = await this.verifier.verify(executionResult, cwd);
        this.state.verificationReport = report;
        this._onVerificationComplete.fire(report);
        if (report.passed) {
            this.outputChannel.appendLine('[Workflow] ✅ All verification checks passed');
            this.setPhase('completed');
            vscode.window.showInformationMessage(`EchoCoder: Plan executed and verified. ${report.summary}`);
        }
        else {
            this.outputChannel.appendLine(`[Workflow] ⚠️ Verification failed: ${report.summary}`);
            this.setPhase('failed');
            const retry = await vscode.window.showWarningMessage(`EchoCoder: Verification failed — ${report.summary}`, 'View Details', 'Dismiss');
            if (retry === 'View Details') {
                this.showVerificationDetails(report);
            }
        }
    }
    // ── Utilities ──────────────────────────────────────────────────────
    /**
     * Reset the workflow to idle state.
     */
    reset() {
        this.state = { phase: 'idle' };
        this._onPhaseChange.fire(this.state);
    }
    /**
     * Abort any in-progress workflow.
     */
    abort() {
        this.processManager.abort('workflow aborted');
        this.reset();
    }
    setPhase(phase) {
        this.state.phase = phase;
        this.outputChannel.appendLine(`[Workflow] Phase → ${phase}`);
        this._onPhaseChange.fire({ ...this.state });
    }
    showVerificationDetails(report) {
        this.outputChannel.show(true);
        this.outputChannel.appendLine('');
        this.outputChannel.appendLine('═══ Verification Report ═══');
        for (const check of report.checks) {
            const icon = check.passed ? '✅' : '❌';
            this.outputChannel.appendLine(`${icon} ${check.name} (${check.durationMs}ms)`);
            if (!check.passed && check.output) {
                for (const line of check.output.split('\n').slice(0, 20)) {
                    this.outputChannel.appendLine(`   ${line}`);
                }
            }
        }
        this.outputChannel.appendLine('═══════════════════════════');
    }
    dispose() {
        this._onPhaseChange.dispose();
        this._onPlanReady.dispose();
        this._onExecutionComplete.dispose();
        this._onVerificationComplete.dispose();
        this._onError.dispose();
    }
}
exports.WorkflowLoop = WorkflowLoop;

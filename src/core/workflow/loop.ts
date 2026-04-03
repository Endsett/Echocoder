/**
 * WorkflowLoop — Orchestrates Plan → Approve → Execute → Verify
 *
 * Central controller that drives the full agentic workflow lifecycle.
 * Emits typed events so the UI (Agent Panel, Plan Viewer, Status Bar)
 * can react to each phase transition.
 */

import * as vscode from 'vscode';
import { ProcessManager } from '../ProcessManager';
import { EventRouter } from '../EventRouter';
import { PromptAssembler } from '../../context/PromptAssembler';
import { Planner } from './planner';
import { Executor } from './executor';
import { Verifier } from './verifier';
import {
  Plan,
  ExecutionResult,
  VerificationReport,
  WorkflowPhase,
  WorkflowState,
} from './types';

export class WorkflowLoop {
  private readonly planner: Planner;
  private readonly executor: Executor;
  private readonly verifier: Verifier;

  private state: WorkflowState = { phase: 'idle' };

  private readonly _onPhaseChange = new vscode.EventEmitter<WorkflowState>();
  private readonly _onPlanReady = new vscode.EventEmitter<Plan>();
  private readonly _onExecutionComplete = new vscode.EventEmitter<ExecutionResult>();
  private readonly _onVerificationComplete = new vscode.EventEmitter<VerificationReport>();
  private readonly _onError = new vscode.EventEmitter<string>();

  public readonly onPhaseChange = this._onPhaseChange.event;
  public readonly onPlanReady = this._onPlanReady.event;
  public readonly onExecutionComplete = this._onExecutionComplete.event;
  public readonly onVerificationComplete = this._onVerificationComplete.event;
  public readonly onError = this._onError.event;

  constructor(
    private readonly processManager: ProcessManager,
    private readonly eventRouter: EventRouter,
    private readonly promptAssembler: PromptAssembler,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    this.planner = new Planner(processManager, promptAssembler, outputChannel);
    this.executor = new Executor(processManager, eventRouter, promptAssembler, outputChannel);
    this.verifier = new Verifier(outputChannel);
  }

  /** Current workflow phase. */
  public get phase(): WorkflowPhase {
    return this.state.phase;
  }

  /** Current plan (if any). */
  public get currentPlan(): Plan | undefined {
    return this.state.plan;
  }

  /** Whether the loop is idle and ready for a new task. */
  public get isIdle(): boolean {
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
  public async runTask(
    userPrompt: string,
    token?: vscode.CancellationToken
  ): Promise<Plan> {
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
    } catch (err) {
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
  public async approvePlan(token?: vscode.CancellationToken): Promise<void> {
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
  public rejectPlan(): void {
    const plan = this.state.plan;
    if (!plan) { return; }

    plan.state = 'rejected';
    this.outputChannel.appendLine(`[Workflow] Plan "${plan.id}" rejected`);
    this.reset();
  }

  // ── Phase 3 & 4: Execute + Verify ─────────────────────────────────

  /**
   * Execute an approved plan and then run verification.
   * If verification fails, offers the user a retry.
   */
  private async executeAndVerify(
    plan: Plan,
    token?: vscode.CancellationToken
  ): Promise<void> {
    // Phase 3: Execute
    this.setPhase('executing');

    let executionResult: ExecutionResult;
    try {
      executionResult = await this.executor.execute(plan, token);
      this.state.executionResult = executionResult;
      this._onExecutionComplete.fire(executionResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this._onError.fire(`Execution failed: ${message}`);
      this.setPhase('failed');
      return;
    }

    if (!executionResult.success) {
      this.outputChannel.appendLine(
        `[Workflow] Execution failed: ${executionResult.error}`
      );
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
      vscode.window.showInformationMessage(
        `EchoCoder: Plan executed and verified. ${report.summary}`
      );
    } else {
      this.outputChannel.appendLine(`[Workflow] ⚠️ Verification failed: ${report.summary}`);
      this.setPhase('failed');

      const retry = await vscode.window.showWarningMessage(
        `EchoCoder: Verification failed — ${report.summary}`,
        'View Details',
        'Dismiss'
      );

      if (retry === 'View Details') {
        this.showVerificationDetails(report);
      }
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────

  /**
   * Reset the workflow to idle state.
   */
  public reset(): void {
    this.state = { phase: 'idle' };
    this._onPhaseChange.fire(this.state);
  }

  /**
   * Abort any in-progress workflow.
   */
  public abort(): void {
    this.processManager.abort('workflow aborted');
    this.reset();
  }

  private setPhase(phase: WorkflowPhase): void {
    this.state.phase = phase;
    this.outputChannel.appendLine(`[Workflow] Phase → ${phase}`);
    this._onPhaseChange.fire({ ...this.state });
  }

  private showVerificationDetails(report: VerificationReport): void {
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

  public dispose(): void {
    this._onPhaseChange.dispose();
    this._onPlanReady.dispose();
    this._onExecutionComplete.dispose();
    this._onVerificationComplete.dispose();
    this._onError.dispose();
  }
}

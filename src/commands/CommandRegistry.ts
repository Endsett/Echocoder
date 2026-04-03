/**
 * CommandRegistry — All EchoCoder Commands & Keybindings
 * 
 * Registers all commands declared in package.json and wires them
 * to the appropriate controllers and managers.
 */

import * as vscode from 'vscode';
import { InlineEditController } from '../editor/InlineEditController';
import { DiffDecorator } from '../editor/DiffDecorator';
import { ProcessManager } from '../core/ProcessManager';
import { PromptAssembler } from '../context/PromptAssembler';
import { ComposerEngine } from '../composer/ComposerEngine';
import { WorkflowLoop } from '../core/workflow/loop';
import { SessionManager } from '../core/SessionManager';

export class CommandRegistry {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private inlineEditController: InlineEditController,
    private diffDecorator: DiffDecorator,
    private processManager: ProcessManager,
    private promptAssembler: PromptAssembler,
    private composerEngine: ComposerEngine,
    private workflowLoop: WorkflowLoop,
    private sessionManager: SessionManager,
    private outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Register all commands.
   */
  public registerAll(): vscode.Disposable[] {
    // Inline Edit (Ctrl+K)
    this.register('echocoder.inlineEdit', () => {
      this.inlineEditController.executeInlineEdit();
    });

    // Inline Chat (Ctrl+I) — same as inline edit for Phase 1
    this.register('echocoder.inlineChat', () => {
      this.inlineEditController.executeInlineEdit();
    });

    // Open Agent Panel (Ctrl+L)
    this.register('echocoder.openPanel', () => {
      vscode.commands.executeCommand('echocoder.agentPanel.focus');
    });

    // Explain Selection (Ctrl+Shift+K)
    this.register('echocoder.explain', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor || editor.selection.isEmpty) {
        vscode.window.showWarningMessage('EchoCoder: Select code to explain first.');
        return;
      }
      const selectedText = editor.document.getText(editor.selection);
      const language = editor.document.languageId;
      const prompt = `Explain the following ${language} code in detail:\n\n\`\`\`${language}\n${selectedText}\n\`\`\``;
      this.openChat(`@echo /explain ${prompt}`);
    });

    // Fix Diagnostics
    this.register('echocoder.fix', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) { return; }
      const diagnostics = vscode.languages.getDiagnostics(editor.document.uri);
      if (diagnostics.length === 0) {
        vscode.window.showInformationMessage('EchoCoder: No diagnostics to fix.');
        return;
      }
      const errors = diagnostics.map(d => `Line ${d.range.start.line + 1}: ${d.message}`).join('\n');
      this.openChat(`@echo /fix Fix these errors in ${editor.document.fileName}:\n${errors}`);
    });

    // Refactor
    this.register('echocoder.refactor', () => {
      this.openChat('@echo /refactor ');
    });

    // Composer Mode
    this.register('echocoder.compose', () => {
      this.openChat('@echo /compose ');
    });

    // Accept Change
    this.register('echocoder.acceptChange', (changeId?: string) => {
      this.diffDecorator.acceptChange(changeId);
    });

    // Reject Change
    this.register('echocoder.rejectChange', (changeId?: string) => {
      this.diffDecorator.rejectChange(changeId);
    });

    // Accept All Changes
    this.register('echocoder.acceptAllChanges', () => {
      this.diffDecorator.acceptAllChanges();
    });

    // Approve Plan
    this.register('echocoder.approvePlan', () => {
      this.workflowLoop.approvePlan();
    });

    // Reject Plan
    this.register('echocoder.rejectPlan', () => {
      this.workflowLoop.rejectPlan();
    });

    // Repair Plan
    this.register('echocoder.repairPlan', () => {
      this.workflowLoop.repairPlan();
    });

    // New Session
    this.register('echocoder.newSession', () => {
      this.processManager.abort('new session requested');
      this.composerEngine.cancelCompose();
      this.diffDecorator.rejectAllChanges();
      this.sessionManager.resetSession();
      this.workflowLoop.reset();
      vscode.window.showInformationMessage('EchoCoder: Session state cleared.');
    });

    // Compact Context
    this.register('echocoder.compact', () => {
      if (this.processManager.running) {
        vscode.window.showInformationMessage(
          'EchoCoder: Auto-compaction cannot be injected in print mode. End this run and start a fresh chat turn instead.'
        );
        return;
      }
      this.openChat('@echo /compact Summarize and compact context for the next turn.');
    });

    // Terminal Run
    this.register('echocoder.terminalRun', () => {
      this.openChat('@echo Run this command: ');
    });

    return this.disposables;
  }

  private register(command: string, handler: (...args: any[]) => any): void {
    this.disposables.push(vscode.commands.registerCommand(command, handler));
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }

  private openChat(query: string): void {
    vscode.commands.executeCommand('workbench.action.chat.open', { query });
  }
}

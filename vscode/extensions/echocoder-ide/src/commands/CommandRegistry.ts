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
import { EditorContext } from '../context/EditorContext';
import { ComposerEngine } from '../composer/ComposerEngine';

export class CommandRegistry {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private inlineEditController: InlineEditController,
    private diffDecorator: DiffDecorator,
    private processManager: ProcessManager,
    private promptAssembler: PromptAssembler,
    private composerEngine: ComposerEngine,
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

      // Send to chat panel
      vscode.commands.executeCommand('workbench.action.chat.open', { query: `@echo /explain ${prompt}` });
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
      vscode.commands.executeCommand('workbench.action.chat.open', {
        query: `@echo /fix Fix these errors in ${editor.document.fileName}:\n${errors}`,
      });
    });

    // Refactor
    this.register('echocoder.refactor', () => {
      vscode.commands.executeCommand('workbench.action.chat.open', { query: '@echo /refactor ' });
    });

    // Composer Mode
    this.register('echocoder.compose', () => {
      vscode.commands.executeCommand('workbench.action.chat.open', { query: '@echo /compose ' });
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

    // New Session
    this.register('echocoder.newSession', () => {
      this.processManager.abort();
    });

    // Compact Context
    this.register('echocoder.compact', () => {
      vscode.window.showInformationMessage('EchoCoder: Context compaction requested. This will be handled by the agent.');
    });

    // Terminal Run
    this.register('echocoder.terminalRun', () => {
      vscode.commands.executeCommand('workbench.action.chat.open', { query: '@echo Run this command: ' });
    });

    return this.disposables;
  }

  private register(command: string, handler: (...args: any[]) => any): void {
    this.disposables.push(vscode.commands.registerCommand(command, handler));
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
  }
}

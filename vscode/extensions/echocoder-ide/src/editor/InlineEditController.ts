/**
 * InlineEditController — Ctrl+K / Ctrl+I In-Place AI Editing
 * 
 * Orchestrates the inline edit workflow:
 * 1. User selects code + presses Ctrl+K (or Ctrl+I)
 * 2. InputBox overlay asks for edit instruction
 * 3. Captures selection + file + surrounding context
 * 4. Sends targeted prompt to OpenClaude
 * 5. Receives replacement code from agent
 * 6. Triggers DiffDecorator to show inline green/red diff
 * 7. Waits for Accept/Reject action via CodeLens
 */

import * as vscode from 'vscode';
import { ProcessManager } from '../core/ProcessManager';
import { DiffDecorator, PendingChange } from './DiffDecorator';
import { AgentEvent, isTextDelta, isResultSuccess, isResultError } from '../types/agent-events';

export class InlineEditController {
  private processManager: ProcessManager;
  private diffDecorator: DiffDecorator;
  private outputChannel: vscode.OutputChannel;

  constructor(
    processManager: ProcessManager,
    diffDecorator: DiffDecorator,
    outputChannel: vscode.OutputChannel
  ) {
    this.processManager = processManager;
    this.diffDecorator = diffDecorator;
    this.outputChannel = outputChannel;
  }

  /**
   * Execute the inline edit workflow triggered by Ctrl+K or Ctrl+I.
   */
  public async executeInlineEdit(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showWarningMessage('EchoCoder: No active editor to edit.');
      return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);

    if (!selectedText || selectedText.trim().length === 0) {
      vscode.window.showWarningMessage('EchoCoder: Select code to edit first.');
      return;
    }

    // Ask for the edit instruction
    const instruction = await vscode.window.showInputBox({
      prompt: '✏️ EchoCoder: What should I change?',
      placeHolder: 'e.g., "Add error handling", "Convert to async/await", "Add TypeScript types"',
      ignoreFocusOut: true,
    });

    if (!instruction) {
      return; // User cancelled
    }

    // Show progress in status bar
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: '🤖 EchoCoder: Generating edit...',
        cancellable: true,
      },
      async (progress, token) => {
        await this.generateEdit(editor, selection, selectedText, instruction, token);
      }
    );
  }

  /**
   * Generate the edit by sending a targeted prompt to OpenClaude.
   */
  private async generateEdit(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    selectedText: string,
    instruction: string,
    token: vscode.CancellationToken
  ): Promise<void> {
    const document = editor.document;
    const filePath = document.fileName;
    const language = document.languageId;
    const startLine = selection.start.line + 1;
    const endLine = selection.end.line + 1;

    // Get surrounding context (20 lines before and after)
    const contextStart = Math.max(0, selection.start.line - 20);
    const contextEnd = Math.min(document.lineCount - 1, selection.end.line + 20);
    const beforeContext = document.getText(new vscode.Range(contextStart, 0, selection.start.line, 0));
    const afterContext = document.getText(new vscode.Range(selection.end.line + 1, 0, contextEnd, document.lineAt(contextEnd).text.length));

    const prompt = `Edit the following ${language} code according to the instruction below. Return ONLY the replacement code that should substitute the selected block. No explanations, no markdown code fences, just the raw replacement code.

File: ${filePath}
Language: ${language}
Lines: ${startLine}-${endLine}

Instruction: ${instruction}

Context before selection:
${beforeContext}

Selected code to edit:
${selectedText}

Context after selection:
${afterContext}

Replacement code:`;

    return new Promise<void>((resolve) => {
      let resultText = '';
      let resolved = false;

      const cleanup = () => {
        eventSub.dispose();
        exitSub.dispose();
      };

      const eventSub = this.processManager.onEvent((event: AgentEvent) => {
        if (isTextDelta(event)) {
          resultText += event.text;
        } else if (isResultSuccess(event)) {
          if (!resolved) {
            resolved = true;
            cleanup();
            this.applyInlineDiff(editor, selection, selectedText, resultText.trim());
            resolve();
          }
        } else if (isResultError(event)) {
          if (!resolved) {
            resolved = true;
            cleanup();
            vscode.window.showErrorMessage(`EchoCoder: ${event.error}`);
            resolve();
          }
        }
      });

      const exitSub = this.processManager.onExit(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          if (resultText.trim()) {
            this.applyInlineDiff(editor, selection, selectedText, resultText.trim());
          }
          resolve();
        }
      });

      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

      this.processManager.spawn({
        prompt,
        cwd,
        additionalFlags: ['--no-tool-use'],
      }, token).catch(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      });
    });
  }

  /**
   * Apply the inline diff decorations showing old vs new code.
   */
  private applyInlineDiff(
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    originalText: string,
    newText: string
  ): void {
    // Strip any markdown code fences the model might have added
    let cleanedText = newText;
    const fenceMatch = cleanedText.match(/^```[\w]*\n?([\s\S]*?)\n?```$/);
    if (fenceMatch) {
      cleanedText = fenceMatch[1];
    }

    if (cleanedText === originalText) {
      vscode.window.showInformationMessage('EchoCoder: No changes suggested.');
      return;
    }

    // Create a pending change and apply decorations
    const change: PendingChange = {
      id: `edit-${Date.now()}`,
      uri: editor.document.uri,
      range: new vscode.Range(selection.start, selection.end),
      originalText,
      newText: cleanedText,
      timestamp: Date.now(),
    };

    this.diffDecorator.addPendingChange(change);

    vscode.window.showInformationMessage(
      '🤖 EchoCoder: Edit ready — use Accept/Reject above the code or Ctrl+Shift+Enter / Ctrl+Shift+Backspace',
    );
  }

  public dispose(): void {
    // Nothing to dispose
  }
}

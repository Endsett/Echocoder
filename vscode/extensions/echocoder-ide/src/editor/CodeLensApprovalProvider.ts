/**
 * CodeLensApprovalProvider — Accept/Reject Buttons for AI Changes
 * 
 * Renders CodeLens buttons directly above AI-proposed change blocks:
 *   ✅ Accept  |  ❌ Reject  |  ✅ Accept All
 * 
 * Dynamically registered when inline edits are pending and
 * automatically cleared when changes are resolved.
 */

import * as vscode from 'vscode';
import { DiffDecorator } from './DiffDecorator';

export class CodeLensApprovalProvider implements vscode.CodeLensProvider {
  private diffDecorator: DiffDecorator;
  private _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  constructor(diffDecorator: DiffDecorator) {
    this.diffDecorator = diffDecorator;

    // Refresh CodeLenses when pending changes are updated
    this.diffDecorator.onDidChangeChanges(() => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];

    for (const change of this.diffDecorator.getPendingChanges()) {
      // Only show for matching document
      if (change.uri.toString() !== document.uri.toString()) {
        continue;
      }

      const range = new vscode.Range(change.range.start.line, 0, change.range.start.line, 0);

      // Accept button
      lenses.push(new vscode.CodeLens(range, {
        title: '✅ Accept',
        command: 'echocoder.acceptChange',
        arguments: [change.id],
        tooltip: 'Accept this AI-proposed change',
      }));

      // Reject button
      lenses.push(new vscode.CodeLens(range, {
        title: '❌ Reject',
        command: 'echocoder.rejectChange',
        arguments: [change.id],
        tooltip: 'Reject this change and keep original code',
      }));

      // Accept All (only if multiple changes)
      if (this.diffDecorator.getPendingChanges().length > 1) {
        lenses.push(new vscode.CodeLens(range, {
          title: '✅ Accept All',
          command: 'echocoder.acceptAllChanges',
          tooltip: 'Accept all pending AI changes',
        }));
      }
    }

    return lenses;
  }

  public dispose(): void {
    this._onDidChangeCodeLenses.dispose();
  }
}

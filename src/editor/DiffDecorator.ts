/**
 * DiffDecorator — Inline Diff Visualization
 * 
 * Shows proposed AI changes as green (added) and red (removed) highlighted
 * lines directly in the editor. Works in concert with CodeLensApprovalProvider
 * to show Accept/Reject buttons above each change block.
 */

import * as vscode from 'vscode';

export interface PendingChange {
  id: string;
  uri: vscode.Uri;
  range: vscode.Range;
  originalText: string;
  newText: string;
  timestamp: number;
}

export class DiffDecorator {
  // Decoration types for visual diff
  private addedDecoration: vscode.TextEditorDecorationType;
  private removedDecoration: vscode.TextEditorDecorationType;
  private modifiedDecoration: vscode.TextEditorDecorationType;

  // Track pending changes
  private pendingChanges: Map<string, PendingChange> = new Map();

  // Event emitter for changes
  private readonly _onDidChangeChanges = new vscode.EventEmitter<void>();
  public readonly onDidChangeChanges = this._onDidChangeChanges.event;

  constructor() {
    // Green background for additions
    this.addedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(40, 167, 69, 0.15)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(40, 167, 69, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: undefined, // Will be set per platform
      after: {
        contentText: ' ✓ AI Change',
        color: 'rgba(40, 167, 69, 0.6)',
        fontStyle: 'italic',
      },
    });

    // Red border for removed lines (shown as annotation since we can't show deleted lines)
    this.removedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(220, 53, 69, 0.1)',
      isWholeLine: true,
      overviewRulerColor: 'rgba(220, 53, 69, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });

    // Yellow border for modified lines  
    this.modifiedDecoration = vscode.window.createTextEditorDecorationType({
      backgroundColor: 'rgba(255, 193, 7, 0.12)',
      isWholeLine: true,
      borderWidth: '0 0 0 3px',
      borderStyle: 'solid',
      borderColor: 'rgba(255, 193, 7, 0.6)',
      overviewRulerColor: 'rgba(255, 193, 7, 0.8)',
      overviewRulerLane: vscode.OverviewRulerLane.Left,
    });
  }

  /**
   * Add a pending change and apply decorations to the editor.
   */
  public addPendingChange(change: PendingChange): void {
    this.pendingChanges.set(change.id, change);
    this.applyDecorations(change);
    this._onDidChangeChanges.fire();

    // Set context for keybinding conditions
    vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', true);
  }

  /**
   * Apply visual decorations for a pending change.
   */
  private applyDecorations(change: PendingChange): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.toString() === change.uri.toString()
    );

    if (!editor) { return; }

    // Highlight the entire range that will be replaced
    const decorationRange: vscode.DecorationOptions = {
      range: change.range,
      hoverMessage: new vscode.MarkdownString(
        `**🤖 EchoCoder Proposed Edit**\n\n` +
        `\`\`\`diff\n- ${change.originalText.split('\n').join('\n- ')}\n` +
        `+ ${change.newText.split('\n').join('\n+ ')}\n\`\`\`\n\n` +
        `Use \`Ctrl+Shift+Enter\` to accept or \`Ctrl+Shift+Backspace\` to reject.`
      ),
    };

    editor.setDecorations(this.modifiedDecoration, [decorationRange]);
  }

  /**
   * Accept a pending change — apply the edit to the document.
   */
  public async acceptChange(changeId?: string): Promise<void> {
    const id = changeId || this.getFirstPendingId();
    if (!id) { return; }

    const change = this.pendingChanges.get(id);
    if (!change) { return; }

    // Apply the edit
    const edit = new vscode.WorkspaceEdit();
    edit.replace(change.uri, change.range, change.newText);
    await vscode.workspace.applyEdit(edit);

    // Remove the pending change
    this.pendingChanges.delete(id);
    this.clearDecorations(change.uri);
    this._onDidChangeChanges.fire();

    if (this.pendingChanges.size === 0) {
      vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
    }

    vscode.window.showInformationMessage('✅ EchoCoder: Change accepted.');
  }

  /**
   * Reject a pending change — clear decorations, keep original code.
   */
  public rejectChange(changeId?: string): void {
    const id = changeId || this.getFirstPendingId();
    if (!id) { return; }

    const change = this.pendingChanges.get(id);
    if (!change) { return; }

    this.pendingChanges.delete(id);
    this.clearDecorations(change.uri);
    this._onDidChangeChanges.fire();

    if (this.pendingChanges.size === 0) {
      vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
    }

    vscode.window.showInformationMessage('❌ EchoCoder: Change rejected.');
  }

  /**
   * Accept all pending changes.
   */
  public async acceptAllChanges(): Promise<void> {
    const edit = new vscode.WorkspaceEdit();

    for (const change of this.pendingChanges.values()) {
      edit.replace(change.uri, change.range, change.newText);
    }

    await vscode.workspace.applyEdit(edit);
    this.pendingChanges.clear();
    this.clearAllDecorations();
    this._onDidChangeChanges.fire();
    vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
    vscode.window.showInformationMessage('✅ EchoCoder: All changes accepted.');
  }

  /**
   * Reject all pending changes and clear decorations.
   */
  public rejectAllChanges(): void {
    if (this.pendingChanges.size === 0) {
      return;
    }

    this.pendingChanges.clear();
    this.clearAllDecorations();
    this._onDidChangeChanges.fire();
    vscode.commands.executeCommand('setContext', 'echocoder.hasPendingChanges', false);
  }

  /**
   * Get all pending changes (for CodeLens rendering).
   */
  public getPendingChanges(): PendingChange[] {
    return Array.from(this.pendingChanges.values());
  }

  private getFirstPendingId(): string | undefined {
    const first = this.pendingChanges.keys().next();
    return first.done ? undefined : first.value;
  }

  private clearDecorations(uri: vscode.Uri): void {
    const editor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.toString() === uri.toString()
    );
    if (editor) {
      editor.setDecorations(this.addedDecoration, []);
      editor.setDecorations(this.removedDecoration, []);
      editor.setDecorations(this.modifiedDecoration, []);
    }
  }

  private clearAllDecorations(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      editor.setDecorations(this.addedDecoration, []);
      editor.setDecorations(this.removedDecoration, []);
      editor.setDecorations(this.modifiedDecoration, []);
    }
  }

  public dispose(): void {
    this.addedDecoration.dispose();
    this.removedDecoration.dispose();
    this.modifiedDecoration.dispose();
    this._onDidChangeChanges.dispose();
    this.pendingChanges.clear();
  }
}

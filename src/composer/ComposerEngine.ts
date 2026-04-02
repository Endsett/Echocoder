/**
 * ComposerEngine - Multi-file orchestration and atomic apply flow.
 */

import * as vscode from 'vscode';
import { EventRouter } from '../core/EventRouter';
import { FileEditEvent, FileCreateEvent } from '../types/agent-events';
import { FileChangeTracker, TrackedFileChange } from './FileChangeTracker';

export class ComposerEngine {
  private readonly changeTracker: FileChangeTracker;
  private isComposing = false;

  private readonly _onComposerStart = new vscode.EventEmitter<void>();
  private readonly _onComposerComplete = new vscode.EventEmitter<TrackedFileChange[]>();
  private readonly _onFileChanged = new vscode.EventEmitter<TrackedFileChange>();

  public readonly onComposerStart = this._onComposerStart.event;
  public readonly onComposerComplete = this._onComposerComplete.event;
  public readonly onFileChanged = this._onFileChanged.event;

  constructor(
    private readonly eventRouter: EventRouter,
    private readonly outputChannel: vscode.OutputChannel
  ) {
    this.changeTracker = new FileChangeTracker();
    this.wireEvents();
  }

  private wireEvents(): void {
    this.eventRouter.onFileEdit((event: FileEditEvent) => {
      if (!this.isComposing) {
        return;
      }
      const change = this.changeTracker.trackEdit(event);
      this._onFileChanged.fire(change);
      this.outputChannel.appendLine(`[Composer] File edit tracked: ${event.path}`);
    });

    this.eventRouter.onFileCreate((event: FileCreateEvent) => {
      if (!this.isComposing) {
        return;
      }
      const change = this.changeTracker.trackCreate(event);
      this._onFileChanged.fire(change);
      this.outputChannel.appendLine(`[Composer] File create tracked: ${event.path}`);
    });

    this.eventRouter.onSuccess(() => {
      if (this.isComposing) {
        void this.finalizeCompose();
      }
    });

    this.eventRouter.onError((event) => {
      if (!this.isComposing) {
        return;
      }
      this.outputChannel.appendLine(
        `[Composer] Agent error while composing: ${event.error || event.result || 'unknown error'}`
      );
      this.cancelCompose();
    });
  }

  public startCompose(): void {
    this.isComposing = true;
    this.changeTracker.clear();
    this._onComposerStart.fire();
    this.outputChannel.appendLine('[Composer] Composition started - accumulating file changes');
  }

  public async finalizeCompose(): Promise<void> {
    this.isComposing = false;
    const changes = this.changeTracker.getChanges();

    if (changes.length === 0) {
      this.outputChannel.appendLine('[Composer] No file changes to apply');
      this._onComposerComplete.fire([]);
      return;
    }

    const summary = this.buildChangeSummary(changes);
    const choice = await vscode.window.showInformationMessage(
      `EchoCoder Composer prepared ${changes.length} change(s): ${summary}. Apply now?`,
      { modal: true },
      'Apply',
      'Discard'
    );

    if (choice !== 'Apply') {
      this.outputChannel.appendLine(`[Composer] User discarded ${changes.length} pending file changes`);
      this._onComposerComplete.fire([]);
      this.changeTracker.clear();
      return;
    }

    this.outputChannel.appendLine(`[Composer] Applying ${changes.length} file changes atomically`);
    const workspaceEdit = new vscode.WorkspaceEdit();

    for (const change of changes) {
      const uri = vscode.Uri.file(change.absolutePath);

      if (change.type === 'create') {
        workspaceEdit.createFile(uri, { ignoreIfExists: true });
        workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
        continue;
      }

      try {
        const doc = await vscode.workspace.openTextDocument(uri);
        const fullRange = new vscode.Range(
          doc.positionAt(0),
          doc.positionAt(doc.getText().length)
        );
        workspaceEdit.replace(uri, fullRange, change.newContent);
      } catch {
        workspaceEdit.createFile(uri, { ignoreIfExists: true });
        workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
      }
    }

    const success = await vscode.workspace.applyEdit(workspaceEdit);
    if (success) {
      this.outputChannel.appendLine(`[Composer] Applied ${changes.length} change(s) successfully`);
      vscode.window.showInformationMessage(
        `EchoCoder Composer: ${changes.length} file(s) modified atomically.`
      );
    } else {
      this.outputChannel.appendLine('[Composer] Failed to apply workspace edit');
      vscode.window.showErrorMessage(`EchoCoder Composer: Failed to apply changes (${summary}).`);
    }

    this._onComposerComplete.fire(changes);
    this.changeTracker.clear();
  }

  public cancelCompose(): void {
    this.isComposing = false;
    const count = this.changeTracker.getChanges().length;
    this.changeTracker.clear();
    this.outputChannel.appendLine(`[Composer] Composition cancelled - ${count} changes discarded`);
  }

  public dispose(): void {
    this._onComposerStart.dispose();
    this._onComposerComplete.dispose();
    this._onFileChanged.dispose();
  }

  private buildChangeSummary(changes: TrackedFileChange[]): string {
    const created = changes.filter((change) => change.type === 'create').length;
    const edited = changes.filter((change) => change.type === 'edit').length;
    const firstPaths = changes.slice(0, 3).map((change) => change.relativePath).join(', ');
    const moreCount = Math.max(changes.length - 3, 0);

    const counts = `${edited} edit(s), ${created} create(s)`;
    if (!firstPaths) {
      return counts;
    }
    return moreCount > 0
      ? `${counts} (${firstPaths}, +${moreCount} more)`
      : `${counts} (${firstPaths})`;
  }
}

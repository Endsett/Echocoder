/**
 * ComposerEngine — Multi-File Agent Orchestration
 * 
 * The "Composer" mode: workspace-aware agent capable of orchestrating
 * complex edits across multiple files simultaneously. Accumulates all
 * file mutations from the OpenClaude NDJSON stream into a single
 * vscode.WorkspaceEdit instance, then applies them atomically.
 * 
 * This is the Phase 1 equivalent of Cursor's Composer feature.
 */

import * as vscode from 'vscode';
import { EventRouter } from '../core/EventRouter';
import { FileEditEvent, FileCreateEvent } from '../types/agent-events';
import { FileChangeTracker, TrackedFileChange } from './FileChangeTracker';

export class ComposerEngine {
  private eventRouter: EventRouter;
  private changeTracker: FileChangeTracker;
  private outputChannel: vscode.OutputChannel;
  private isComposing: boolean = false;

  // Event emitters
  private readonly _onComposerStart = new vscode.EventEmitter<void>();
  private readonly _onComposerComplete = new vscode.EventEmitter<TrackedFileChange[]>();
  private readonly _onFileChanged = new vscode.EventEmitter<TrackedFileChange>();

  public readonly onComposerStart = this._onComposerStart.event;
  public readonly onComposerComplete = this._onComposerComplete.event;
  public readonly onFileChanged = this._onFileChanged.event;

  constructor(eventRouter: EventRouter, outputChannel: vscode.OutputChannel) {
    this.eventRouter = eventRouter;
    this.changeTracker = new FileChangeTracker();
    this.outputChannel = outputChannel;

    this.wireEvents();
  }

  /**
   * Wire up EventRouter events to accumulate file changes.
   */
  private wireEvents(): void {
    this.eventRouter.onFileEdit((event: FileEditEvent) => {
      if (this.isComposing) {
        const change = this.changeTracker.trackEdit(event);
        this._onFileChanged.fire(change);
        this.outputChannel.appendLine(`[Composer] File edit tracked: ${event.path}`);
      }
    });

    this.eventRouter.onFileCreate((event: FileCreateEvent) => {
      if (this.isComposing) {
        const change = this.changeTracker.trackCreate(event);
        this._onFileChanged.fire(change);
        this.outputChannel.appendLine(`[Composer] File create tracked: ${event.path}`);
      }
    });

    // When agent completes, apply all accumulated edits atomically
    this.eventRouter.onSuccess(() => {
      if (this.isComposing) {
        this.finalizeCompose();
      }
    });

    // On failure, stop compose mode so stale file events are not carried over.
    this.eventRouter.onError((event) => {
      if (this.isComposing) {
        this.outputChannel.appendLine(`[Composer] Agent error while composing: ${event.error || event.result || 'unknown error'}`);
        this.cancelCompose();
      }
    });
  }

  /**
   * Begin composing — start accumulating file changes.
   */
  public startCompose(): void {
    this.isComposing = true;
    this.changeTracker.clear();
    this._onComposerStart.fire();
    this.outputChannel.appendLine('[Composer] Composition started — accumulating file changes');
  }

  /**
   * Finalize the composition — apply all changes atomically via WorkspaceEdit.
   */
  public async finalizeCompose(): Promise<void> {
    this.isComposing = false;
    const changes = this.changeTracker.getChanges();

    if (changes.length === 0) {
      this.outputChannel.appendLine('[Composer] No file changes to apply');
      this._onComposerComplete.fire([]);
      return;
    }

    this.outputChannel.appendLine(`[Composer] Applying ${changes.length} file changes atomically`);

    // Build a single WorkspaceEdit containing all file mutations
    const workspaceEdit = new vscode.WorkspaceEdit();

    for (const change of changes) {
      const uri = vscode.Uri.file(change.absolutePath);

      if (change.type === 'create') {
        // Create new file with content
        workspaceEdit.createFile(uri, { ignoreIfExists: false });
        workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
      } else if (change.type === 'edit') {
        // Replace entire file content
        // We need to get the full range of the existing document
        try {
          const doc = await vscode.workspace.openTextDocument(uri);
          const fullRange = new vscode.Range(
            doc.positionAt(0),
            doc.positionAt(doc.getText().length)
          );
          workspaceEdit.replace(uri, fullRange, change.newContent);
        } catch {
          // File might not exist yet — create it
          workspaceEdit.createFile(uri, { ignoreIfExists: true });
          workspaceEdit.insert(uri, new vscode.Position(0, 0), change.newContent);
        }
      }
    }

    // Apply all changes in one atomic, undoable action
    const success = await vscode.workspace.applyEdit(workspaceEdit);

    if (success) {
      this.outputChannel.appendLine(`[Composer] ✅ ${changes.length} changes applied successfully`);
      vscode.window.showInformationMessage(
        `🤖 EchoCoder Composer: ${changes.length} file(s) modified atomically.`
      );
    } else {
      this.outputChannel.appendLine('[Composer] ❌ Failed to apply workspace edit');
      vscode.window.showErrorMessage('EchoCoder Composer: Failed to apply changes.');
    }

    this._onComposerComplete.fire(changes);
    this.changeTracker.clear();
  }

  /**
   * Cancel the current composition without applying changes.
   */
  public cancelCompose(): void {
    this.isComposing = false;
    const count = this.changeTracker.getChanges().length;
    this.changeTracker.clear();
    this.outputChannel.appendLine(`[Composer] Composition cancelled — ${count} changes discarded`);
  }

  public dispose(): void {
    this._onComposerStart.dispose();
    this._onComposerComplete.dispose();
    this._onFileChanged.dispose();
  }
}

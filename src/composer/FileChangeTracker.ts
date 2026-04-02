/**
 * FileChangeTracker — Tracks File Mutations from Agent Stream
 * 
 * Accumulates file_edit and file_create events from the NDJSON stream
 * into a structured list for the ComposerEngine to apply atomically.
 */

import * as path from 'path';
import * as vscode from 'vscode';
import { FileEditEvent, FileCreateEvent } from '../types/agent-events';

export interface TrackedFileChange {
  id: string;
  type: 'edit' | 'create';
  relativePath: string;
  absolutePath: string;
  oldContent: string;
  newContent: string;
  timestamp: number;
}

export class FileChangeTracker {
  private changes: Map<string, TrackedFileChange> = new Map();

  /**
   * Track a file edit event.
   */
  public trackEdit(event: FileEditEvent): TrackedFileChange {
    const absolutePath = this.resolveAbsolutePath(event.path);
    const change: TrackedFileChange = {
      id: `edit-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'edit',
      relativePath: event.path,
      absolutePath,
      oldContent: event.old_content,
      newContent: event.new_content,
      timestamp: Date.now(),
    };

    // If we already have a change for this file, update it
    // (agent may have edited the same file multiple times in one turn)
    const existing = this.findByPath(absolutePath);
    if (existing) {
      existing.newContent = event.new_content;
      existing.timestamp = Date.now();
      return existing;
    }

    this.changes.set(change.id, change);
    return change;
  }

  /**
   * Track a file create event.
   */
  public trackCreate(event: FileCreateEvent): TrackedFileChange {
    const absolutePath = this.resolveAbsolutePath(event.path);
    const change: TrackedFileChange = {
      id: `create-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'create',
      relativePath: event.path,
      absolutePath,
      oldContent: '',
      newContent: event.content,
      timestamp: Date.now(),
    };

    this.changes.set(change.id, change);
    return change;
  }

  /**
   * Get all tracked changes.
   */
  public getChanges(): TrackedFileChange[] {
    return Array.from(this.changes.values());
  }

  /**
   * Clear all tracked changes.
   */
  public clear(): void {
    this.changes.clear();
  }

  /**
   * Find a change by absolute path.
   */
  private findByPath(absolutePath: string): TrackedFileChange | undefined {
    for (const change of this.changes.values()) {
      if (change.absolutePath === absolutePath) {
        return change;
      }
    }
    return undefined;
  }

  /**
   * Resolve a potentially relative path to absolute using workspace folders.
   */
  private resolveAbsolutePath(filePath: string): string {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      return path.resolve(workspaceFolder.uri.fsPath, filePath);
    }

    return path.resolve(filePath);
  }
}

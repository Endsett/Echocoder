/**
 * DiffContentProvider — Virtual Document Provider for Diff Previews
 * 
 * Handles the 'echocoder-diff' scheme to provide pre-mutation and 
 * post-mutation content for VS Code's native diff editor.
 */

import * as vscode from 'vscode';

export class DiffContentProvider implements vscode.TextDocumentContentProvider {
  static readonly SCHEME = 'echocoder-diff';

  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Provide the content for a given virtual URI.
   * 
   * URI format: echocoder-diff:original/filename?content
   * or: echocoder-diff:modified/filename?content
   */
  provideTextDocumentContent(uri: vscode.Uri): string {
    // The content is passed in the query string (encoded)
    const content = decodeURIComponent(uri.query);
    return content;
  }

  /**
   * Trigger an update for a specific URI.
   */
  update(uri: vscode.Uri): void {
    this._onDidChange.fire(uri);
  }
}

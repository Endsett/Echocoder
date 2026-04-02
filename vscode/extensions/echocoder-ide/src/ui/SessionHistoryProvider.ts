/**
 * SessionHistoryProvider — Past Agent Sessions Tree View
 * 
 * Shows a chronological list of past agent sessions in the sidebar.
 * Each session stores a summary and timestamp. Persisted to globalState.
 */

import * as vscode from 'vscode';

interface SessionEntry {
  id: string;
  summary: string;
  timestamp: number;
  messageCount: number;
}

export class SessionHistoryProvider implements vscode.TreeDataProvider<SessionEntry> {
  private sessions: SessionEntry[] = [];
  private context: vscode.ExtensionContext;

  private _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadSessions();
  }

  getTreeItem(element: SessionEntry): vscode.TreeItem {
    const item = new vscode.TreeItem(element.summary, vscode.TreeItemCollapsibleState.None);
    item.description = new Date(element.timestamp).toLocaleString();
    item.tooltip = `${element.messageCount} messages`;
    item.iconPath = new vscode.ThemeIcon('comment-discussion');
    return item;
  }

  getChildren(): SessionEntry[] {
    return this.sessions.sort((a, b) => b.timestamp - a.timestamp);
  }

  public addSession(summary: string, messageCount: number): void {
    this.sessions.push({
      id: `session-${Date.now()}`,
      summary: summary.substring(0, 80),
      timestamp: Date.now(),
      messageCount,
    });
    this.saveSessions();
    this._onDidChangeTreeData.fire();
  }

  private loadSessions(): void {
    this.sessions = this.context.globalState.get<SessionEntry[]>('echocoder.sessions', []);
  }

  private saveSessions(): void {
    // Keep only last 50 sessions
    if (this.sessions.length > 50) {
      this.sessions = this.sessions.slice(-50);
    }
    this.context.globalState.update('echocoder.sessions', this.sessions);
  }

  public dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

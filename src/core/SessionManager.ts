/**
 * SessionManager — Agent Conversation History
 *
 * Maintains the session history within the IDE instead of relying on
 * the unstable \`--resume\` flag. Keeps track of conversation turns and
 * injects them into future prompts using \`<echo_history>\` blocks.
 */

import * as vscode from 'vscode';

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  turns: Turn[];
  startTime: number;
  lastUpdated: number;
}

/** Maximum number of turns to keep in context to prevent token explosion. */
const MAX_TURNS_IN_CONTEXT = 10;

export class SessionManager {
  private activeSession: Session | null = null;
  private readonly _onSessionChanged = new vscode.EventEmitter<Session | null>();
  public readonly onSessionChanged = this._onSessionChanged.event;

  constructor(private context: vscode.ExtensionContext) {
    this.restoreSession();
  }

  /**
   * Add a new conversation turn to the active session.
   * Automatically creates a new session if none exists.
   */
  public addTurn(role: 'user' | 'assistant', content: string): void {
    if (!this.activeSession) {
      this.activeSession = {
        id: `session-${Date.now()}`,
        turns: [],
        startTime: Date.now(),
        lastUpdated: Date.now(),
      };
    }

    this.activeSession.turns.push({
      role,
      content,
      timestamp: Date.now(),
    });
    this.activeSession.lastUpdated = Date.now();

    this.persistSession();
    this._onSessionChanged.fire(this.activeSession);
  }

  /**
   * Reset the active session, clearing history.
   */
  public resetSession(): void {
    const oldSession = this.activeSession;
    this.activeSession = null;
    this.persistSession();
    
    if (oldSession) {
      this._onSessionChanged.fire(null);
    }
  }

  /**
   * Format the current history as an XML-like block to be appended
   * or prepended to the prompt assembly.
   */
  public getHistoryContext(): string {
    if (!this.activeSession || this.activeSession.turns.length === 0) {
      return '';
    }

    // Only take the last N turns to avoid blowing up the context window
    const recentTurns = this.activeSession.turns.slice(-MAX_TURNS_IN_CONTEXT);
    
    const historyBlock = recentTurns.map(t => {
      const roleStr = t.role === 'user' ? 'User' : 'Assistant';
      return `<turn role="${roleStr}">\n${t.content}\n</turn>`;
    }).join('\n\n');

    return `\n<echo_history>\n${historyBlock}\n</echo_history>\n`;
  }

  public getActiveSession(): Session | null {
    return this.activeSession;
  }

  private persistSession(): void {
    if (this.activeSession) {
      // Keep storage light by only saving recent turns
      const sessionToSave = {
        ...this.activeSession,
        turns: this.activeSession.turns.slice(-MAX_TURNS_IN_CONTEXT)
      };
      this.context.workspaceState.update('echocoder.activeSession', sessionToSave);
    } else {
      this.context.workspaceState.update('echocoder.activeSession', undefined);
    }
  }

  private restoreSession(): void {
    const saved = this.context.workspaceState.get<Session>('echocoder.activeSession');
    if (saved) {
      this.activeSession = saved;
      this._onSessionChanged.fire(this.activeSession);
    }
  }

  public dispose(): void {
    this._onSessionChanged.dispose();
  }
}

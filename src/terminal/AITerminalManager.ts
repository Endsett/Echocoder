/**
 * AITerminalManager — Agent Terminal Execution
 * 
 * Creates a dedicated EchoCoder terminal and manages agent-initiated
 * command execution. All commands pass through the ToolInterceptor
 * for security approval before execution.
 */

import * as vscode from 'vscode';

export class AITerminalManager {
  private terminal: vscode.Terminal | null = null;
  private outputChannel: vscode.OutputChannel;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;

    // Clean up if terminal is closed
    vscode.window.onDidCloseTerminal((t) => {
      if (t === this.terminal) {
        this.terminal = null;
      }
    });
  }

  /**
   * Get or create the EchoCoder terminal.
   */
  private getTerminal(): vscode.Terminal {
    if (!this.terminal || this.terminal.exitStatus !== undefined) {
      this.terminal = vscode.window.createTerminal({
        name: '🤖 EchoCoder Terminal',
        iconPath: new vscode.ThemeIcon('hubot'),
      });
    }
    return this.terminal;
  }

  /**
   * Execute a command in the EchoCoder terminal.
   * The command should already be approved by the ToolInterceptor.
   */
  public executeCommand(command: string): void {
    const terminal = this.getTerminal();
    terminal.show(true); // Preserve focus on editor
    terminal.sendText(command);
    this.outputChannel.appendLine(`[Terminal] Executed: ${command}`);
  }

  /**
   * Show the terminal without executing anything.
   */
  public show(): void {
    this.getTerminal().show();
  }

  public dispose(): void {
    this.terminal?.dispose();
  }
}

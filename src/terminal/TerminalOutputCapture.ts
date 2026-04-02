/**
 * TerminalOutputCapture — Captures Terminal Output for Agent Feedback
 * 
 * Buffers terminal output so the agent can react to command results,
 * build errors, test failures, etc.
 */

import * as vscode from 'vscode';

export class TerminalOutputCapture {
  private buffer: string = '';
  private maxBufferSize: number = 10000; // characters

  constructor() {
    // Use onDidWriteTerminalData if available (proposed API)
    // Fallback: agent will need to read from stdout of spawned processes
    try {
      (vscode.window as any).onDidWriteTerminalData?.((e: any) => {
        this.buffer += e.data;
        // Trim buffer if too large
        if (this.buffer.length > this.maxBufferSize) {
          this.buffer = this.buffer.slice(-this.maxBufferSize);
        }
      });
    } catch {
      // Proposed API not available — gracefully degrade
    }
  }

  /**
   * Get the current buffer contents.
   */
  public getOutput(): string {
    return this.buffer;
  }

  /**
   * Clear the buffer.
   */
  public clear(): void {
    this.buffer = '';
  }

  /**
   * Get the last N characters of output.
   */
  public getLastOutput(chars: number = 2000): string {
    return this.buffer.slice(-chars);
  }

  public dispose(): void {
    this.buffer = '';
  }
}

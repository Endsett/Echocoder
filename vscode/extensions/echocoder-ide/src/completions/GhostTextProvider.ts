/**
 * GhostTextProvider — Inline Completion Item Provider
 * 
 * Implements vscode.InlineCompletionItemProvider to deliver proactive
 * AI code predictions as dimmed "ghost text" in the editor while
 * the user types — the hallmark of an AI-native IDE.
 * 
 * Uses a lightweight OpenClaude execution loop optimized for speed:
 * sends surrounding code context and receives completion predictions.
 * Debounced to prevent excessive API calls on rapid typing.
 */

import * as vscode from 'vscode';
import { ProcessManager } from '../core/ProcessManager';
import { getConfig } from '../types/config';
import { AgentEvent, isTextDelta, isResultSuccess } from '../types/agent-events';

export class GhostTextProvider implements vscode.InlineCompletionItemProvider {
  private processManager: ProcessManager;
  private debounceTimer: NodeJS.Timeout | null = null;
  private lastCompletion: string = '';
  private outputChannel: vscode.OutputChannel;

  constructor(processManager: ProcessManager, outputChannel: vscode.OutputChannel) {
    this.processManager = processManager;
    this.outputChannel = outputChannel;
  }

  async provideInlineCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.InlineCompletionContext,
    token: vscode.CancellationToken
  ): Promise<vscode.InlineCompletionItem[] | undefined> {
    const config = getConfig();

    if (!config.ghostTextEnabled) {
      return undefined;
    }

    // Don't trigger on auto-trigger if agent is busy with a main task
    if (this.processManager.running) {
      return undefined;
    }

    // Build context window: lines before and after cursor
    const lineCount = document.lineCount;
    const startLine = Math.max(0, position.line - 50);
    const endLine = Math.min(lineCount - 1, position.line + 10);

    const prefixRange = new vscode.Range(startLine, 0, position.line, position.character);
    const suffixRange = new vscode.Range(position.line, position.character, endLine, document.lineAt(endLine).text.length);

    const prefix = document.getText(prefixRange);
    const suffix = document.getText(suffixRange);
    const language = document.languageId;
    const fileName = document.fileName;

    // Build a focused completion prompt
    const prompt = `Complete the following ${language} code. Respond ONLY with the code that should come next, nothing else. No explanations, no markdown, just raw code continuation.

File: ${fileName}
Language: ${language}

Code before cursor:
\`\`\`
${prefix}
\`\`\`

Code after cursor:
\`\`\`
${suffix}
\`\`\`

Continue from where the cursor is:`;

    try {
      const completion = await this.getCompletion(prompt, document, token);

      if (!completion || token.isCancellationRequested) {
        return undefined;
      }

      // Create the inline completion item
      const item = new vscode.InlineCompletionItem(
        completion,
        new vscode.Range(position, position)
      );

      return [item];
    } catch (err) {
      this.outputChannel.appendLine(`[GhostText] Error: ${err}`);
      return undefined;
    }
  }

  /**
   * Execute a fast completion via OpenClaude and collect the result.
   */
  private getCompletion(
    prompt: string,
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<string | null> {
    return new Promise((resolve) => {
      let result = '';
      let resolved = false;

      const cleanup = () => {
        eventDisposable.dispose();
        exitDisposable.dispose();
      };

      const eventDisposable = this.processManager.onEvent((event: AgentEvent) => {
        if (isTextDelta(event)) {
          result += event.text;
        } else if (isResultSuccess(event)) {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve(result.trim() || null);
          }
        }
      });

      const exitDisposable = this.processManager.onExit(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(result.trim() || null);
        }
      });

      token.onCancellationRequested(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          this.processManager.abort();
          resolve(null);
        }
      });

      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

      this.processManager.spawn({
        prompt,
        cwd,
        additionalFlags: ['--no-tool-use'], // Completions should not use tools
      }, token).catch(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      });
    });
  }

  public dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
  }
}

/**
 * Register the Ghost Text provider for all supported languages.
 */
export function registerGhostTextProvider(
  context: vscode.ExtensionContext,
  processManager: ProcessManager,
  outputChannel: vscode.OutputChannel
): vscode.Disposable {
  const provider = new GhostTextProvider(processManager, outputChannel);

  const disposable = vscode.languages.registerInlineCompletionItemProvider(
    { pattern: '**' }, // All file types
    provider
  );

  context.subscriptions.push(disposable);
  return disposable;
}

/**
 * ChatParticipantHandler
 *
 * Native VS Code chat surface backed by the shared ProcessManager and
 * PromptAssembler pipeline.
 */

import * as vscode from 'vscode';
import { ProcessManager } from '../core/ProcessManager';
import { EventRouter } from '../core/EventRouter';
import { PromptAssembler } from '../context/PromptAssembler';
import { ComposerEngine } from '../composer/ComposerEngine';
import {
  AgentEvent,
  isResultError,
  isResultSuccess,
  isTextDelta,
  isToolCall,
  isToolResult,
} from '../types/agent-events';

export class ChatParticipantHandler {
  constructor(
    private readonly processManager: ProcessManager,
    private readonly eventRouter: EventRouter,
    private readonly promptAssembler: PromptAssembler,
    private readonly composerEngine: ComposerEngine,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  public getHandler(): vscode.ChatRequestHandler {
    return async (
      request: vscode.ChatRequest,
      _context: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> => {
      const prompt = request.prompt.trim();
      const command = request.command;
      const isCompose = command === 'compose';

      if (!prompt) {
        stream.markdown('EchoCoder needs a prompt before it can start the agent.');
        return { metadata: { command, success: false, error: 'Empty prompt' } };
      }

      this.outputChannel.appendLine(`[Chat] Received ${command ? `/${command} ` : ''}${prompt.substring(0, 120)}`);

      if (isCompose) {
        this.composerEngine.startCompose();
        stream.progress('Composer mode activated. File changes will be collected during this run.');
      }

      let fullPrompt: string;
      let cwd: string;
      try {
        const assembled = await this.promptAssembler.assembleChatPrompt(prompt);
        fullPrompt = assembled.prompt;
        cwd = assembled.cwd;
        await this.processManager.ensureReady({ cwd });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isCompose) {
          this.composerEngine.cancelCompose();
        }
        stream.markdown(`EchoCoder could not start the agent.\n\n${message}`);
        return { metadata: { command, success: false, error: message } };
      }

      return new Promise<vscode.ChatResult>((resolve) => {
        let resolved = false;
        let streamedAnyText = false;

        const cleanup = () => {
          eventSub.dispose();
          exitSub.dispose();
        };

        const eventSub = this.processManager.onEvent((event: AgentEvent) => {
          if (token.isCancellationRequested) {
            this.processManager.abort('chat request cancelled');
            return;
          }

          if (isTextDelta(event)) {
            streamedAnyText = true;
            stream.markdown(event.text);
            return;
          }

          if (isToolCall(event)) {
            stream.progress(`Running ${event.tool}...`);
            return;
          }

          if (isToolResult(event) && event.is_error) {
            stream.markdown(`\n\nTool error from \`${event.tool}\`:\n\`\`\`\n${event.output.substring(0, 500)}\n\`\`\`\n`);
            return;
          }

          if (isResultSuccess(event)) {
            if (!streamedAnyText && event.result) {
              stream.markdown(event.result);
            }
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({ metadata: { command, success: true } });
            }
            return;
          }

          if (isResultError(event)) {
            const message = event.error || event.result || 'Unknown agent error';
            stream.markdown(`\n\nAgent error: ${message}\n`);
            if (isCompose) {
              this.composerEngine.cancelCompose();
            }
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({ metadata: { command, success: false, error: message } });
            }
          }
        });

        const exitSub = this.processManager.onExit((code) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            if (isCompose && code !== 0) {
              this.composerEngine.cancelCompose();
            }
            if (code && code !== 0) {
              stream.markdown(`\n\nAgent exited with code ${code}. Check the EchoCoder output channel for details.\n`);
            }
            resolve({ metadata: { command, exitCode: code } });
          }
        });

        this.processManager
          .spawn({ prompt: fullPrompt, cwd, mode: isCompose ? 'compose' : 'chat' }, token)
          .catch((error) => {
            if (!resolved) {
              resolved = true;
              cleanup();
              if (isCompose) {
                this.composerEngine.cancelCompose();
              }
              const message = error instanceof Error ? error.message : String(error);
              stream.markdown(`\n\nFailed to start agent: ${message}\n`);
              resolve({ metadata: { command, success: false, error: message } });
            }
          });
      });
    };
  }

  public dispose(): void {
    // Nothing to dispose.
  }
}

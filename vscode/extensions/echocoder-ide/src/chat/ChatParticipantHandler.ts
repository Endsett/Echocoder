/**
 * ChatParticipantHandler — Native VS Code @echo Chat Integration
 * 
 * Registers the @echo chat participant using the VS Code Chat API.
 * Routes prompts through ProcessManager and EventRouter, maps NDJSON
 * events to stream.markdown() and stream.progress() for the native
 * chat panel experience.
 */

import * as vscode from 'vscode';
import { ProcessManager } from '../core/ProcessManager';
import { EventRouter } from '../core/EventRouter';
import { PromptAssembler } from '../context/PromptAssembler';
import { ComposerEngine } from '../composer/ComposerEngine';
import {
  AgentEvent,
  isTextDelta,
  isToolCall,
  isToolResult,
  isResultSuccess,
  isResultError,
} from '../types/agent-events';

export class ChatParticipantHandler {
  private processManager: ProcessManager;
  private eventRouter: EventRouter;
  private promptAssembler: PromptAssembler;
  private composerEngine: ComposerEngine;
  private outputChannel: vscode.OutputChannel;

  constructor(
    processManager: ProcessManager,
    eventRouter: EventRouter,
    promptAssembler: PromptAssembler,
    composerEngine: ComposerEngine,
    outputChannel: vscode.OutputChannel
  ) {
    this.processManager = processManager;
    this.eventRouter = eventRouter;
    this.promptAssembler = promptAssembler;
    this.composerEngine = composerEngine;
    this.outputChannel = outputChannel;
  }

  /**
   * The ChatRequestHandler function registered with createChatParticipant.
   */
  public getHandler(): vscode.ChatRequestHandler {
    return async (
      request: vscode.ChatRequest,
      context: vscode.ChatContext,
      stream: vscode.ChatResponseStream,
      token: vscode.CancellationToken
    ): Promise<vscode.ChatResult> => {
      const prompt = request.prompt;
      const command = request.command;

      this.outputChannel.appendLine(`[Chat] Received: ${command ? `/${command} ` : ''}${prompt.substring(0, 100)}`);

      // Handle slash commands
      if (command === 'compose') {
        this.composerEngine.startCompose();
        stream.progress('🎼 Composer mode activated — accumulating multi-file changes...');
      }

      // Assemble the full prompt with context
      const fullPrompt = await this.promptAssembler.assemble(prompt);
      const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

      // Promise that resolves when the agent finishes
      return new Promise<vscode.ChatResult>((resolve) => {
        let resolved = false;

        const cleanup = () => {
          eventSub.dispose();
          exitSub.dispose();
        };

        const eventSub = this.processManager.onEvent((event: AgentEvent) => {
          if (token.isCancellationRequested) {
            this.processManager.abort();
            return;
          }

          // Route events to the chat stream
          if (isTextDelta(event)) {
            stream.markdown(event.text);
          } else if (isToolCall(event)) {
            stream.progress(`🔧 ${event.tool}...`);
          } else if (isToolResult(event)) {
            if (event.is_error) {
              stream.markdown(`\n\n❌ **Tool Error** (${event.tool_call_id}):\n\`\`\`\n${event.output.substring(0, 500)}\n\`\`\`\n\n`);
            }
          } else if (isResultSuccess(event)) {
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({ metadata: { command, success: true } });
            }
          } else if (isResultError(event)) {
            stream.markdown(`\n\n❌ **Error**: ${event.error}\n`);
            if (!resolved) {
              resolved = true;
              cleanup();
              resolve({ metadata: { command, success: false, error: event.error } });
            }
          }
        });

        const exitSub = this.processManager.onExit((code) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ metadata: { command, exitCode: code } });
          }
        });

        // Spawn the agent process
        this.processManager.spawn({ prompt: fullPrompt, cwd }, token).catch((err) => {
          stream.markdown(`\n\n❌ **Failed to start agent**: ${err}\n`);
          if (!resolved) {
            resolved = true;
            cleanup();
            resolve({ metadata: { command, success: false, error: String(err) } });
          }
        });
      });
    };
  }

  public dispose(): void {
    // Nothing to dispose
  }
}

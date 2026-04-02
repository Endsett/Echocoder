/**
 * ToolInterceptor — Security Gate for Agent Tool Executions
 * 
 * Implements the tiered security model from the phase1 blueprint:
 * - Auto-approve: non-mutating reads (read_file, grep, glob)
 * - Context-dependent: file writes (configurable, sensitive path blocking)
 * - Strict approval: bash execution, network requests (always prompt user)
 */

import * as vscode from 'vscode';
import { ToolCallEvent } from '../types/agent-events';
import { getConfig } from '../types/config';
import { AITerminalManager } from '../terminal/AITerminalManager';

export type ApprovalResult = 'approved' | 'denied' | 'cancelled';

// Tool categories
const READ_TOOLS = new Set([
  'read', 'ls', 'glob', 'grep', 'search', 'read_file',
  'list_files', 'list_directory', 'file_search', 'get_file',
]);

const WRITE_TOOLS = new Set([
  'write', 'edit', 'write_file', 'edit_file', 'create_file', 'delete_file',
  'rename_file', 'move_file', 'patch_file',
]);

const EXEC_TOOLS = new Set([
  'bash', 'powershell', 'run_bash', 'execute_command', 'shell', 'terminal',
  'run_command',
]);

const NETWORK_TOOLS = new Set([
  'fetch', 'curl', 'http_request', 'web_request', 'webfetch', 'web_search', 'websearch',
]);

// Sensitive file patterns that should NEVER be auto-approved
const SENSITIVE_PATTERNS = [
  '**/.env', '**/.env.*', '**/secrets/**', '**/.ssh/**',
  '**/.git/config', '**/credentials*', '**/*.key', '**/*.pem',
  '**/password*', '**/token*',
];

export class ToolInterceptor {
  private outputChannel: vscode.OutputChannel;
  private terminalManager: AITerminalManager;

  constructor(outputChannel: vscode.OutputChannel, terminalManager: AITerminalManager) {
    this.outputChannel = outputChannel;
    this.terminalManager = terminalManager;
  }

  /**
   * Evaluate a tool call and determine whether it should proceed.
   * Returns the approval result.
   */
  public async evaluate(event: ToolCallEvent): Promise<ApprovalResult> {
    const config = getConfig();
    const tool = event.tool.toLowerCase();

    this.outputChannel.appendLine(`[Security] Tool call: ${event.tool} — ${JSON.stringify(event.input).substring(0, 200)}`);

    // 1. Non-mutating reads — auto-approve if setting enabled
    if (READ_TOOLS.has(tool)) {
      if (config.autoApproveReads) {
        this.outputChannel.appendLine(`[Security] Auto-approved (read): ${event.tool}`);
        return 'approved';
      }
      return this.promptUser(event, 'read');
    }

    // 2. File writes — check sensitivity + config
    if (WRITE_TOOLS.has(tool)) {
      const filePath = this.extractFilePath(event);

      // Block sensitive files absolutely
      if (filePath && this.isSensitivePath(filePath)) {
        this.outputChannel.appendLine(`[Security] BLOCKED (sensitive path): ${filePath}`);
        vscode.window.showWarningMessage(`🛡️ EchoCoder blocked write to sensitive file: ${filePath}`);
        return 'denied';
      }

      if (config.autoApproveWrites) {
        this.outputChannel.appendLine(`[Security] Auto-approved (write): ${event.tool}`);
        return 'approved';
      }

      return this.promptUser(event, 'write');
    }

    // 3. Bash/command execution — ALWAYS prompt (unless terminalAutoRun)
    if (EXEC_TOOLS.has(tool)) {
      if (config.terminalAutoRun) {
        this.outputChannel.appendLine(`[Security] Auto-approved (terminal auto-run): ${event.tool}`);
        return 'approved';
      }
      return this.promptUser(event, 'execute');
    }

    // 4. Network requests — ALWAYS prompt
    if (NETWORK_TOOLS.has(tool)) {
      if (!config.allowNetworkTools) {
        this.outputChannel.appendLine(`[Security] BLOCKED (network disabled): ${event.tool}`);
        vscode.window.showWarningMessage(`EchoCoder blocked network tool ${event.tool}. Enable echocoder.allowNetworkTools to permit it.`);
        return 'denied';
      }
      return this.promptUser(event, 'network');
    }

    // 5. Unknown tools — prompt for safety
    return this.promptUser(event, 'unknown');
  }

  /**
   * Prompt the user for approval via VS Code dialog.
   */
  private async promptUser(event: ToolCallEvent, category: string): Promise<ApprovalResult> {
    const inputSummary = JSON.stringify(event.input, null, 2).substring(0, 500);
    const icons: Record<string, string> = {
      read: '📖',
      write: '✏️',
      execute: '⚡',
      network: '🌐',
      unknown: '❓',
    };

    const result = await vscode.window.showWarningMessage(
      `${icons[category] || '🔧'} EchoCoder wants to: ${event.tool}\n\n${inputSummary}`,
      { modal: true },
      'Approve',
      'Deny'
    );

    if (result === 'Approve') {
      this.outputChannel.appendLine(`[Security] User approved: ${event.tool}`);
      return 'approved';
    }

    this.outputChannel.appendLine(`[Security] User denied: ${event.tool}`);
    return 'denied';
  }

  /**
   * Extract the file path from a tool call's input.
   */
  private extractFilePath(event: ToolCallEvent): string | null {
    const input = event.input;
    return (input.path as string) || (input.file_path as string) || (input.filename as string) || null;
  }

  /**
   * Check if a file path matches sensitive patterns.
   */
  private isSensitivePath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').toLowerCase();
    const sensitiveKeywords = ['.env', 'secret', '.ssh', 'credential', '.key', '.pem', 'password', 'token'];
    return sensitiveKeywords.some(keyword => normalized.includes(keyword));
  }

  public dispose(): void {
    // Nothing to dispose
  }
}

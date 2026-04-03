/**
 * ProcessManager
 *
 * Canonical launcher for OpenClaude print-mode runs. It owns binary
 * resolution, preflight validation, child-process lifecycle, NDJSON
 * parsing, and session-scoped logging used by all agent-backed
 * surfaces in the extension.
 */

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { NDJSONParser } from './NDJSONParser';
import { AgentEvent } from '../types/agent-events';
import { EchoCoderConfig, getConfig, getProviderEnv } from '../types/config';

export type ProcessMode = 'chat' | 'panel' | 'compose' | 'inline-edit' | 'completion';
export type ToolPolicy = 'default' | 'none';

export interface SpawnOptions {
  prompt: string;
  cwd: string;
  mode?: ProcessMode;
  toolPolicy?: ToolPolicy;
  additionalFlags?: string[];
}

export interface AgentPreflightResult {
  ok: boolean;
  command: string;
  commandArgsPrefix: string[];
  resolvedBinaryPath: string;
  displayLabel: string;
  issues: string[];
  warnings: string[];
}

export type AgentEventCallback = (event: AgentEvent) => void;
export type AgentErrorCallback = (message: string) => void;
export type AgentExitCallback = (code: number | null) => void;

interface LaunchTarget {
  command: string;
  commandArgsPrefix: string[];
  resolvedBinaryPath: string;
  displayLabel: string;
}

export class ProcessManager {
  private process: ChildProcess | null = null;
  private parser: NDJSONParser | null = null;
  private isRunning = false;
  private currentRunLabel: string | null = null;

  private readonly traceChannel: vscode.OutputChannel;
  private eventCallbacks: AgentEventCallback[] = [];
  private errorCallbacks: AgentErrorCallback[] = [];
  private exitCallbacks: AgentExitCallback[] = [];

  constructor(private readonly outputChannel: vscode.OutputChannel) {
    this.traceChannel = vscode.window.createOutputChannel('EchoCoder: Agent Trace');
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public get healthy(): boolean {
    return !this.isRunning;
  }

  public onEvent(callback: AgentEventCallback): vscode.Disposable {
    this.eventCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.eventCallbacks.splice(idx, 1);
      }
    });
  }

  public onError(callback: AgentErrorCallback): vscode.Disposable {
    this.errorCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.errorCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.errorCallbacks.splice(idx, 1);
      }
    });
  }

  public onExit(callback: AgentExitCallback): vscode.Disposable {
    this.exitCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.exitCallbacks.indexOf(callback);
      if (idx !== -1) {
        this.exitCallbacks.splice(idx, 1);
      }
    });
  }

  public validateEnvironment(options: Pick<SpawnOptions, 'cwd'>, config: EchoCoderConfig = getConfig()): AgentPreflightResult {
    const launchTarget = this.resolveLaunchTarget(config);
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!options.cwd || !fs.existsSync(options.cwd)) {
      issues.push(`Working directory does not exist: ${options.cwd}`);
    }

    if (!config.model || config.model.trim().length === 0) {
      issues.push('No model is configured. Set `echocoder.model` before launching the agent.');
    }

    const providerVars = getProviderEnv(config);
    if (!this.hasProviderCredentials(config, providerVars)) {
      warnings.push(`No ${config.provider} credentials were found in settings or environment variables.`);
    }

    if (!launchTarget.command) {
      issues.push('No OpenClaude binary could be resolved.');
    }

    return {
      ok: issues.length === 0,
      command: launchTarget.command,
      commandArgsPrefix: launchTarget.commandArgsPrefix,
      resolvedBinaryPath: launchTarget.resolvedBinaryPath,
      displayLabel: launchTarget.displayLabel,
      issues,
      warnings,
    };
  }

  public async ensureReady(options: Pick<SpawnOptions, 'cwd'>): Promise<AgentPreflightResult> {
    const result = this.validateEnvironment(options);

    if (!result.ok) {
      const message = `EchoCoder cannot start OpenClaude:\n- ${result.issues.join('\n- ')}`;
      this.outputChannel.appendLine(`[Preflight] ${message.replace(/\n/g, ' ')}`);
      throw new Error(message);
    }

    for (const warning of result.warnings) {
      this.outputChannel.appendLine(`[Preflight] Warning: ${warning}`);
    }

    return result;
  }

  public async spawn(options: SpawnOptions, token?: vscode.CancellationToken): Promise<void> {
    if (this.isRunning) {
      this.abort('superseded by a new run');
    }

    const mode = options.mode || 'chat';
    const toolPolicy = options.toolPolicy || 'default';
    const config = getConfig();
    const preflight = await this.ensureReady({ cwd: options.cwd });
    const args = this.buildArgs(options, preflight);
    const providerEnv = getProviderEnv(config);
    this.currentRunLabel = `${mode}:${toolPolicy}`;

    if (config.agentTraceEnabled) {
      this.traceChannel.clear();
      this.traceChannel.show(true);
      this.traceChannel.appendLine(`[Agent Trace] Starting ${this.currentRunLabel} at ${new Date().toISOString()}`);
      this.traceChannel.appendLine(`[Agent Trace] CMD: ${preflight.command} ${preflight.commandArgsPrefix.join(' ')} ${args.join(' ')}`);
      this.traceChannel.appendLine(`[Agent Trace] CWD: ${options.cwd}`);
    }

    this.outputChannel.appendLine(
      `[Agent] Starting ${this.currentRunLabel} via ${preflight.displayLabel}`
    );

    this.process = spawn(preflight.command, [...preflight.commandArgsPrefix, ...args], {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...providerEnv,
        TERM: 'dumb',
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    if (this.process.stdin) {
      this.process.stdin.setDefaultEncoding('utf-8');
      this.process.stdin.write(options.prompt);
      this.process.stdin.end();
    }

    this.isRunning = true;
    this.parser = new NDJSONParser(
      (event) => this.emitEvent(event),
      (line, error) => {
        this.outputChannel.appendLine(`[Parser] ${error.message}`);
        this.outputChannel.appendLine(`[Parser] Line: ${line.substring(0, 400)}`);
      }
    );

    // Notify listeners that the system has initialized
    this.emitEvent({
      type: 'system',
      subtype: 'init',
      model: config.model,
      cwd: options.cwd,
    });

    this.process.stdout?.setEncoding('utf-8');
    this.process.stdout?.on('data', (chunk: string) => {
      if (config.agentTraceEnabled) {
        this.traceChannel.appendLine(`[stdout] ${chunk}`);
      }
      this.parser?.feed(chunk);
    });

    this.process.stderr?.setEncoding('utf-8');
    this.process.stderr?.on('data', (chunk: string) => {
      if (config.agentTraceEnabled) {
        this.traceChannel.appendLine(`[stderr] ${chunk}`);
      }
      for (const line of chunk.split(/\r?\n/).filter(Boolean)) {
        this.outputChannel.appendLine(`[stderr] ${line}`);
        this.emitError(line);
      }
    });

    const timeoutMs = config.executionTimeout || 60000;
    const timeout = setTimeout(() => {
      if (this.isRunning) {
        this.outputChannel.appendLine(`[Agent] Execution timed out after ${timeoutMs}ms`);
        this.abort('timeout');
      }
    }, timeoutMs);

    this.process.on('exit', (code) => {
      clearTimeout(timeout);
      this.outputChannel.appendLine(`[Agent] ${this.currentRunLabel || 'run'} exited with code ${code}`);
      this.parser?.flush();
      this.cleanupAfterRun();
      this.emitExit(code);
    });

    this.process.on('error', (error) => {
      this.outputChannel.appendLine(`[Agent] Spawn error: ${error.message}`);
      this.emitError(error.message);
      this.cleanupAfterRun();
    });

    if (token) {
      token.onCancellationRequested(() => {
        this.outputChannel.appendLine(`[Agent] Cancellation requested for ${this.currentRunLabel || 'run'}`);
        this.abort('cancelled');
      });
    }
  }

  public abort(reason = 'aborted'): void {
    if (!this.process || !this.isRunning) {
      return;
    }

    this.outputChannel.appendLine(`[Agent] Aborting ${this.currentRunLabel || 'run'} (${reason})`);
    this.process.kill('SIGTERM');

    setTimeout(() => {
      if (this.process && this.isRunning) {
        this.outputChannel.appendLine('[Agent] Force-killing unresponsive child process');
        this.process.kill('SIGKILL');
      }
    }, 3000);
  }

  public dispose(): void {
    this.abort('dispose');
    this.eventCallbacks = [];
    this.errorCallbacks = [];
    this.exitCallbacks = [];
  }

  private buildArgs(options: SpawnOptions, preflight: AgentPreflightResult): string[] {
    const config = getConfig();
    const args: string[] = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--cwd',
      options.cwd,
      '--model',
      config.model,
    ];

    if (options.toolPolicy === 'none') {
      args.push('--tools', '');
    }

    const disallowedTools = this.resolveDisallowedTools(options, config);
    if (disallowedTools.length > 0) {
      args.push('--disallowedTools', disallowedTools.join(','));
      this.outputChannel.appendLine(`[Policy] Disallowed tools: ${disallowedTools.join(', ')}`);
    }

    if (options.additionalFlags?.length) {
      args.push(...options.additionalFlags);
    }

    args.push(options.prompt);
    this.outputChannel.appendLine(`[Preflight] Resolved agent command: ${preflight.command} ${preflight.commandArgsPrefix.join(' ')}`.trim());
    return args;
  }

  private resolveDisallowedTools(options: SpawnOptions, config: EchoCoderConfig): string[] {
    if (options.toolPolicy === 'none') {
      return [];
    }

    const disallowed = new Set<string>();
    const mode = options.mode || 'chat';

    // Keep terminal execution opt-in across chat/panel/compose runs.
    if (!config.terminalAutoRun) {
      disallowed.add('Bash');
      disallowed.add('PowerShell');
    }

    // Network tools are opt-in; keep them disabled unless explicitly enabled.
    if (!config.allowNetworkTools) {
      disallowed.add('WebFetch');
      disallowed.add('WebSearch');
      disallowed.add('Fetch');
      disallowed.add('Curl');
    }

    // Outside compose flows, avoid direct file mutation tools unless explicitly allowed.
    if (!config.autoApproveWrites && mode !== 'compose') {
      disallowed.add('Write');
      disallowed.add('Edit');
    }

    return Array.from(disallowed);
  }

  private resolveLaunchTarget(config: EchoCoderConfig): LaunchTarget {
    const explicit = this.resolveExplicitBinary(config.binaryPath);
    if (explicit) {
      return explicit;
    }

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    const localBin = path.join(workspaceRoot, 'openclaude', 'bin', 'openclaude');
    const localDist = path.join(workspaceRoot, 'openclaude', 'dist', 'cli.mjs');

    if (fs.existsSync(localBin)) {
      return {
        command: process.execPath,
        commandArgsPrefix: [localBin],
        resolvedBinaryPath: localBin,
        displayLabel: 'workspace openclaude/bin/openclaude',
      };
    }

    if (fs.existsSync(localDist)) {
      return {
        command: process.execPath,
        commandArgsPrefix: [localDist],
        resolvedBinaryPath: localDist,
        displayLabel: 'workspace openclaude/dist/cli.mjs',
      };
    }

    const home = process.env.HOME || process.env.USERPROFILE || '';
    const candidates = process.platform === 'win32'
      ? [
          path.join(home, '.bun', 'bin', 'openclaude'),
          path.join(home, '.bun', 'bin', 'claude.exe'),
          path.join(home, 'AppData', 'Roaming', 'npm', 'openclaude.cmd'),
          path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
          'openclaude',
          'claude',
        ]
      : [
          path.join(home, '.bun', 'bin', 'openclaude'),
          path.join(home, '.bun', 'bin', 'claude'),
          '/usr/local/bin/openclaude',
          '/usr/local/bin/claude',
          'openclaude',
          'claude',
        ];

    for (const candidate of candidates) {
      const resolved = this.resolveExplicitBinary(candidate);
      if (resolved) {
        return resolved;
      }
    }

    // Last resort: raw command if it exists in PATH
    try {
      const { execSync } = require('child_process');
      const testCmd = process.platform === 'win32' ? 'where' : 'which';
      execSync(`${testCmd} openclaude`);
      return {
        command: 'openclaude',
        commandArgsPrefix: [],
        resolvedBinaryPath: 'PATH',
        displayLabel: 'openclaude (from PATH)',
      };
    } catch {
      // openclaude not in PATH
    }

    return {
      command: 'openclaude',
      commandArgsPrefix: [],
      resolvedBinaryPath: 'openclaude',
      displayLabel: 'openclaude',
    };
  }

  private resolveExplicitBinary(binaryPath: string): LaunchTarget | null {
    if (!binaryPath || binaryPath.trim().length === 0) {
      return null;
    }

    const trimmed = binaryPath.trim();
    const isJsEntrypoint = trimmed.endsWith('.js') || trimmed.endsWith('.mjs');
    const isExistingFile = this.isExistingFile(trimmed);

    if (isExistingFile && isJsEntrypoint) {
      return {
        command: process.execPath,
        commandArgsPrefix: [trimmed],
        resolvedBinaryPath: trimmed,
        displayLabel: trimmed,
      };
    }

    if (isExistingFile) {
      return {
        command: trimmed,
        commandArgsPrefix: [],
        resolvedBinaryPath: trimmed,
        displayLabel: trimmed,
      };
    }

    if (!trimmed.includes(path.sep)) {
      return {
        command: trimmed,
        commandArgsPrefix: [],
        resolvedBinaryPath: trimmed,
        displayLabel: trimmed,
      };
    }

    return null;
  }

  private isExistingFile(candidate: string): boolean {
    try {
      return fs.existsSync(candidate);
    } catch {
      return false;
    }
  }

  private hasProviderCredentials(config: EchoCoderConfig, providerEnv: Record<string, string>): boolean {
    if (config.provider === 'ollama') {
      return true;
    }

    const keysToCheck = Object.keys(providerEnv).filter((key) => key.endsWith('_API_KEY'));
    return keysToCheck.some((key) => Boolean(providerEnv[key] || process.env[key]));
  }

  private cleanupAfterRun(): void {
    this.isRunning = false;
    this.currentRunLabel = null;
    this.process = null;
    this.parser = null;
  }

  private emitEvent(event: AgentEvent): void {
    for (const cb of this.eventCallbacks) {
      try {
        cb(event);
      } catch {
        // Keep the agent stream alive even if one surface handler fails.
      }
    }
  }

  private emitError(message: string): void {
    for (const cb of this.errorCallbacks) {
      try {
        cb(message);
      } catch {
        // Ignore callback failures.
      }
    }
  }

  private emitExit(code: number | null): void {
    for (const cb of this.exitCallbacks) {
      try {
        cb(code);
      } catch {
        // Ignore callback failures.
      }
    }
  }
}

/**
 * ProcessManager — OpenClaude Child Process Lifecycle Manager
 * 
 * Manages spawning, communication with, and teardown of the OpenClaude
 * binary via Node.js child_process.spawn. Uses stdio streaming (not
 * network) for maximum security and zero-latency IPC per the blueprint.
 * 
 * Key responsibilities:
 * - Spawn CLI in headless print mode (-p --output-format stream-json)
 * - Inject provider env vars (OPENAI_API_KEY, OPENAI_MODEL, etc.)
 * - Route stdout through NDJSONParser
 * - Capture stderr to VS Code OutputChannel
 * - Support cancellation via CancellationToken
 * - Enforce singleton pattern (one active session at a time)
 */

import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { NDJSONParser } from './NDJSONParser';
import { AgentEvent } from '../types/agent-events';
import { getConfig, getProviderEnv } from '../types/config';

export interface SpawnOptions {
  prompt: string;
  cwd: string;
  additionalContext?: string;
  additionalFlags?: string[];
}

export type AgentEventCallback = (event: AgentEvent) => void;
export type AgentErrorCallback = (message: string) => void;
export type AgentExitCallback = (code: number | null) => void;

export class ProcessManager {
  private process: ChildProcess | null = null;
  private parser: NDJSONParser | null = null;
  private outputChannel: vscode.OutputChannel;
  private isRunning: boolean = false;

  // Event callbacks
  private eventCallbacks: AgentEventCallback[] = [];
  private errorCallbacks: AgentErrorCallback[] = [];
  private exitCallbacks: AgentExitCallback[] = [];

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  /**
   * Whether the agent process is currently running.
   */
  public get running(): boolean {
    return this.isRunning;
  }

  /**
   * Register a callback for parsed NDJSON events.
   */
  public onEvent(callback: AgentEventCallback): vscode.Disposable {
    this.eventCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.eventCallbacks.indexOf(callback);
      if (idx !== -1) { this.eventCallbacks.splice(idx, 1); }
    });
  }

  /**
   * Register a callback for stderr error messages.
   */
  public onError(callback: AgentErrorCallback): vscode.Disposable {
    this.errorCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.errorCallbacks.indexOf(callback);
      if (idx !== -1) { this.errorCallbacks.splice(idx, 1); }
    });
  }

  /**
   * Register a callback for process exit.
   */
  public onExit(callback: AgentExitCallback): vscode.Disposable {
    this.exitCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.exitCallbacks.indexOf(callback);
      if (idx !== -1) { this.exitCallbacks.splice(idx, 1); }
    });
  }

  /**
   * Resolve the OpenClaude binary path.
   * Priority: user setting > auto-detect common locations.
   */
  private resolveBinaryPath(): string {
    const config = getConfig();

    if (config.binaryPath) {
      return config.binaryPath;
    }

    // Auto-detection: check common install locations
    const isWindows = process.platform === 'win32';
    const home = process.env.HOME || process.env.USERPROFILE || '';

    const candidates = isWindows
      ? [
          path.join(home, '.bun', 'bin', 'claude.exe'),
          path.join(home, '.bun', 'bin', 'claude'),
          path.join(home, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
          path.join(home, 'AppData', 'Roaming', 'npm', 'claude'),
          'claude', // Rely on PATH
        ]
      : [
          path.join(home, '.bun', 'bin', 'claude'),
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          path.join(home, '.npm-global', 'bin', 'claude'),
          'claude', // Rely on PATH
        ];

    // For now, return the last candidate (PATH-based) as default
    // Full auto-detection with fs.existsSync would be done in a production build
    return candidates[candidates.length - 1];
  }

  /**
   * Spawn the OpenClaude child process with the given prompt.
   */
  public async spawn(options: SpawnOptions, token?: vscode.CancellationToken): Promise<void> {
    // Enforce singleton — abort any running process
    if (this.isRunning) {
      this.abort();
    }

    const config = getConfig();
    const binaryPath = this.resolveBinaryPath();
    const providerEnv = getProviderEnv(config);

    // Build CLI arguments per the phase1 blueprint:
    // claude -p --output-format stream-json --verbose
    const args: string[] = [
      '-p',                                    // Print mode (headless)
      '--output-format', 'stream-json',        // NDJSON streaming output
      '--verbose',                             // Include all intermediate states
      '--cwd', options.cwd,                    // Working directory
    ];

    // Append additional flags if provided
    if (options.additionalFlags) {
      args.push(...options.additionalFlags);
    }

    // Append the prompt as the final positional argument
    args.push(options.prompt);

    this.outputChannel.appendLine(`[EchoCoder] Spawning: ${binaryPath} ${args.join(' ')}`);
    this.outputChannel.appendLine(`[EchoCoder] CWD: ${options.cwd}`);
    this.outputChannel.appendLine(`[EchoCoder] Model: ${config.model}`);

    // Spawn the child process
    this.process = spawn(binaryPath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...providerEnv,
        // Force non-interactive mode
        TERM: 'dumb',
        NO_COLOR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      // Critical: prevent console window flashing on Windows
      windowsHide: true,
    });

    this.isRunning = true;

    // Initialize the NDJSON parser
    this.parser = new NDJSONParser(
      (event) => this.emitEvent(event),
      (line, error) => {
        this.outputChannel.appendLine(`[EchoCoder] Parse warning: ${error.message} — Line: ${line.substring(0, 200)}`);
      }
    );

    // Route stdout through the parser
    this.process.stdout?.setEncoding('utf-8');
    this.process.stdout?.on('data', (chunk: string) => {
      this.parser?.feed(chunk);
    });

    // Capture stderr → Output Channel
    this.process.stderr?.setEncoding('utf-8');
    this.process.stderr?.on('data', (chunk: string) => {
      this.outputChannel.appendLine(`[stderr] ${chunk.trim()}`);
      this.emitError(chunk.trim());
    });

    // Handle process exit
    this.process.on('exit', (code) => {
      this.outputChannel.appendLine(`[EchoCoder] Process exited with code: ${code}`);
      this.parser?.flush();  // Parse any remaining buffer
      this.isRunning = false;
      this.process = null;
      this.parser = null;
      this.emitExit(code);
    });

    this.process.on('error', (err) => {
      this.outputChannel.appendLine(`[EchoCoder] Process error: ${err.message}`);
      this.emitError(`Process spawn error: ${err.message}`);
      this.isRunning = false;
      this.process = null;
    });

    // Wire up cancellation token
    if (token) {
      token.onCancellationRequested(() => {
        this.outputChannel.appendLine('[EchoCoder] Cancellation requested — aborting process');
        this.abort();
      });
    }

    // If additional context needs to be passed via stdin
    if (options.additionalContext && this.process.stdin) {
      this.process.stdin.write(options.additionalContext);
      this.process.stdin.end();  // CRITICAL: close stdin to prevent hanging
    }
  }

  /**
   * Abort the running process.
   */
  public abort(): void {
    if (this.process && this.isRunning) {
      this.outputChannel.appendLine('[EchoCoder] Aborting agent process');
      this.process.kill('SIGTERM');

      // Force kill after 3 seconds if still running
      setTimeout(() => {
        if (this.process && this.isRunning) {
          this.process.kill('SIGKILL');
          this.isRunning = false;
          this.process = null;
        }
      }, 3000);
    }
  }

  /**
   * Send additional input to the running process stdin.
   * Used for interactive stream-json mode.
   */
  public sendInput(data: string): void {
    if (this.process?.stdin && this.isRunning) {
      this.process.stdin.write(data + '\n');
    }
  }

  // ─── Internal Event Emitters ────────────────────────────────────
  private emitEvent(event: AgentEvent): void {
    for (const cb of this.eventCallbacks) {
      try { cb(event); } catch (e) { /* swallow callback errors */ }
    }
  }

  private emitError(message: string): void {
    for (const cb of this.errorCallbacks) {
      try { cb(message); } catch (e) { /* swallow */ }
    }
  }

  private emitExit(code: number | null): void {
    for (const cb of this.exitCallbacks) {
      try { cb(code); } catch (e) { /* swallow */ }
    }
  }

  /**
   * Dispose all resources.
   */
  public dispose(): void {
    this.abort();
    this.eventCallbacks = [];
    this.errorCallbacks = [];
    this.exitCallbacks = [];
  }
}

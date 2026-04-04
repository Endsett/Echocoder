import * as vscode from 'vscode';
import { ProcessManager } from './ProcessManager';
import { SessionManager } from './SessionManager';
import { EchoCoderConfig } from '../types/config';

export type AgentRole = 'supervisor' | 'plan' | 'code' | 'test' | 'mr' | 'debug';

export interface AgentContext {
  role: AgentRole;
  sessionId: string;
  workspacePath: string;
}

/**
 * Supervisor Agent
 * 
 * The central orchestrator for the Agentic CI/CD ecosystem.
 * Responsible for delegating tasks, managing shared memory, 
 * and supervising specialized sub-agents.
 */
export class Supervisor {
  private readonly processManager: ProcessManager;
  private readonly sessionManager: SessionManager;
  private readonly traceChannel: vscode.OutputChannel;

  constructor(
    processManager: ProcessManager,
    sessionManager: SessionManager,
    outputChannel: vscode.OutputChannel
  ) {
    this.processManager = processManager;
    this.sessionManager = sessionManager;
    this.traceChannel = vscode.window.createOutputChannel('EchoCoder: Multi-Agent Trace');
  }

  /**
   * Dispatches a goal to the agent graph.
   * Currently implements a simple pass-through to the CodeAgent (ProcessManager).
   */
  public async dispatch(goal: string, config: EchoCoderConfig): Promise<void> {
    this.log(`[Supervisor] New Goal: ${goal}`);
    
    // In a full implementation, this would involve LangGraph or a state machine.
    // For now, we delegate directly to the ProcessManager.
    
    const context: AgentContext = {
      role: 'supervisor',
      sessionId: this.sessionManager.getActiveSession()?.id || 'new-session',
      workspacePath: vscode.workspace.workspaceFolders?.[0].uri.fsPath || '',
    };

    this.log(`[Supervisor] Dispatching to CodeAgent...`);
    
    await this.processManager.spawn({
      prompt: goal,
      cwd: context.workspacePath,
      mode: 'agentic',
      toolPolicy: 'auto'
    } as any);
  }

  private log(message: string): void {
    this.traceChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
  }
}

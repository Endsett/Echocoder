/**
 * StatusBarManager — Persistent Status Bar Items
 * 
 * Displays agent status, active model, and token budget in the
 * VS Code status bar. Provides real-time feedback on agent activity.
 */

import * as vscode from 'vscode';
import { EventRouter } from '../core/EventRouter';
import { ProcessManager } from '../core/ProcessManager';
import { getConfig } from '../types/config';

export class StatusBarManager {
  private statusItem: vscode.StatusBarItem;
  private tokenItem: vscode.StatusBarItem;
  private modelItem: vscode.StatusBarItem;

  constructor(
    private eventRouter: EventRouter,
    private processManager: ProcessManager
  ) {
    // Left side: Agent status
    this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusItem.command = 'echocoder.openPanel';
    this.setIdle();
    this.statusItem.show();

    // Right side: Model name
    this.modelItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 101);
    this.updateModel();
    this.modelItem.show();

    // Right side: Token counter
    this.tokenItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.tokenItem.command = 'echocoder.compact';
    this.tokenItem.tooltip = 'Click to compact context';
    this.tokenItem.hide(); // Hidden until first usage event

    this.wireEvents();
  }

  private wireEvents(): void {
    this.eventRouter.onInit(() => {
      this.setWorking('Initializing...');
    });

    this.eventRouter.onTextDelta(() => {
      this.setWorking('Generating...');
    });

    this.eventRouter.onToolCall((event) => {
      this.setWorking(`Running ${event.tool}...`);
    });

    this.eventRouter.onUsage((event) => {
      const total = event.usage.input_tokens + event.usage.output_tokens;
      this.updateTokens(total);
    });

    this.eventRouter.onSuccess(() => {
      this.setIdle();
    });

    this.eventRouter.onError(() => {
      this.setError();
    });

    // Listen for config changes
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('echocoder.model') || e.affectsConfiguration('echocoder.provider')) {
        this.updateModel();
      }
    });
  }

  private setIdle(): void {
    this.statusItem.text = '$(hubot) EchoCoder';
    this.statusItem.tooltip = 'EchoCoder AI — Ready';
    this.statusItem.backgroundColor = undefined;
  }

  private setWorking(detail: string): void {
    this.statusItem.text = `$(sync~spin) EchoCoder: ${detail}`;
    this.statusItem.tooltip = 'EchoCoder AI — Working...';
  }

  private setError(): void {
    this.statusItem.text = '$(error) EchoCoder: Error';
    this.statusItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    setTimeout(() => this.setIdle(), 5000);
  }

  private updateModel(): void {
    const config = getConfig();
    const shortModel = config.model.split('/').pop()?.substring(0, 20) || config.model;
    this.modelItem.text = `$(symbol-misc) ${shortModel}`;
    this.modelItem.tooltip = `EchoCoder Model: ${config.model} (${config.provider})`;
  }

  private updateTokens(total: number): void {
    this.tokenItem.show();
    const config = getConfig();
    const formatted = total.toLocaleString();

    // Color coding based on budget threshold
    const threshold = config.maxTokenBudget;
    // Estimate max tokens (varies by model, use 200k as baseline)
    const estimatedMax = 200000;
    const percentage = (total / estimatedMax) * 100;

    if (percentage > threshold) {
      this.tokenItem.text = `$(warning) ${formatted} tokens`;
      this.tokenItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else if (percentage > 60) {
      this.tokenItem.text = `$(dashboard) ${formatted} tokens`;
      this.tokenItem.backgroundColor = undefined;
    } else {
      this.tokenItem.text = `$(dashboard) ${formatted} tokens`;
      this.tokenItem.backgroundColor = undefined;
    }
  }

  public dispose(): void {
    this.statusItem.dispose();
    this.tokenItem.dispose();
    this.modelItem.dispose();
  }
}

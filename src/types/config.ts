/**
 * EchoCoder Configuration Types
 * 
 * Type-safe interface mirroring the contributes.configuration
 * settings defined in package.json.
 */

import * as vscode from 'vscode';

export type ProviderType = 'anthropic' | 'openai' | 'deepseek' | 'ollama' | 'custom';

export interface EchoCoderConfig {
  binaryPath: string;
  provider: ProviderType;
  apiKey: string;
  apiBaseUrl: string;
  model: string;
  maxTokenBudget: number;
  autoApproveReads: boolean;
  autoApproveWrites: boolean;
  terminalAutoRun: boolean;
  allowNetworkTools: boolean;
  ghostTextEnabled: boolean;
  ghostTextDebounceMs: number;
  contextFiles: number;
}

/**
 * Reads the current EchoCoder configuration from VS Code settings.
 * Always returns fresh values (no caching — config changes are immediate).
 */
export function getConfig(): EchoCoderConfig {
  const cfg = vscode.workspace.getConfiguration('echocoder');

  return {
    binaryPath: cfg.get<string>('binaryPath', ''),
    provider: cfg.get<ProviderType>('provider', 'anthropic'),
    apiKey: cfg.get<string>('apiKey', ''),
    apiBaseUrl: cfg.get<string>('apiBaseUrl', ''),
    model: cfg.get<string>('model', 'claude-sonnet-4-20250514'),
    maxTokenBudget: cfg.get<number>('maxTokenBudget', 85),
    autoApproveReads: cfg.get<boolean>('autoApproveReads', true),
    autoApproveWrites: cfg.get<boolean>('autoApproveWrites', false),
    terminalAutoRun: cfg.get<boolean>('terminalAutoRun', false),
    allowNetworkTools: cfg.get<boolean>('allowNetworkTools', false),
    ghostTextEnabled: cfg.get<boolean>('ghostText.enabled', true),
    ghostTextDebounceMs: cfg.get<number>('ghostText.debounceMs', 300),
    contextFiles: cfg.get<number>('contextFiles', 10),
  };
}

/**
 * Resolves the environment variables to inject into the OpenClaude
 * child process based on the current provider configuration.
 */
export function getProviderEnv(config: EchoCoderConfig): Record<string, string> {
  const env: Record<string, string> = {};

  switch (config.provider) {
    case 'anthropic':
      if (config.apiKey) { env['ANTHROPIC_API_KEY'] = config.apiKey; }
      env['ANTHROPIC_MODEL'] = config.model;
      break;

    case 'openai':
      if (config.apiKey) { env['OPENAI_API_KEY'] = config.apiKey; }
      env['OPENAI_MODEL'] = config.model;
      if (config.apiBaseUrl) { env['OPENAI_BASE_URL'] = config.apiBaseUrl; }
      break;

    case 'deepseek':
      if (config.apiKey) { env['OPENAI_API_KEY'] = config.apiKey; }
      env['OPENAI_MODEL'] = config.model;
      env['OPENAI_BASE_URL'] = config.apiBaseUrl || 'https://api.deepseek.com/v1';
      break;

    case 'ollama':
      env['OPENAI_API_KEY'] = 'ollama';
      env['OPENAI_MODEL'] = config.model;
      env['OPENAI_BASE_URL'] = config.apiBaseUrl || 'http://localhost:11434/v1';
      break;

    case 'custom':
      if (config.apiKey) { env['OPENAI_API_KEY'] = config.apiKey; }
      env['OPENAI_MODEL'] = config.model;
      if (config.apiBaseUrl) { env['OPENAI_BASE_URL'] = config.apiBaseUrl; }
      break;
  }

  return env;
}

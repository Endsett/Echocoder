/**
 * SandboxDetector — Environment Detection for Adaptive Security
 * 
 * Detects isolated environments (Dev Containers, WSL2, Codespaces)
 * and adjusts the default security posture accordingly.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';

export type EnvironmentType = 'local' | 'devcontainer' | 'wsl' | 'codespaces' | 'gitpod' | 'remote-ssh';

export class SandboxDetector {
  /**
   * Detect the current execution environment.
   */
  public detect(): EnvironmentType {
    // GitHub Codespaces
    if (process.env.CODESPACES === 'true' || process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
      return 'codespaces';
    }

    // GitPod
    if (process.env.GITPOD_WORKSPACE_ID) {
      return 'gitpod';
    }

    // Dev Container
    if (process.env.REMOTE_CONTAINERS === 'true' ||
        fs.existsSync('/.dockerenv') ||
        process.env.REMOTE_CONTAINERS_IPC) {
      return 'devcontainer';
    }

    // WSL
    if (process.platform === 'linux' && (
      process.env.WSL_DISTRO_NAME ||
      process.env.WSLENV ||
      fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft')
    )) {
      return 'wsl';
    }

    // Remote SSH
    if (vscode.env.remoteName === 'ssh-remote') {
      return 'remote-ssh';
    }

    return 'local';
  }

  /**
   * Whether the environment is considered isolated (safe for higher autonomy).
   */
  public isIsolated(): boolean {
    const env = this.detect();
    return ['devcontainer', 'codespaces', 'gitpod'].includes(env);
  }

  /**
   * Get a human-readable description of the environment.
   */
  public getDescription(): string {
    const descriptions: Record<EnvironmentType, string> = {
      local: '💻 Local Machine',
      devcontainer: '📦 Dev Container (Isolated)',
      wsl: '🐧 WSL2',
      codespaces: '☁️ GitHub Codespaces (Isolated)',
      gitpod: '☁️ GitPod (Isolated)',
      'remote-ssh': '🔗 Remote SSH',
    };
    return descriptions[this.detect()];
  }
}

"use strict";
/**
 * SandboxDetector — Environment Detection for Adaptive Security
 *
 * Detects isolated environments (Dev Containers, WSL2, Codespaces)
 * and adjusts the default security posture accordingly.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxDetector = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
class SandboxDetector {
    /**
     * Detect the current execution environment.
     */
    detect() {
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
        if (process.platform === 'linux' && (process.env.WSL_DISTRO_NAME ||
            process.env.WSLENV ||
            fs.existsSync('/proc/version') && fs.readFileSync('/proc/version', 'utf-8').toLowerCase().includes('microsoft'))) {
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
    isIsolated() {
        const env = this.detect();
        return ['devcontainer', 'codespaces', 'gitpod'].includes(env);
    }
    /**
     * Get a human-readable description of the environment.
     */
    getDescription() {
        const descriptions = {
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
exports.SandboxDetector = SandboxDetector;

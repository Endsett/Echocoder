"use strict";
/**
 * WorkspaceIndexer — Deep Workspace Context Awareness
 *
 * Reads workspace folders, detects project type, discovers CLAUDE.md
 * files, and provides structural context for the agent.
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
exports.WorkspaceIndexer = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class WorkspaceIndexer {
    /**
     * Analyze the current workspace and return structured context.
     */
    async analyze() {
        const folders = (vscode.workspace.workspaceFolders || []).map(f => f.uri.fsPath);
        const primaryFolder = folders[0] || process.cwd();
        const projectType = await this.detectProjectType(primaryFolder);
        const language = await this.detectLanguage(primaryFolder);
        const packageManager = await this.detectPackageManager(primaryFolder);
        const claudeMdContents = await this.findClaudeMdFiles(primaryFolder);
        const hasGit = fs.existsSync(path.join(primaryFolder, '.git'));
        return {
            folders,
            primaryFolder,
            projectType,
            language,
            packageManager,
            claudeMdContents,
            hasGit,
        };
    }
    async detectProjectType(root) {
        if (fs.existsSync(path.join(root, 'package.json'))) {
            try {
                const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
                if (pkg.dependencies?.next || pkg.devDependencies?.next) {
                    return 'Next.js';
                }
                if (pkg.dependencies?.react || pkg.devDependencies?.react) {
                    return 'React';
                }
                if (pkg.dependencies?.vue || pkg.devDependencies?.vue) {
                    return 'Vue';
                }
                if (pkg.dependencies?.express) {
                    return 'Express';
                }
                return 'Node.js';
            }
            catch {
                return 'Node.js';
            }
        }
        if (fs.existsSync(path.join(root, 'pyproject.toml')) || fs.existsSync(path.join(root, 'requirements.txt'))) {
            return 'Python';
        }
        if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
            return 'Rust';
        }
        if (fs.existsSync(path.join(root, 'go.mod'))) {
            return 'Go';
        }
        if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) {
            return 'Java';
        }
        if (fs.existsSync(path.join(root, 'pubspec.yaml'))) {
            return 'Flutter';
        }
        return 'Unknown';
    }
    async detectLanguage(root) {
        if (fs.existsSync(path.join(root, 'tsconfig.json'))) {
            return 'TypeScript';
        }
        if (fs.existsSync(path.join(root, 'package.json'))) {
            return 'JavaScript';
        }
        if (fs.existsSync(path.join(root, 'pyproject.toml'))) {
            return 'Python';
        }
        if (fs.existsSync(path.join(root, 'Cargo.toml'))) {
            return 'Rust';
        }
        if (fs.existsSync(path.join(root, 'go.mod'))) {
            return 'Go';
        }
        return 'Unknown';
    }
    async detectPackageManager(root) {
        if (fs.existsSync(path.join(root, 'bun.lock')) || fs.existsSync(path.join(root, 'bun.lockb'))) {
            return 'bun';
        }
        if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
            return 'pnpm';
        }
        if (fs.existsSync(path.join(root, 'yarn.lock'))) {
            return 'yarn';
        }
        if (fs.existsSync(path.join(root, 'package-lock.json'))) {
            return 'npm';
        }
        return 'unknown';
    }
    async findClaudeMdFiles(root) {
        const contents = [];
        const candidates = [
            path.join(root, 'CLAUDE.md'),
            path.join(root, '.claude', 'CLAUDE.md'),
        ];
        // Also check user home
        const home = process.env.HOME || process.env.USERPROFILE || '';
        if (home) {
            candidates.push(path.join(home, '.claude', 'CLAUDE.md'));
        }
        for (const candidate of candidates) {
            try {
                if (fs.existsSync(candidate)) {
                    contents.push(fs.readFileSync(candidate, 'utf-8'));
                }
            }
            catch { /* skip */ }
        }
        return contents;
    }
}
exports.WorkspaceIndexer = WorkspaceIndexer;

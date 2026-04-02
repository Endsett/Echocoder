/**
 * WorkspaceIndexer — Deep Workspace Context Awareness
 * 
 * Reads workspace folders, detects project type, discovers CLAUDE.md
 * files, and provides structural context for the agent.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export interface WorkspaceInfo {
  folders: string[];
  primaryFolder: string;
  projectType: string;
  language: string;
  packageManager: string;
  claudeMdContents: string[];
  hasGit: boolean;
}

export class WorkspaceIndexer {
  /**
   * Analyze the current workspace and return structured context.
   */
  public async analyze(): Promise<WorkspaceInfo> {
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

  private async detectProjectType(root: string): Promise<string> {
    if (fs.existsSync(path.join(root, 'package.json'))) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
        if (pkg.dependencies?.next || pkg.devDependencies?.next) { return 'Next.js'; }
        if (pkg.dependencies?.react || pkg.devDependencies?.react) { return 'React'; }
        if (pkg.dependencies?.vue || pkg.devDependencies?.vue) { return 'Vue'; }
        if (pkg.dependencies?.express) { return 'Express'; }
        return 'Node.js';
      } catch { return 'Node.js'; }
    }
    if (fs.existsSync(path.join(root, 'pyproject.toml')) || fs.existsSync(path.join(root, 'requirements.txt'))) { return 'Python'; }
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) { return 'Rust'; }
    if (fs.existsSync(path.join(root, 'go.mod'))) { return 'Go'; }
    if (fs.existsSync(path.join(root, 'pom.xml')) || fs.existsSync(path.join(root, 'build.gradle'))) { return 'Java'; }
    if (fs.existsSync(path.join(root, 'pubspec.yaml'))) { return 'Flutter'; }
    return 'Unknown';
  }

  private async detectLanguage(root: string): Promise<string> {
    if (fs.existsSync(path.join(root, 'tsconfig.json'))) { return 'TypeScript'; }
    if (fs.existsSync(path.join(root, 'package.json'))) { return 'JavaScript'; }
    if (fs.existsSync(path.join(root, 'pyproject.toml'))) { return 'Python'; }
    if (fs.existsSync(path.join(root, 'Cargo.toml'))) { return 'Rust'; }
    if (fs.existsSync(path.join(root, 'go.mod'))) { return 'Go'; }
    return 'Unknown';
  }

  private async detectPackageManager(root: string): Promise<string> {
    if (fs.existsSync(path.join(root, 'bun.lock')) || fs.existsSync(path.join(root, 'bun.lockb'))) { return 'bun'; }
    if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) { return 'pnpm'; }
    if (fs.existsSync(path.join(root, 'yarn.lock'))) { return 'yarn'; }
    if (fs.existsSync(path.join(root, 'package-lock.json'))) { return 'npm'; }
    return 'unknown';
  }

  private async findClaudeMdFiles(root: string): Promise<string[]> {
    const contents: string[] = [];
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
      } catch { /* skip */ }
    }

    return contents;
  }
}

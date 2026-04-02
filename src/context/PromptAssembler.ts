/**
 * PromptAssembler
 *
 * Produces reusable prompt bundles so chat, panel, inline edit, and
 * composer share the same workspace/editor/diagnostic context shape.
 */

import * as vscode from 'vscode';
import { WorkspaceIndexer, WorkspaceInfo } from './WorkspaceIndexer';
import { EditorContext } from './EditorContext';
import { DiagnosticsEngine } from './DiagnosticsEngine';

export interface PromptContextBundle {
  cwd: string;
  workspace: WorkspaceInfo;
  editor: string;
  diagnostics: string;
}

export class PromptAssembler {
  private readonly workspaceIndexer = new WorkspaceIndexer();
  private readonly editorContext = new EditorContext();
  private readonly diagnosticsEngine = new DiagnosticsEngine();

  public async buildContextBundle(): Promise<PromptContextBundle> {
    const workspace = await this.workspaceIndexer.analyze();
    return {
      cwd: workspace.primaryFolder,
      workspace,
      editor: this.editorContext.formatForPrompt(),
      diagnostics: this.diagnosticsEngine.getSummary().formatted,
    };
  }

  public async assembleChatPrompt(userPrompt: string): Promise<{ prompt: string; cwd: string }> {
    const bundle = await this.buildContextBundle();
    return {
      prompt: this.renderPrompt(bundle, userPrompt),
      cwd: bundle.cwd,
    };
  }

  public async assemble(userPrompt: string): Promise<string> {
    const { prompt } = await this.assembleChatPrompt(userPrompt);
    return prompt;
  }

  public getCwd(): string {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
  }

  private renderPrompt(bundle: PromptContextBundle, userPrompt: string): string {
    const sections: string[] = [];
    const workspace = bundle.workspace;

    sections.push('<context:workspace>');
    sections.push(`Primary workspace: ${workspace.primaryFolder}`);
    sections.push(`Workspace roots: ${workspace.folders.join(', ') || workspace.primaryFolder}`);
    sections.push(`Project type: ${workspace.projectType}`);
    sections.push(`Primary language: ${workspace.language}`);
    sections.push(`Package manager: ${workspace.packageManager}`);
    sections.push(`Git repository: ${workspace.hasGit ? 'yes' : 'no'}`);
    sections.push('</context:workspace>');

    if (workspace.claudeMdContents.length > 0) {
      sections.push('<context:instructions>');
      sections.push(workspace.claudeMdContents.join('\n---\n'));
      sections.push('</context:instructions>');
    }

    if (bundle.editor) {
      sections.push('<context:editor>');
      sections.push(bundle.editor);
      sections.push('</context:editor>');
    }

    if (bundle.diagnostics) {
      sections.push('<context:diagnostics>');
      sections.push(bundle.diagnostics);
      sections.push('</context:diagnostics>');
    }

    sections.push('<request>');
    sections.push(userPrompt);
    sections.push('</request>');

    return sections.join('\n');
  }
}

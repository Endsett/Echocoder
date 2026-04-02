/**
 * PromptAssembler — Final Prompt Composition
 * 
 * Composes the full prompt payload from all context providers:
 * workspace info, editor state, diagnostics, CLAUDE.md content.
 * Uses XML-tagged sections for reliable model parsing.
 */

import { WorkspaceIndexer, WorkspaceInfo } from './WorkspaceIndexer';
import { EditorContext } from './EditorContext';
import { DiagnosticsEngine } from './DiagnosticsEngine';

export class PromptAssembler {
  private workspaceIndexer: WorkspaceIndexer;
  private editorContext: EditorContext;
  private diagnosticsEngine: DiagnosticsEngine;

  constructor() {
    this.workspaceIndexer = new WorkspaceIndexer();
    this.editorContext = new EditorContext();
    this.diagnosticsEngine = new DiagnosticsEngine();
  }

  /**
   * Assemble the full prompt with injected context.
   */
  public async assemble(userPrompt: string): Promise<string> {
    const workspace = await this.workspaceIndexer.analyze();
    const editorState = this.editorContext.formatForPrompt();
    const diagnostics = this.diagnosticsEngine.getSummary();

    const sections: string[] = [];

    // Workspace context
    sections.push('<context:workspace>');
    sections.push(`Project: ${workspace.projectType} (${workspace.language})`);
    sections.push(`Package Manager: ${workspace.packageManager}`);
    sections.push(`Workspace Folders: ${workspace.folders.join(', ')}`);
    sections.push(`Git: ${workspace.hasGit ? 'Yes' : 'No'}`);
    sections.push('</context:workspace>');

    // CLAUDE.md instructions
    if (workspace.claudeMdContents.length > 0) {
      sections.push('<context:instructions>');
      sections.push(workspace.claudeMdContents.join('\n---\n'));
      sections.push('</context:instructions>');
    }

    // Editor state
    if (editorState) {
      sections.push('<context:editor>');
      sections.push(editorState);
      sections.push('</context:editor>');
    }

    // Diagnostics (only if errors exist)
    if (diagnostics.totalErrors > 0 || diagnostics.totalWarnings > 0) {
      sections.push('<context:diagnostics>');
      sections.push(diagnostics.formatted);
      sections.push('</context:diagnostics>');
    }

    // User prompt
    sections.push('');
    sections.push(userPrompt);

    return sections.join('\n');
  }

  /**
   * Get just the workspace CWD for the process.
   */
  public getCwd(): string {
    const folders = require('vscode').workspace.workspaceFolders;
    return folders?.[0]?.uri.fsPath || process.cwd();
  }
}

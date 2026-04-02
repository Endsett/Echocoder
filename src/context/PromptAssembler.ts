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

export interface InlineEditPromptInput {
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  instruction: string;
  beforeContext: string;
  selectedText: string;
  afterContext: string;
}

export interface CompletionPromptInput {
  filePath: string;
  language: string;
  prefix: string;
  suffix: string;
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

  public async assembleInlineEditPrompt(input: InlineEditPromptInput): Promise<{ prompt: string; cwd: string }> {
    const bundle = await this.buildContextBundle();
    const sections = this.renderSharedContextSections(bundle);

    sections.push('<task:inline-edit>');
    sections.push('Return ONLY the replacement code for the selected block.');
    sections.push('No markdown fences, no prose, no explanation.');
    sections.push('</task:inline-edit>');
    sections.push('<selection>');
    sections.push(`File: ${input.filePath}`);
    sections.push(`Language: ${input.language}`);
    sections.push(`Lines: ${input.startLine}-${input.endLine}`);
    sections.push(`Instruction: ${input.instruction}`);
    sections.push('</selection>');
    sections.push('<context:before-selection>');
    sections.push(input.beforeContext);
    sections.push('</context:before-selection>');
    sections.push('<context:selected-code>');
    sections.push(input.selectedText);
    sections.push('</context:selected-code>');
    sections.push('<context:after-selection>');
    sections.push(input.afterContext);
    sections.push('</context:after-selection>');
    sections.push('<response-format>');
    sections.push('Raw replacement code only.');
    sections.push('</response-format>');

    return {
      prompt: sections.join('\n'),
      cwd: bundle.cwd,
    };
  }

  public assembleCompletionPrompt(input: CompletionPromptInput): { prompt: string; cwd: string } {
    const sections: string[] = [];
    const editor = this.editorContext.formatForPrompt();

    if (editor) {
      sections.push('<context:editor>');
      sections.push(editor);
      sections.push('</context:editor>');
    }

    sections.push('<task:completion>');
    sections.push('Continue the code from the cursor position.');
    sections.push('Return ONLY code continuation. No markdown or explanations.');
    sections.push('</task:completion>');
    sections.push('<file>');
    sections.push(`Path: ${input.filePath}`);
    sections.push(`Language: ${input.language}`);
    sections.push('</file>');
    sections.push('<code:before-cursor>');
    sections.push(input.prefix);
    sections.push('</code:before-cursor>');
    sections.push('<code:after-cursor>');
    sections.push(input.suffix);
    sections.push('</code:after-cursor>');

    return {
      prompt: sections.join('\n'),
      cwd: this.getCwd(),
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
    const sections: string[] = this.renderSharedContextSections(bundle);
    sections.push('<request>');
    sections.push(userPrompt);
    sections.push('</request>');

    return sections.join('\n');
  }

  private renderSharedContextSections(bundle: PromptContextBundle): string[] {
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

    return sections;
  }
}

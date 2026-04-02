/**
 * EditorContext — Active Editor State Extraction
 * 
 * Captures the current editor state for agent context injection:
 * active file, selection, open tabs, cursor position.
 */

import * as vscode from 'vscode';

export interface EditorState {
  activeFile: string | null;
  activeLanguage: string | null;
  selectedText: string | null;
  selectedRange: { startLine: number; endLine: number } | null;
  cursorLine: number | null;
  openFiles: string[];
}

export class EditorContext {
  /**
   * Extract the current editor state.
   */
  public getState(): EditorState {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
      return {
        activeFile: null,
        activeLanguage: null,
        selectedText: null,
        selectedRange: null,
        cursorLine: null,
        openFiles: this.getOpenFiles(),
      };
    }

    const selection = editor.selection;
    const selectedText = selection.isEmpty ? null : editor.document.getText(selection);
    const selectedRange = selection.isEmpty ? null : {
      startLine: selection.start.line + 1,
      endLine: selection.end.line + 1,
    };

    return {
      activeFile: editor.document.fileName,
      activeLanguage: editor.document.languageId,
      selectedText,
      selectedRange,
      cursorLine: editor.selection.active.line + 1,
      openFiles: this.getOpenFiles(),
    };
  }

  /**
   * Get all currently open file paths.
   */
  private getOpenFiles(): string[] {
    return vscode.window.tabGroups.all
      .flatMap(group => group.tabs)
      .map(tab => {
        const input = tab.input;
        if (input && typeof input === 'object' && 'uri' in input) {
          return (input as { uri: vscode.Uri }).uri.fsPath;
        }
        return null;
      })
      .filter((f): f is string => f !== null);
  }

  /**
   * Format editor state as context string for the agent prompt.
   */
  public formatForPrompt(): string {
    const state = this.getState();
    const parts: string[] = [];

    if (state.activeFile) {
      parts.push(`Active file: ${state.activeFile} (${state.activeLanguage})`);
      if (state.cursorLine) {
        parts.push(`Cursor at line: ${state.cursorLine}`);
      }
    }

    if (state.selectedText && state.selectedRange) {
      parts.push(`Selected text (lines ${state.selectedRange.startLine}-${state.selectedRange.endLine}):`);
      parts.push(state.selectedText);
    }

    if (state.openFiles.length > 0) {
      parts.push(`Open files: ${state.openFiles.map(f => `@${f}`).join(', ')}`);
    }

    return parts.join('\n');
  }
}

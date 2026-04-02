/**
 * DiagnosticsEngine — Workspace Error/Warning Injection
 * 
 * Queries vscode.languages.getDiagnostics() for all active diagnostics
 * and formats them for agent context injection, enabling autonomous
 * debugging routines.
 */

import * as vscode from 'vscode';

export interface DiagnosticSummary {
  totalErrors: number;
  totalWarnings: number;
  fileCount: number;
  formatted: string;
}

export class DiagnosticsEngine {
  /**
   * Get a formatted summary of all workspace diagnostics.
   */
  public getSummary(): DiagnosticSummary {
    const allDiagnostics = vscode.languages.getDiagnostics();
    let totalErrors = 0;
    let totalWarnings = 0;
    let fileCount = 0;
    const parts: string[] = [];

    for (const [uri, diagnostics] of allDiagnostics) {
      const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
      const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);

      if (errors.length === 0 && warnings.length === 0) { continue; }

      fileCount++;
      totalErrors += errors.length;
      totalWarnings += warnings.length;

      parts.push(`\n📄 ${uri.fsPath}:`);

      for (const diag of errors.slice(0, 5)) { // Cap at 5 errors per file
        parts.push(`  ❌ L${diag.range.start.line + 1}: ${diag.message} [${diag.source || 'unknown'}]`);
      }
      for (const diag of warnings.slice(0, 3)) { // Cap at 3 warnings per file
        parts.push(`  ⚠️ L${diag.range.start.line + 1}: ${diag.message} [${diag.source || 'unknown'}]`);
      }
    }

    return {
      totalErrors,
      totalWarnings,
      fileCount,
      formatted: parts.length > 0
        ? `Workspace Diagnostics (${totalErrors} errors, ${totalWarnings} warnings across ${fileCount} files):${parts.join('\n')}`
        : '',
    };
  }

  /**
   * Get diagnostics for a specific file.
   */
  public getFileDiagnostics(uri: vscode.Uri): string {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    if (diagnostics.length === 0) { return ''; }

    const lines = diagnostics.map(d => {
      const severity = d.severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️';
      return `${severity} Line ${d.range.start.line + 1}: ${d.message}`;
    });

    return `Diagnostics for ${uri.fsPath}:\n${lines.join('\n')}`;
  }
}

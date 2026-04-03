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

      for (const diag of errors.slice(0, 10)) { // Increased cap
        parts.push(`  ❌ L${diag.range.start.line + 1}: ${diag.message} [${diag.source || 'unknown'}]`);
        if (diag.relatedInformation) {
          for (const related of diag.relatedInformation.slice(0, 2)) {
            parts.push(`    ↳ Related: ${related.location.uri.fsPath} L${related.location.range.start.line + 1}: ${related.message}`);
          }
        }
      }
      for (const diag of warnings.slice(0, 5)) {
        parts.push(`  ⚠️ L${diag.range.start.line + 1}: ${diag.message} [${diag.source || 'unknown'}]`);
        if (diag.relatedInformation) {
          for (const related of diag.relatedInformation.slice(0, 2)) {
            parts.push(`    ↳ Related: ${related.location.uri.fsPath} L${related.location.range.start.line + 1}: ${related.message}`);
          }
        }
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
      let msg = `${severity} L${d.range.start.line + 1}: ${d.message}`;
      if (d.relatedInformation) {
        const related = d.relatedInformation.map(r => `\n    ↳ Related: ${r.message}`).join('');
        msg += related;
      }
      return msg;
    });

    return `Diagnostics for ${uri.fsPath}:\n${lines.join('\n')}`;
  }
}

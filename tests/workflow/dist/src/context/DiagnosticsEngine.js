"use strict";
/**
 * DiagnosticsEngine — Workspace Error/Warning Injection
 *
 * Queries vscode.languages.getDiagnostics() for all active diagnostics
 * and formats them for agent context injection, enabling autonomous
 * debugging routines.
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
exports.DiagnosticsEngine = void 0;
const vscode = __importStar(require("vscode"));
class DiagnosticsEngine {
    /**
     * Get a formatted summary of all workspace diagnostics.
     */
    getSummary() {
        const allDiagnostics = vscode.languages.getDiagnostics();
        let totalErrors = 0;
        let totalWarnings = 0;
        let fileCount = 0;
        const parts = [];
        for (const [uri, diagnostics] of allDiagnostics) {
            const errors = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error);
            const warnings = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Warning);
            if (errors.length === 0 && warnings.length === 0) {
                continue;
            }
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
    getFileDiagnostics(uri) {
        const diagnostics = vscode.languages.getDiagnostics(uri);
        if (diagnostics.length === 0) {
            return '';
        }
        const lines = diagnostics.map(d => {
            const severity = d.severity === vscode.DiagnosticSeverity.Error ? '❌' : '⚠️';
            return `${severity} Line ${d.range.start.line + 1}: ${d.message}`;
        });
        return `Diagnostics for ${uri.fsPath}:\n${lines.join('\n')}`;
    }
}
exports.DiagnosticsEngine = DiagnosticsEngine;

"use strict";
/**
 * PromptAssembler
 *
 * Produces reusable prompt bundles so chat, panel, inline edit, and
 * composer share the same workspace/editor/diagnostic context shape.
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
exports.PromptAssembler = void 0;
const vscode = __importStar(require("vscode"));
const WorkspaceIndexer_1 = require("./WorkspaceIndexer");
const EditorContext_1 = require("./EditorContext");
const DiagnosticsEngine_1 = require("./DiagnosticsEngine");
class PromptAssembler {
    workspaceIndexer = new WorkspaceIndexer_1.WorkspaceIndexer();
    editorContext = new EditorContext_1.EditorContext();
    diagnosticsEngine = new DiagnosticsEngine_1.DiagnosticsEngine();
    async buildContextBundle() {
        const workspace = await this.workspaceIndexer.analyze();
        return {
            cwd: workspace.primaryFolder,
            workspace,
            editor: this.editorContext.formatForPrompt(),
            diagnostics: this.diagnosticsEngine.getSummary().formatted,
        };
    }
    async assembleChatPrompt(userPrompt) {
        const bundle = await this.buildContextBundle();
        return {
            prompt: this.renderPrompt(bundle, userPrompt),
            cwd: bundle.cwd,
        };
    }
    async assembleInlineEditPrompt(input) {
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
    assembleCompletionPrompt(input) {
        const sections = [];
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
    async assemble(userPrompt) {
        const { prompt } = await this.assembleChatPrompt(userPrompt);
        return prompt;
    }
    getCwd() {
        return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();
    }
    renderPrompt(bundle, userPrompt) {
        const sections = this.renderSharedContextSections(bundle);
        sections.push('<request>');
        sections.push(userPrompt);
        sections.push('</request>');
        return sections.join('\n');
    }
    renderSharedContextSections(bundle) {
        const sections = [];
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
exports.PromptAssembler = PromptAssembler;

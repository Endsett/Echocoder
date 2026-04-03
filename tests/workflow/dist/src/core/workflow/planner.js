"use strict";
/**
 * Planner — Phase 1 of the Workflow Engine
 *
 * Runs the agent in a restricted "plan-only" mode:
 *  - All mutating tools (Write, Edit, Bash, etc.) are disallowed
 *  - A system prompt instructs the agent to produce a structured plan
 *  - The raw agent output is parsed into a typed Plan object
 *
 * Strategy: Two-phase execution with disallowed tools (decisions b+c).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Planner = void 0;
const agent_events_1 = require("../../types/agent-events");
/** Tools blocked during the planning phase. */
const PLANNING_DISALLOWED_TOOLS = [
    'Write',
    'Edit',
    'Bash',
    'PowerShell',
    'MultiEdit',
    'WebFetch',
    'WebSearch',
    'Fetch',
    'Curl',
    'TodoWrite',
];
/**
 * System prompt prepended to every planning run.
 * Instructs the agent to produce a structured plan rather than executing.
 */
const PLANNING_SYSTEM_PROMPT = `You are in PLAN-ONLY mode. Do NOT execute any changes.

Analyze the user's request and produce a structured implementation plan.

Your response MUST contain exactly one JSON code block with the following structure:

\`\`\`json
{
  "summary": "One-line description of what this plan will accomplish",
  "risk": "low|medium|high",
  "steps": [
    {
      "index": 1,
      "description": "Human-readable description of this step",
      "category": "read|write|create|delete|execute|refactor|test|other",
      "affectedFiles": ["path/to/file.ts"],
      "risk": "low|medium|high"
    }
  ],
  "readFiles": ["files/to/read.ts"],
  "writeFiles": ["files/to/modify.ts"]
}
\`\`\`

After the JSON block, you may add additional markdown commentary explaining
your reasoning, trade-offs, or anything the user should know before approving.

Rules:
- List every file you intend to read, create, or modify.
- Be specific about what each step does.
- Mark steps that run shell commands (build, test, lint) as "execute" category and "medium"+ risk.
- Do NOT attempt to use any tools. Reading files via tools is allowed for context gathering.`;
class Planner {
    constructor(processManager, promptAssembler, outputChannel) {
        this.processManager = processManager;
        this.promptAssembler = promptAssembler;
        this.outputChannel = outputChannel;
    }
    /**
     * Generate a plan for the given user prompt.
     *
     * Spawns the agent with all mutating tools disabled and a system
     * prompt instructing it to output a structured plan.
     */
    async generatePlan(userPrompt, token) {
        this.outputChannel.appendLine(`[Planner] Generating plan for: "${userPrompt.substring(0, 120)}"`);
        const assembled = await this.promptAssembler.assembleChatPrompt(`${PLANNING_SYSTEM_PROMPT}\n\n---\n\nUser request:\n${userPrompt}`);
        return new Promise((resolve, reject) => {
            let rawText = '';
            let resolved = false;
            const cleanup = () => {
                eventSub.dispose();
                exitSub.dispose();
            };
            const eventSub = this.processManager.onEvent((event) => {
                if ((0, agent_events_1.isTextDelta)(event)) {
                    rawText += event.text;
                    return;
                }
                if ((0, agent_events_1.isResultSuccess)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        try {
                            const plan = this.parseAgentResponse(rawText, userPrompt);
                            this.outputChannel.appendLine(`[Planner] Plan generated: ${plan.steps.length} steps, risk=${plan.risk}`);
                            resolve(plan);
                        }
                        catch (err) {
                            const message = err instanceof Error ? err.message : String(err);
                            this.outputChannel.appendLine(`[Planner] Failed to parse plan: ${message}`);
                            // Fall back to a single-step plan from the raw markdown
                            resolve(this.buildFallbackPlan(rawText, userPrompt));
                        }
                    }
                    return;
                }
                if ((0, agent_events_1.isResultError)(event)) {
                    if (!resolved) {
                        resolved = true;
                        cleanup();
                        reject(new Error(event.error || event.result || 'Agent returned an error during planning'));
                    }
                }
            });
            const exitSub = this.processManager.onExit((code) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    if (rawText.trim()) {
                        try {
                            resolve(this.parseAgentResponse(rawText, userPrompt));
                        }
                        catch {
                            resolve(this.buildFallbackPlan(rawText, userPrompt));
                        }
                    }
                    else {
                        reject(new Error(`Agent exited with code ${code} without producing a plan`));
                    }
                }
            });
            this.processManager
                .spawn({
                prompt: assembled.prompt,
                cwd: assembled.cwd,
                mode: 'chat',
                additionalFlags: [
                    '--disallowedTools',
                    PLANNING_DISALLOWED_TOOLS.join(','),
                ],
            }, token)
                .catch((error) => {
                if (!resolved) {
                    resolved = true;
                    cleanup();
                    reject(error);
                }
            });
        });
    }
    /**
     * Parse the agent's raw text output into a structured Plan.
     * Extracts the first JSON code block matching the plan schema.
     */
    parseAgentResponse(rawText, userPrompt) {
        const jsonMatch = rawText.match(/```json\s*\n([\s\S]*?)\n\s*```/);
        if (!jsonMatch) {
            throw new Error('No JSON code block found in agent response');
        }
        const parsed = JSON.parse(jsonMatch[1]);
        if (!parsed.summary || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
            throw new Error('Invalid plan structure: missing summary or steps');
        }
        const steps = parsed.steps.map((step, i) => ({
            index: step.index ?? i + 1,
            description: String(step.description || ''),
            category: this.normalizeCategory(step.category),
            affectedFiles: Array.isArray(step.affectedFiles) ? step.affectedFiles : [],
            risk: this.normalizeRisk(step.risk),
            status: 'pending',
        }));
        return {
            id: `plan-${Date.now()}`,
            userPrompt,
            summary: String(parsed.summary),
            steps,
            readFiles: Array.isArray(parsed.readFiles) ? parsed.readFiles : [],
            writeFiles: Array.isArray(parsed.writeFiles) ? parsed.writeFiles : [],
            risk: this.normalizeRisk(parsed.risk),
            rawMarkdown: rawText,
            state: 'draft',
            createdAt: Date.now(),
        };
    }
    /**
     * Build a fallback plan when the agent's output can't be parsed
     * as structured JSON. Wraps the entire response as a single step.
     */
    buildFallbackPlan(rawText, userPrompt) {
        this.outputChannel.appendLine('[Planner] Using fallback single-step plan (structured parse failed)');
        // Try to extract a summary from the first line
        const firstLine = rawText.split('\n').find((l) => l.trim().length > 0) || 'Execute user request';
        const summary = firstLine.replace(/^#+\s*/, '').substring(0, 120);
        return {
            id: `plan-${Date.now()}`,
            userPrompt,
            summary,
            steps: [
                {
                    index: 1,
                    description: 'Execute the full request as described by the agent',
                    category: 'other',
                    affectedFiles: [],
                    risk: 'medium',
                    status: 'pending',
                },
            ],
            readFiles: [],
            writeFiles: [],
            risk: 'medium',
            rawMarkdown: rawText,
            state: 'draft',
            createdAt: Date.now(),
        };
    }
    normalizeCategory(raw) {
        const valid = ['read', 'write', 'create', 'delete', 'execute', 'refactor', 'test', 'other'];
        return typeof raw === 'string' && valid.includes(raw)
            ? raw
            : 'other';
    }
    normalizeRisk(raw) {
        const valid = ['low', 'medium', 'high'];
        return typeof raw === 'string' && valid.includes(raw)
            ? raw
            : 'medium';
    }
}
exports.Planner = Planner;

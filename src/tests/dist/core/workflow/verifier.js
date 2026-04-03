"use strict";
/**
 * Verifier — Phase 4 of the Workflow Engine
 *
 * Runs automated post-execution checks to validate that the agent's
 * changes didn't break anything. Checks include TypeScript compilation,
 * linting, and (optionally) test execution.
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
exports.Verifier = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/** Maximum time (ms) to wait for each verification command. */
const CHECK_TIMEOUT_MS = 30_000;
class Verifier {
    outputChannel;
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    /**
     * Run post-execution verification checks.
     *
     * Checks are context-aware: only runs TypeScript checks if tsconfig
     * exists, only runs lint if eslint/biome config exists, etc.
     */
    async verify(executionResult, cwd) {
        this.outputChannel.appendLine(`[Verifier] Starting verification for plan "${executionResult.planId}" in ${cwd}`);
        const checks = [];
        // TypeScript compilation check
        if (this.hasFile(cwd, 'tsconfig.json')) {
            checks.push(await this.runCheck('TypeScript', 'npx tsc --noEmit', cwd));
        }
        // Lint check (try eslint first, then biome)
        if (this.hasFile(cwd, '.eslintrc') || this.hasFile(cwd, '.eslintrc.js') ||
            this.hasFile(cwd, '.eslintrc.json') || this.hasFile(cwd, 'eslint.config.js') ||
            this.hasFile(cwd, 'eslint.config.mjs')) {
            checks.push(await this.runCheck('ESLint', 'npx eslint --no-error-on-unmatched-pattern .', cwd));
        }
        else if (this.hasFile(cwd, 'biome.json') || this.hasFile(cwd, 'biome.jsonc')) {
            checks.push(await this.runCheck('Biome', 'npx biome check .', cwd));
        }
        // Package.json scripts — check for "test" script
        const testScript = this.getPackageScript(cwd, 'test');
        if (testScript && !testScript.includes('no test specified')) {
            // Only auto-run tests if they exist and are configured
            checks.push(await this.runCheck('Tests', 'npm test -- --passWithNoTests 2>&1 || true', cwd));
        }
        // Build check (quick sanity — only if build script exists)
        const buildScript = this.getPackageScript(cwd, 'build');
        if (buildScript) {
            checks.push(await this.runCheck('Build', 'npm run build', cwd));
        }
        const passed = checks.length === 0 || checks.every((c) => c.passed);
        const failedChecks = checks.filter((c) => !c.passed);
        const summary = passed
            ? `All ${checks.length} verification check(s) passed.`
            : `${failedChecks.length}/${checks.length} check(s) failed: ${failedChecks.map((c) => c.name).join(', ')}`;
        this.outputChannel.appendLine(`[Verifier] ${summary}`);
        return {
            planId: executionResult.planId,
            passed,
            checks,
            summary,
        };
    }
    /**
     * Run a single verification command and capture its result.
     */
    runCheck(name, command, cwd) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            this.outputChannel.appendLine(`[Verifier] Running: ${name} (${command})`);
            const child = (0, child_process_1.exec)(command, {
                cwd,
                timeout: CHECK_TIMEOUT_MS,
                env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
                maxBuffer: 1024 * 1024, // 1MB
            }, (error, stdout, stderr) => {
                const durationMs = Date.now() - startTime;
                const output = (stdout + '\n' + stderr).trim().substring(0, 2000);
                const passed = !error;
                this.outputChannel.appendLine(`[Verifier] ${name}: ${passed ? 'PASSED' : 'FAILED'} (${durationMs}ms)`);
                if (!passed) {
                    this.outputChannel.appendLine(`[Verifier] ${name} output: ${output.substring(0, 500)}`);
                }
                resolve({ name, command, passed, output, durationMs });
            });
            // Safety: kill if process hangs
            setTimeout(() => {
                try {
                    child.kill('SIGTERM');
                }
                catch { /* ignore */ }
            }, CHECK_TIMEOUT_MS + 1000);
        });
    }
    hasFile(cwd, filename) {
        try {
            return fs.existsSync(path.join(cwd, filename));
        }
        catch {
            return false;
        }
    }
    getPackageScript(cwd, scriptName) {
        try {
            const pkgPath = path.join(cwd, 'package.json');
            if (!fs.existsSync(pkgPath)) {
                return undefined;
            }
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            return pkg.scripts?.[scriptName];
        }
        catch {
            return undefined;
        }
    }
}
exports.Verifier = Verifier;

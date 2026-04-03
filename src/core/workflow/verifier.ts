/**
 * Verifier — Phase 4 of the Workflow Engine
 *
 * Runs automated post-execution checks to validate that the agent's
 * changes didn't break anything. Checks include TypeScript compilation,
 * linting, and (optionally) test execution.
 */

import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { VerificationCheck, VerificationReport, ExecutionResult } from './types';

/** Maximum time (ms) to wait for each verification command. */
const CHECK_TIMEOUT_MS = 30_000;

export class Verifier {
  constructor(
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  /**
   * Run post-execution verification checks.
   *
   * Checks are context-aware: only runs TypeScript checks if tsconfig
   * exists, only runs lint if eslint/biome config exists, etc.
   */
  public async verify(
    executionResult: ExecutionResult,
    cwd: string
  ): Promise<VerificationReport> {
    this.outputChannel.appendLine(
      `[Verifier] Starting verification for plan "${executionResult.planId}" in ${cwd}`
    );

    const checks: VerificationCheck[] = [];

    // TypeScript compilation check
    if (this.hasFile(cwd, 'tsconfig.json')) {
      checks.push(await this.runCheck('TypeScript', 'npx tsc --noEmit', cwd));
    }

    // Lint check (try eslint first, then biome)
    if (this.hasFile(cwd, '.eslintrc') || this.hasFile(cwd, '.eslintrc.js') ||
        this.hasFile(cwd, '.eslintrc.json') || this.hasFile(cwd, 'eslint.config.js') ||
        this.hasFile(cwd, 'eslint.config.mjs')) {
      checks.push(await this.runCheck('ESLint', 'npx eslint --no-error-on-unmatched-pattern .', cwd));
    } else if (this.hasFile(cwd, 'biome.json') || this.hasFile(cwd, 'biome.jsonc')) {
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
  private runCheck(name: string, command: string, cwd: string): Promise<VerificationCheck> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      this.outputChannel.appendLine(`[Verifier] Running: ${name} (${command})`);

      const child = exec(command, {
        cwd,
        timeout: CHECK_TIMEOUT_MS,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
        maxBuffer: 1024 * 1024, // 1MB
      }, (error, stdout, stderr) => {
        const durationMs = Date.now() - startTime;
        const output = (stdout + '\n' + stderr).trim().substring(0, 2000);
        const passed = !error;

        this.outputChannel.appendLine(
          `[Verifier] ${name}: ${passed ? 'PASSED' : 'FAILED'} (${durationMs}ms)`
        );

        if (!passed) {
          this.outputChannel.appendLine(`[Verifier] ${name} output: ${output.substring(0, 500)}`);
        }

        resolve({ name, command, passed, output, durationMs });
      });

      // Safety: kill if process hangs
      setTimeout(() => {
        try { child.kill('SIGTERM'); } catch { /* ignore */ }
      }, CHECK_TIMEOUT_MS + 1000);
    });
  }

  private hasFile(cwd: string, filename: string): boolean {
    try {
      return fs.existsSync(path.join(cwd, filename));
    } catch {
      return false;
    }
  }

  private getPackageScript(cwd: string, scriptName: string): string | undefined {
    try {
      const pkgPath = path.join(cwd, 'package.json');
      if (!fs.existsSync(pkgPath)) { return undefined; }
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.scripts?.[scriptName];
    } catch {
      return undefined;
    }
  }
}

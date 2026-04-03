import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Pipeline Doctor (Interceptor Agent)
 * 
 * Invoked by GitHub Actions on step failure.
 * Reads the step summary/logs, uses an LLM (or mock for now) to diagnose,
 * and attempts to generate a fix and push it to the current branch.
 */
async function runDoctor() {
  console.log('🩺 Pipeline Doctor: Initiating self-healing protocol...');

  const logPath = process.env.GITHUB_STEP_SUMMARY || process.argv[2];
  if (!logPath || !fs.existsSync(logPath)) {
    console.error('No step summary or log path provided. Cannot diagnose.');
    process.exit(0); // Exit gracefully so CI doesn't double-fail
  }

  const logs = fs.readFileSync(logPath, 'utf8');
  console.log(`Analyzing logs (${logs.length} chars)...`);

  // Simple heuristic for demo/mock purposes
  const isLintError = logs.includes('eslint') || logs.includes('lint');
  const isTestError = logs.includes('test failed') || logs.includes('AssertionError');

  let proposedFix = '';
  let targetFile = '';

  if (isLintError) {
    console.log('Diagnosis: Linting Error');
    console.log('Action: Running auto-fixer via eslint...');
    try {
      execSync('npm run lint -- --fix', { stdio: 'inherit' });
      proposedFix = 'Auto-fixed linting errors';
    } catch (e) {
      console.log('Could not auto-fix lint errors. Deep agentic remediation needed.');
      return;
    }
  } else if (isTestError) {
    console.log('Diagnosis: Test Failure');
    console.log('Action: Deep semantic analysis required. Handing off to AI Supervisor...');
    // In a real implementation we would call OpenClaude or an LLM here:
    // await executeAgentCmd(`Fix the failing test described in logs: ${logs}`);
    proposedFix = 'Agentic remediation for test failure [Mock]';
  } else {
    console.log('Diagnosis: Unknown Error (potentially infrastructure or build config)');
    console.log('Action: Escalate to human supervisor.');
    return;
  }

  // Attempt to commit and push if there are changes
  try {
    const status = execSync('git status --porcelain').toString();
    if (status.length > 0) {
      console.log('Setting Agent Git Identity...');
      execSync('git config --global user.name "EchoCoder Agent"');
      execSync('git config --global user.email "agent@echocoder.ai"');

      console.log('Applying remediation commit...');
      execSync('git add .');
      execSync(`git commit -m "fix(ci): autonomous self-healing - ${proposedFix}"`);
      
      console.log('Pushing fix to remote...');
      if (process.env.CI) {
        execSync('git push origin HEAD');
      }
      console.log('✅ Self-healing complete. CI should re-trigger.');
    } else {
      console.log('No local changes made. Self-healing was unable to resolve the issue directly.');
    }
  } catch (err: any) {
    console.error('Failed to commit remediation:', err.message);
  }
}

runDoctor();

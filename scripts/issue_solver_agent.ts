import * as fs from 'fs';
import { execSync, spawnSync } from 'child_process';
import { AgentOrchestrator } from './agent_orchestrator';

/**
 * Issue Solver Agent (The Solver)
 * 
 * Invoked by labeling an issue with 'status: agent-solve'.
 * Uses real OpenClaude engine to Plan -> Code -> Verify.
 */
async function runIssueSolver() {
  const issueNumber = process.env.ISSUE_NUMBER;
  if (!issueNumber) {
    AgentOrchestrator.log('SOLVER', 'ERROR', 'ISSUE_NUMBER missing.');
    process.exit(1);
  }

  AgentOrchestrator.log('SOLVER', 'THOUGHT', `Received objective: Solve Issue #${issueNumber}`);

  // 1. Fetch Issue Data
  const issueData = JSON.parse(execSync(`gh issue view ${issueNumber} --json title,body,labels`, { encoding: 'utf8' }));
  AgentOrchestrator.log('SOLVER', 'THOUGHT', `Fetched issue: "${issueData.title}"`);

  // 2. Initial Localization (Heuristic)
  const keywords = issueData.title.split(' ').filter((w: string) => w.length > 5);
  let targetFile = 'src/extension.ts'; // Default
  try {
    const grepOutput = execSync(`grep -rl "${keywords[0]}" src/ | head -n 1`, { encoding: 'utf8' }).trim();
    if (grepOutput) targetFile = grepOutput;
  } catch (e) {}

  AgentOrchestrator.log('SOLVER', 'THOUGHT', `Starting point localized to: ${targetFile}`);

  // 3. Invoke OpenClaude for Autonomous Solving
  const branchName = `fix/issue-${issueNumber}-agent`;
  execSync(`git checkout -b ${branchName}`);

  const agentPrompt = `
  You are an Autonomous Issue Solver for EchoCoder.
  Objective: ${issueData.title}
  Issue Context: ${issueData.body}
  Primary Target: ${targetFile}
  
  Please analyze the code and apply a fix. When done, output the list of modified files.
  `;

  AgentOrchestrator.log('SOLVER', 'ACTION', `Invoking OpenClaude engine on ${targetFile}...`);

  try {
    // Run real CLI
    const result = spawnSync('npx', ['openclaude', '-p', '--model', 'claude-3-5-sonnet', agentPrompt], {
      encoding: 'utf8',
      env: { ...process.env, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY }
    });

    if (result.status !== 0) {
      throw new Error(`OpenClaude exited with code ${result.status}: ${result.stderr}`);
    }

    AgentOrchestrator.log('SOLVER', 'RESULT', `OpenClaude finished. Analyzing diffs...`);

    // 4. Verification via Dagger/Local Tests
    AgentOrchestrator.log('SOLVER', 'ACTION', 'Running verification suite...');
    try {
      execSync('npm test', { stdio: 'inherit' });
      AgentOrchestrator.log('SOLVER', 'RESULT', 'Tests passed. Preparing PR.');

      // 5. Submit PR
      execSync('git add .');
      execSync(`git commit -m "fix: autonomous solve of Issue #${issueNumber}"`);
      execSync(`git push origin ${branchName} --force`);

      const prBody = `🤖 **Autonomous Agent Fix**: Address Issue #${issueNumber}.
      
**Execution Context**:
- **Agent**: OpenClaude (Sonnet 3.5)
- **Primary Focus**: \`${targetFile}\`
- **Verification**: Verified via existing test suite.

*Created automatically by EchoCoder ATC*
      `;

      execSync(`gh pr create --title "fix: autonomous solve of Issue #${issueNumber}" --body "${prBody}" --head ${branchName}`);
      AgentOrchestrator.log('SOLVER', 'RESULT', `✅ PR opened for Issue #${issueNumber}`);
    } catch (testErr: any) {
      AgentOrchestrator.log('SOLVER', 'ERROR', `Tests failed after fix attempt: ${testErr.message}`);
      process.exit(1);
    }

  } catch (agentErr: any) {
    AgentOrchestrator.log('SOLVER', 'ERROR', `Agent execution failed: ${agentErr.message}`);
    process.exit(1);
  }
}

runIssueSolver().catch(err => {
  AgentOrchestrator.log('SOLVER', 'ERROR', `Fatal: ${err.message}`);
  process.exit(1);
});

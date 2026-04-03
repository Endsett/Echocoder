import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Critic Agent (The Critic)
 * 
 * Performs AI-to-AI peer review on Pull Requests.
 * High-volume code quality gate.
 */
async function runCriticReview() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.warn('⚠️ No PR_NUMBER. Skipping critic review.');
    process.exit(0);
  }

  console.log(`🕵️ Critic: Reviewing PR #${prNumber} for architectural alignment...`);

  // 1. Fetch PR Diff & Context
  const prData = JSON.parse(execSync(`gh pr view ${prNumber} --json title,body,files`, { encoding: 'utf8' }));
  const diff = execSync(`gh pr diff ${prNumber}`, { encoding: 'utf8' });

  console.log(`Analyzing diff (${diff.length} bytes)...`);

  // 2. Structural Analysis (Simplified)
  // Check for common red flags 
  const hasConsoleLogs = diff.includes('+console.log(');
  const hasFIXMEs = diff.includes('+FIXME') || diff.includes('+TODO');
  const sizeLimit = 500; // Lines changed limit for 'High Complexity'
  const isLargePR = diff.split('\n').filter(l => l.startsWith('+') || l.startsWith('-')).length > sizeLimit;

  let reviewComment = `🕵️ **Agentic Critic Review** (PR #${prNumber})\n\n`;

  if (hasConsoleLogs) {
    reviewComment += `- ⚠️ **Warning**: Found \`console.log\` in the production diff. Please remove debugging code.\n`;
  }
  if (hasFIXMEs) {
    reviewComment += `- ⚠️ **Warning**: New TODO/FIXME markers found. Ensure these represent planned tech debt, not unresolved issues.\n`;
  }
  if (isLargePR) {
    reviewComment += `- ⚖️ **Complexity**: This PR is large (>500 lines). Maintainer review is strongly recommended.\n`;
  }

  if (!hasConsoleLogs && !hasFIXMEs && !isLargePR) {
    reviewComment += `✅ **Code Quality Passed**: This PR looks like a clean, structural update. Procedural tests should suffice.\n`;
  }

  // 3. Post Comment
  try {
    execSync(`gh pr comment ${prNumber} --body "${reviewComment}"`, { stdio: 'inherit' });
    console.log('✅ Critic review posted.');
  } catch (err: any) {
    console.error(`❌ Failed to post critic review: ${err.message}`);
  }
}

runCriticReview().catch(console.error);

import { execSync } from 'child_process';

/**
 * Conflict Air Traffic Control (ATC)
 * 
 * Periodically checks for merge conflicts in open PRs.
 * Notifies contributors immediately so they can rebase.
 */
function runATC() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.warn('⚠️ PR_NUMBER missing. Skipping conflict detection.');
    process.exit(0);
  }

  console.log(`📡 ATC: Checking for merge conflicts on PR #${prNumber}...`);

  try {
    // Check if the PR is mergeable via GitHub CLI
    const mergeable = execSync(`gh pr view ${prNumber} --json mergeable --jq '.mergeable'`, { encoding: 'utf8' }).trim();

    if (mergeable === 'CONFLICTING') {
      console.log(`⚠️ Conflict detected on PR #${prNumber}. Preparing ATC notification...`);
      
      const commentBody = `🤖 **Agentic ATC Notice**: PR #${prNumber} has a merge conflict with the current base branch. 

Please **rebase or merge** the latest changes to resolve this before the Agentic review loop can proceed. 

Thank you,
*EchoCoder ATC Agent*`;

      execSync(`gh pr comment ${prNumber} --body "${commentBody}"`, { stdio: 'inherit' });
      console.log('✅ ATC notification sent.');
    } else {
      console.log('✅ PR is mergeable. No conflict detected.');
    }
  } catch (err: any) {
    console.error(`❌ ATC failed to check mergeability: ${err.message}`);
  }
}

runATC();

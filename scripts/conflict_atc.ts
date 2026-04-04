import { execSync } from 'child_process';

/**
 * Conflict Air Traffic Control (ATC)
 * 
 * Periodically checks for merge conflicts in open PRs.
 * Attempts auto-rebases for trivial conflicts and notifies developers.
 */
async function runATC() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.warn('⚠️ PR_NUMBER missing. Skipping conflict detection.');
    process.exit(0);
  }

  console.log(`📡 ATC: Checking PR #${prNumber} for merge conflicts...`);

  try {
    const prDataRaw = execSync(`gh pr view ${prNumber} --json mergeable,headRefName,baseRefName`, { encoding: 'utf8' });
    const { mergeable, headRefName, baseRefName } = JSON.parse(prDataRaw);

    if (mergeable === 'CONFLICTING') {
      console.log(`⚠️ Conflict detected on PR #${prNumber} (branch: ${headRefName} -> ${baseRefName}).`);
      
      // 1. Attempt Auto-Rebase
      console.log('🔄 ATC: Attempting autonomous rebase...');
      try {
        execSync(`git fetch origin ${baseRefName}`);
        execSync(`git checkout ${headRefName}`);
        
        // Use -Xours strategy for trivial conflict resolution if appropriate, 
        // but here we just try a standard rebase first.
        execSync(`git rebase origin/${baseRefName}`, { stdio: 'pipe' });
        
        console.log('✅ ATC: Auto-rebase successful. Synchronizing with origin...');
        execSync(`git push origin ${headRefName} --force-with-lease`);
        
        const successComment = `🤖 **Agentic ATC Notice**: PR #${prNumber} had a conflict, but I have **successfully auto-rebased** it against \`${baseRefName}\`. No action required.`;
        execSync(`gh pr comment ${prNumber} --body "${successComment}"`);
        
      } catch (rebaseErr: any) {
        console.log('❌ ATC: Auto-rebase failed. Identifying conflict points...');
        
        // 2. Identify conflicting files
        let conflictFiles = 'Unknown';
        try {
          conflictFiles = execSync('git diff --name-only --diff-filter=U', { encoding: 'utf8' }).trim().replace(/\n/g, ', ');
          execSync('git rebase --abort'); // Cleanup
        } catch (abortErr) {
          execSync('git merge --abort'); 
        }

        const failureComment = `🤖 **Agentic ATC Notice**: PR #${prNumber} has merge conflicts that I **could not resolve automatically**.
        
**Conflicting Files:**
\`\`\`
${conflictFiles}
\`\`\`

Please resolve these manually so the Agentic review loop can continue.`;

        execSync(`gh pr comment ${prNumber} --body "${failureComment}"`);
        console.log('✅ ATC: Failure notification sent.');
      }
    } else {
      console.log('✅ PR is mergeable. No conflict detected.');
    }
  } catch (err: any) {
    console.error(`❌ ATC Error: ${err.message}`);
  }
}

runATC();

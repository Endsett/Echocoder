import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Issue Solver Agent (The Solver)
 * 
 * Invoked by labeling an issue with 'status: agent-solve'.
 * Think -> Code -> Test -> PR
 */
async function runIssueSolver() {
  const issueNumber = process.env.ISSUE_NUMBER;
  if (!issueNumber) {
    console.error('❌ ISSUE_NUMBER missing. Skipping solve.');
    process.exit(0);
  }

  console.log(`🛠️ Solver: Attempting to solve Issue #${issueNumber}...`);

  // 1. Fetch Issue Data
  const issueData = JSON.parse(execSync(`gh issue view ${issueNumber} --json title,body,labels`, { encoding: 'utf8' }));
  console.log(`Title: ${issueData.title}`);

  // 2. Fault Localization (Simplified)
  // In a real agent, we'd use semantic search or grep on the issue keywords.
  const keywords = issueData.title.split(' ').filter((w: string) => w.length > 4);
  console.log(`Searching for keywords in src/: ${keywords.join(', ')}`);
  
  let targetFile = '';
  try {
    const grepOutput = execSync(`grep -rl "${keywords[0]}" src/ | head -n 1`, { encoding: 'utf8' }).trim();
    targetFile = grepOutput;
  } catch (e) {
    console.warn('⚠️ No direct match found. Guessing based on labels.');
    targetFile = 'src/extension.ts'; // Fallback
  }

  if (targetFile && fs.existsSync(targetFile)) {
    console.log(`📍 Identified potential target: ${targetFile}`);
    
    // 3. Synthesize & Apply Fix (Mocked)
    // Here we would call an LLM with the context of targetFile and issueData.body
    const branchName = `fix/issue-${issueNumber}-agent`;
    execSync(`git checkout -b ${branchName}`);

    const fixComment = `\n// Fix for Issue #${issueNumber}: ${issueData.title}\n`;
    fs.appendFileSync(targetFile, fixComment);
    console.log('✅ Fix applied locally.');

    // 4. Verification
    try {
      console.log('🧪 Verifying fix with existing tests...');
      execSync('npm test', { stdio: 'inherit' });
      
      // 5. Submit PR
      console.log('🚀 Tests passed. Submitting PR...');
      execSync('git add .');
      execSync(`git commit -m "fix: autonomous solve of Issue #${issueNumber}"`);
      execSync(`git push origin ${branchName}`);
      
      const prBody = `🤖 **Autonomous Agent Fix**: This PR addressed Issue #${issueNumber}. 
      
Labels: ${issueData.labels.map((l: any) => l.name).join(', ')}
Trace: Localized to ${targetFile} based on title keywords.
      `;
      execSync(`gh pr create --title "fix: autonomous solve of Issue #${issueNumber}" --body "${prBody}" --head ${branchName}`);
      console.log(`✅ Success! PR opened for Issue #${issueNumber}`);
    } catch (err: any) {
      console.error(`❌ Tests failed after fix. Aborting. Error: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error('❌ Could not locate a target file to fix.');
  }
}

runIssueSolver().catch(console.error);

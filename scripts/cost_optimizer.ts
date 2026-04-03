import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Cost Optimizer Agent (The Accountant)
 * 
 * Determines which tests are necessary based on the PR's semantic diff.
 * Significant cost savings for documentation-only or styling-only changes.
 */
function runCostOptimization() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.warn('⚠️ No PR_NUMBER. Skipping cost-optimization.');
    process.exit(0);
  }

  console.log(`💰 Accountant: Analyzing PR #${prNumber} for testing efficiency...`);

  const changedFiles = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' })
    .split('\n')
    .filter(f => f.trim().length > 0);

  const isDocsOnly = changedFiles.every(f => f.endsWith('.md') || f.startsWith('docs/'));
  const isUIOnly = !isDocsOnly && changedFiles.every(f => 
    f.endsWith('.css') || 
    f.endsWith('.svg') || 
    f.endsWith('.png') || 
    f.startsWith('images/')
  );

  let skipTests = false;
  let category = 'CORE_REFACTOR';

  if (isDocsOnly) {
    console.log('📄 Documentation-only change detected. Skipping high-rigor tests.');
    skipTests = true;
    category = 'DOCS_ONLY';
  } else if (isUIOnly) {
    console.log('🎨 UI/Style change detected. Skipping Mutation/Runtime tests.');
    skipTests = true;
    category = 'UI_ONLY';
  } else {
    console.log('⚙️ Core refactor detected. Full regression suite required.');
  }

  // Output to GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `skip_tests=${skipTests}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `test_category=${category}\n`);
  }

  console.log(`RESULT: CATEGORY=${category} | SKIP_TESTS=${skipTests}`);
}

runCostOptimization();

import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Area Triager (Orchestration Agent)
 * 
 * Analyzes the file list of a PR and assigns "area/*" labels automatically.
 */
function triageArea() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.error('❌ PR_NUMBER not set. Skipping triage.');
    process.exit(0);
  }

  console.log(`🔍 Triaging PR #${prNumber} for code area categorization...`);

  // Get the list of modified files via GitHub CLI
  let modifiedFiles: string[] = [];
  try {
    const rawFiles = execSync(`gh pr view ${prNumber} --json files --jq '.files[].path'`, { encoding: 'utf8' });
    modifiedFiles = rawFiles.split('\n').filter(f => f.trim().length > 0);
  } catch (err) {
    console.warn('⚠️ GitHub CLI failed. Fallback to local git diff.');
    const rawDiff = execSync('git diff --name-only origin/main...HEAD', { encoding: 'utf8' });
    modifiedFiles = rawDiff.split('\n').filter(f => f.trim().length > 0);
  }

  const areas = new Set<string>();

  modifiedFiles.forEach(file => {
    if (file.startsWith('src/')) areas.add('area/core');
    if (file.startsWith('tests/')) areas.add('area/testing');
    if (file.startsWith('scripts/')) areas.add('area/automation');
    if (file.startsWith('.github/workflows/')) areas.add('area/cicd');
    if (file.startsWith('docs/')) areas.add('area/documentation');
    if (file.includes('package.json')) areas.add('area/dependencies');
  });

  if (areas.size > 0) {
    console.log(`🏷️ Suggesting labels: ${Array.from(areas).join(', ')}`);
    try {
      const labelsArg = Array.from(areas).join(',');
      execSync(`gh pr edit ${prNumber} --add-label "${labelsArg}"`, { stdio: 'inherit' });
      console.log('✅ Area labeling complete.');
    } catch (err: any) {
      console.error(`❌ Failed to apply area labels: ${err.message}`);
    }
  } else {
    console.log('ℹ️ No specific areas identified.');
  }
}

triageArea();

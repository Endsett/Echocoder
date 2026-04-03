import { execSync } from 'child_process';
import * as fs from 'fs';

/**
 * Release Agent (The Herald)
 * 
 * Invoked on merge to main. 
 * Summarizes the impact and value of recent PRs and drafts a GitHub Release.
 */
async function runReleaseOrchestration() {
  console.log('📣 Herald: Orchestrating release draft...');

  const lastTag = execSync('git describe --tags --abbrev=0', { encoding: 'utf8' }).trim();
  console.log(`📡 Analyzing commits since last release: ${lastTag}`);

  const log = execSync(`git log ${lastTag}..HEAD --oneline`, { encoding: 'utf8' })
    .split('\n')
    .filter(l => l.trim().length > 0);

  if (log.length === 0) {
    console.log('ℹ️ No new commits to release.');
    process.exit(0);
  }

  const features = log.filter(l => l.includes('feat(') || l.includes('feat:'));
  const fixes = log.filter(l => l.includes('fix(') || l.includes('fix:'));
  const chores = log.filter(l => l.includes('chore(') || l.includes('docs('));

  const releaseBody = `
## 🚀 What's New in EchoCoder

### ✨ Features
${features.length > 0 ? features.map(f => `- ${f}`).join('\n') : '- No major new features.'}

### 🐞 Bug Fixes
${fixes.length > 0 ? fixes.map(f => `- ${f}`).join('\n') : '- No major bug fixes.'}

### 🛠️ Other Changes
${chores.length > 0 ? chores.map(f => `- ${f}`).join('\n') : '- Documentation and maintenance.'}

---
*Drafted autonomously by the EchoCoder Herald Agent*
`;

  const releasePath = './DRAFT_RELEASE.md';
  fs.writeFileSync(releasePath, releaseBody);
  console.log(`✅ Release note drafted at ${releasePath}`);

  // In a real environment with GH_TOKEN, we would call:
  // execSync(`gh release create v${Date.now()} --draft --title "Stable Release" --notes-file ${releasePath}`);
}

runReleaseOrchestration().catch(console.error);

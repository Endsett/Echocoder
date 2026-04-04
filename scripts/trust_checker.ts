import * as fs from 'fs';
import * as path from 'path';

/**
 * Contributor Trust Checker (Reputation Agent)
 * 
 * Determines whether a contributor is "Safe-to-Test" without manual approval.
 * Integrates with .kiro/memory/contributors.json.
 */
/**
 * Contributor Trust Checker (Reputation Agent)
 * 
 * Determines whether a contributor is "Safe-to-Test" without manual approval.
 * Also handles incrementing reputation after successful merges.
 */
function runTrustCheck() {
  const author = process.env.PR_AUTHOR || process.argv[2];
  const isIncrement = process.argv.includes('--increment');
  const memoryPath = path.join(process.cwd(), '.kiro', 'memory', 'contributors.json');

  if (!author) {
    console.error('❌ PR_AUTHOR or username missing.');
    process.exit(1);
  }

  if (!fs.existsSync(memoryPath)) {
    if (isIncrement) {
      console.log('📝 Creating initial memory for increment.');
      const initial = { contributors: [] };
      fs.mkdirSync(path.dirname(memoryPath), { recursive: true });
      fs.writeFileSync(memoryPath, JSON.stringify(initial, null, 2));
    } else {
      console.warn('⚠️ Contributor memory missing. Tier 0.');
      outputTrustResult(author, 0);
      return;
    }
  }

  const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  let contributor = memory.contributors.find((c: any) => c.username === author);

  if (isIncrement) {
    if (!contributor) {
      contributor = { username: author, trust_tier: 0, merged_prs: 0 };
      memory.contributors.push(contributor);
    }
    
    contributor.merged_prs += 1;
    
    // Tier Advancement Logic
    if (contributor.merged_prs >= 10 && contributor.trust_tier < 2) {
      contributor.trust_tier = 2; // Auto-promote to Trusted
      console.log(`🏆 Tier UP! ${author} is now Tier 2.`);
    } else if (contributor.merged_prs >= 3 && contributor.trust_tier < 1) {
      contributor.trust_tier = 1; // Auto-promote to Member
      console.log(`⭐ Tier UP! ${author} is now Tier 1.`);
    }

    fs.writeFileSync(memoryPath, JSON.stringify(memory, null, 2));
    console.log(`✅ Incremented reputation for ${author}. Total Merged: ${contributor.merged_prs}`);
  }

  if (contributor) {
    outputTrustResult(author, contributor.trust_tier);
  } else {
    outputTrustResult(author, 0);
  }
}

/**
 * Outputs the trust result for GitHub Actions.
 */
function outputTrustResult(username: string, tier: number) {
  const isTrusted = tier >= 2; 
  console.log(`RESULT: TRUSTED=${isTrusted}`);
  console.log(`RESULT: TIER=${tier}`);
  
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `trusted=${isTrusted}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tier=${tier}\n`);
  }
}

runTrustCheck();

import * as fs from 'fs';
import * as path from 'path';

/**
 * Contributor Trust Checker (Reputation Agent)
 * 
 * Determines whether a contributor is "Safe-to-Test" without manual approval.
 * Integrates with .kiro/memory/contributors.json.
 */
function checkTrust() {
  const author = process.env.PR_AUTHOR || process.argv[2];
  const memoryPath = path.join(process.cwd(), '.kiro', 'memory', 'contributors.json');

  if (!author) {
    console.error('❌ PR_AUTHOR environment variable missing.');
    process.exit(1);
  }

  if (!fs.existsSync(memoryPath)) {
    console.warn('⚠️ Contributor memory missing. Assuming Tier 0 (New).');
    outputTrustResult(author, 0);
    return;
  }

  const memory = JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  const contributor = memory.contributors.find((c: any) => c.username === author);

  if (contributor) {
    console.log(`👤 Found contributor: ${author} (Tier ${contributor.trust_tier})`);
    outputTrustResult(author, contributor.trust_tier);
  } else {
    console.log(`👋 New contributor detected: ${author}. assigning Tier 0.`);
    outputTrustResult(author, 0);
  }
}

/**
 * Outputs the trust result for GitHub Actions.
 */
function outputTrustResult(username: string, tier: number) {
  const isTrusted = tier >= 2; // Tier 2+ (Member/Trusted)
  console.log(`RESULT: TRUSTED=${isTrusted}`);
  console.log(`RESULT: TIER=${tier}`);
  
  // Create an output file for GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `trusted=${isTrusted}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `tier=${tier}\n`);
  }
}

checkTrust();

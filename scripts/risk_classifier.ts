import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Autonomous PR Risk Classifier
 * 
 * Analyzes the git diff and metadata to categorize PRs into risk tiers.
 * Used by the EchoCoder CI to determine if a PR can be auto-approved.
 */
async function classifyRisk(diffFile: string) {
  const diff = fs.readFileSync(diffFile, 'utf8');
  
  const highRiskMarkers = [
    'destroy_all',
    'rm -rf',
    'DELETE FROM',
    'DROP TABLE',
    'migration',
    'apiKey',
    'secret'
  ];

  const lines = diff.split('\n');
  let riskScore = 0;
  let matches = [];

  for (const marker of highRiskMarkers) {
    if (diff.includes(marker)) {
      riskScore += 10;
      matches.push(marker);
    }
  }

  // Determine PR number
  const prNumber = process.env.PR_NUMBER;

  let riskTier = 'UNKNOWN';
  let shouldApprove = false;

  // TIER 1: Low Risk (Non-code changes)
  if (lines.length < 50 && !matches.length) {
    console.log('RISK_TIER: LOW');
    console.log('APPROVAL: AUTO_ELIGIBLE');
    riskTier = 'Risk: Low';
    shouldApprove = true;
  }
  // TIER 2: Medium Risk (Standard logic changes)
  else if (riskScore < 5) {
    console.log('RISK_TIER: MEDIUM');
    console.log('APPROVAL: MANUAL_REQUIRED');
    riskTier = 'Risk: Medium';
  }
  // TIER 3: High Risk (Destructive or Security sensitive)
  else {
    console.log('RISK_TIER: HIGH');
    console.log('APPROVAL: STRICT_REVIEW_REQUIRED');
    console.log(`REASON: Found high-risk markers: ${matches.join(', ')}`);
    riskTier = 'Risk: High';
  }

  // Fully Autonomous Action Execution via GitHub CLI
  if (prNumber) {
    try {
      console.log(`Applying label '${riskTier}' to PR #${prNumber}...`);
      execSync(`gh pr edit ${prNumber} --add-label "${riskTier}"`, { stdio: 'inherit' });
      
      if (shouldApprove) {
        console.log(`Auto-approving PR #${prNumber} due to Low Risk...`);
        execSync(`gh pr review ${prNumber} --approve --body "🤖 **Autonomous Agent**: Auto-approved due to low risk classification."`, { stdio: 'inherit' });
      }
    } catch (err: any) {
      console.error(`❌ Failed to execute autonomous GitHub actions: ${err.message}`);
    }
  } else {
    console.log('⚠️ PR_NUMBER not set. In a standard PR build, this indicates a trigger error. Skipping autonomous GitHub actions.');
  }
}

const diffPath = process.argv[2] || 'diff.txt';
if (fs.existsSync(diffPath)) {
  classifyRisk(diffPath);
} else {
  console.log(`⚠️ Diff file not found at ${diffPath}. Defaulting to RISK_TIER: UNKNOWN`);
}

import * as fs from 'fs';
import * as path from 'path';

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

  // TIER 1: Low Risk (Non-code changes)
  if (lines.length < 50 && !matches.length) {
    console.log('RISK_TIER: LOW');
    console.log('APPROVAL: AUTO_ELIGIBLE');
    return;
  }

  // TIER 2: Medium Risk (Standard logic changes)
  if (riskScore < 5) {
    console.log('RISK_TIER: MEDIUM');
    console.log('APPROVAL: MANUAL_REQUIRED');
    return;
  }

  // TIER 3: High Risk (Destructive or Security sensitive)
  console.log('RISK_TIER: HIGH');
  console.log('APPROVAL: STRICT_REVIEW_REQUIRED');
  console.log(`REASON: Found high-risk markers: ${matches.join(', ')}`);
}

const diffPath = process.argv[2] || 'diff.txt';
if (fs.existsSync(diffPath)) {
  classifyRisk(diffPath);
} else {
  console.log('No diff found. Defaulting to RISK_TIER: UNKNOWN');
}

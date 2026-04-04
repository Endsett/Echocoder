import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * Autonomous PR Risk Classifier
 * 
 * Analyzes the git diff and metadata to categorize PRs into risk tiers.
 * Used by the EchoCoder CI to determine if a PR can be auto-approved.
 */
/**
 * Autonomous PR Risk Classifier
 * 
 * Analyzes the git diff and metadata to categorize PRs into risk tiers.
 * Used by the EchoCoder CI to determine if a PR can be auto-approved.
 */
async function classifyRisk(diffFile: string) {
  let diff = '';
  try {
    diff = fs.readFileSync(diffFile, 'utf8');
  } catch (err) {
    console.warn(`⚠️ Could not read diff file at ${diffFile}. Attempting 'git diff origin/main'...`);
    diff = execSync('git diff origin/main...HEAD', { encoding: 'utf8' });
  }
  
  const highRiskMarkers = [
    'destroy_all', 'rm -rf', 'DELETE FROM', 'DROP TABLE', 
    'apiKey', 'secret', 'password', 'token', 'access_key'
  ];

  const lines = diff.split('\n');
  let riskScore = 0;
  let matches = [];

  // 1. Content Analysis
  for (const marker of highRiskMarkers) {
    if (diff.includes(marker)) {
      riskScore += 10;
      matches.push(marker);
    }
  }

  // 2. Path-based Risk Analysis
  const SENSITIVE_PATHS = [
    '.github/workflows', 
    'src/core/security', 
    '.kiro/memory',
    'package.json',
    'tsconfig.json'
  ];
  
  // Extract modified files from diff (lines starting with +++ b/)
  const modifiedFiles = lines
    .filter(l => l.startsWith('+++ b/'))
    .map(l => l.substring(6));

  const hasSensitiveChanges = modifiedFiles.some(f => SENSITIVE_PATHS.some(p => f.includes(p)));
  if (hasSensitiveChanges) {
    riskScore += 25;
    matches.push('sensitive_file_modification');
  }

  // PR Context
  const prNumber = process.env.PR_NUMBER;
  const authorTier = parseInt(process.env.AUTHOR_TIER || '0', 10);

  // Reputation Discount: Trusted authors (Tier 2+) get a risk buffer
  if (authorTier >= 2) {
    console.log(`👤 Trusted Author (Tier ${authorTier}) detected. Applying risk buffer.`);
    riskScore = Math.max(0, riskScore - 15);
  }

  let riskTier = 'risk/unknown';
  let shouldApprove = false;

  // TIER 1: Low Risk (Minimal changes, no sensitive paths, no bad markers)
  if (lines.length < 100 && riskScore === 0) {
    riskTier = 'risk/low';
    shouldApprove = true;
  }
  // TIER 2: Medium Risk (Standard changes)
  else if (riskScore < 20) {
    riskTier = 'risk/medium';
  }
  // TIER 3: High Risk (Significant or Dangerous)
  else {
    riskTier = 'risk/high';
    console.log(`🚨 High Risk Detected: ${matches.join(', ')}`);
  }

  console.log(`RISK_TIER: ${riskTier.toUpperCase()}`);
  console.log(`RISK_SCORE: ${riskScore}`);

  // Execute Autonomous Actions
  if (prNumber) {
    try {
      execSync(`gh pr edit ${prNumber} --add-label "${riskTier}"`, { stdio: 'inherit' });
      
      if (shouldApprove && authorTier >= 1) {
        console.log(`✅ Auto-approving PR #${prNumber} (Low Risk + Contributor Tier ${authorTier})`);
        execSync(`gh pr review ${prNumber} --approve --body "🤖 **Agentic ATC**: Auto-approved (Low Risk classification)."`, { stdio: 'inherit' });
      }
    } catch (err: any) {
      console.error(`❌ GitHub CLI Action Failed: ${err.message}`);
    }
  }
}

const diffPath = process.argv[2] || 'diff.txt';
classifyRisk(diffPath);

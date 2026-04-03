import * as fs from 'fs';
import * as path from 'path';

/**
 * SafeOutputs Validator
 * 
 * Part of the "Governance" layer for Agentic CI/CD.
 * Scans AI-generated code patches (diffs) BEFORE they are merged
 * to ensure the agent hasn't hallucinated destructive commands, 
 * leaked API keys, or injected unapproved dependencies.
 */

const DESTRUCTIVE_PATTERNS = [
  /process\.exit\(\d+\)/g, // Agents shouldn't randomly exit processes in library code
  /rm\s+-rf/g,             // Deletion
  /drop\s+table/gi,        // SQL Drop
  /execSync?\(\s*["'`]rm\s/g // Execution of removal
];

const SECRET_PATTERNS = [
  /(?:api[_\-]?key|secret|token|password)[=:]\s*["'][a-zA-Z0-9_\-]{16,}["']/gi
];

function validateSafeOutputs(diffFile: string): void {
  console.log(`🛡️ SafeOutputs: Scanning AI generation via diff: ${diffFile}`);
  
  if (!fs.existsSync(diffFile)) {
    console.error("Diff file not found. Validation skipped.");
    process.exit(0);
  }

  const diffContent = fs.readFileSync(diffFile, 'utf8');
  let hasViolation = false;

  console.log("Analyzing for destructive patterns...");
  for (const pattern of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(diffContent)) {
      console.error(`❌ VIOLATION: Found destructive command matching ${pattern}`);
      hasViolation = true;
    }
  }

  console.log("Analyzing for secrets leakage...");
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(diffContent)) {
      console.error(`❌ VIOLATION: Potential hardcoded secret or API key found.`);
      hasViolation = true;
    }
  }

  if (diffContent.includes('package.json') && diffContent.includes('+') && diffContent.includes('dependencies')) {
    // Basic heuristic: check if diff modifies dependencies
    console.warn('⚠️ WARNING: AI modified package.json dependencies. Requires manual security review.');
  }

  if (hasViolation) {
    console.error('🛡️ SafeOutputs: Blocked PR/Push due to security or governance violation.');
    process.exit(1);
  }

  console.log('✅ SafeOutputs: AI code patch passed security validation.');
  process.exit(0);
}

const diffArg = process.argv[2] || 'diff.txt';
validateSafeOutputs(diffArg);

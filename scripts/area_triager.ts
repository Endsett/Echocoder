import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Area Triager (Orchestration Agent)
 * 
 * Analyzes the file list of a PR and assigns "area/*" labels, 
 * Reviewers, and complexity scores automatically.
 */
function triageArea() {
  const prNumber = process.env.PR_NUMBER;
  if (!prNumber) {
    console.error('❌ PR_NUMBER not set. Skipping triage.');
    process.exit(0);
  }

  console.log(`🔍 ATC: Triaging PR #${prNumber}...`);

  // 1. Fetch Metadata (Files + Stats)
  const prDataRaw = execSync(`gh pr view ${prNumber} --json files,additions,deletions`, { encoding: 'utf8' });
  const prData = JSON.parse(prDataRaw);
  const modifiedFiles: string[] = prData.files.map((f: any) => f.path);
  const totalChanges = prData.additions + prData.deletions;

  const labels = new Set<string>();
  const reviewers = new Set<string>();

  // 2. Area Detection & Reviewer Mapping
  const AREA_MAP: Record<string, { label: string; owner: string }> = {
    'src/core': { label: 'area/core', owner: '@engine-team' },
    'src/ui': { label: 'area/ui', owner: '@frontend-team' },
    'tests/': { label: 'area/testing', owner: '@dx-team' },
    'scripts/': { label: 'area/automation', owner: '@dx-team' },
    '.github/': { label: 'area/cicd', owner: '@infra-team' },
    'docs/': { label: 'area/documentation', owner: '@doc-team' },
    'package.json': { label: 'area/dependencies', owner: '@security-team' },
  };

  modifiedFiles.forEach(file => {
    Object.keys(AREA_MAP).forEach(pathPrefix => {
      if (file.startsWith(pathPrefix) || file === pathPrefix) {
        labels.add(AREA_MAP[pathPrefix].label);
        reviewers.add(AREA_MAP[pathPrefix].owner);
      }
    });
  });

  // 3. Complexity Scoring (Size Tagging)
  if (totalChanges > 500) labels.add('size/L');
  else if (totalChanges > 100) labels.add('size/M');
  else labels.add('size/S');

  // 4. Risk Classification
  const SENSITIVE_PATHS = ['.github/workflows', 'src/core/security', '.kiro/memory'];
  const isHighRisk = modifiedFiles.some(f => SENSITIVE_PATHS.some(p => f.includes(p)));
  if (isHighRisk) {
    labels.add('risk/high');
    reviewers.add('@security-team');
  }

  // 5. Apply Updates via GH CLI
  if (labels.size > 0 || reviewers.size > 0) {
    const labelsArg = Array.from(labels).join(',');
    const reviewersArg = Array.from(reviewers).join(',');

    console.log(`🏷️ Labels: ${labelsArg}`);
    console.log(`👤 Reviewers: ${reviewersArg}`);

    try {
      // Apply labels
      execSync(`gh pr edit ${prNumber} --add-label "${labelsArg}"`, { stdio: 'inherit' });
      
      // Request reviews (only if not already assigned)
      if (reviewersArg) {
        execSync(`gh pr edit ${prNumber} --add-reviewer "${reviewersArg}"`, { stdio: 'inherit' });
      }
      
      console.log('✅ ATC Triage complete.');
    } catch (err: any) {
      console.error(`❌ Failed to update PR: ${err.message}`);
    }
  }
}

triageArea();

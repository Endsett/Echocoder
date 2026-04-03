import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * Chaos Monkey Agent (The Infiltrator)
 * 
 * Tests the self-healing resilience of the Agentic ecosystem.
 * Intentionally breaks a test or file to verify 'agent-doctor' healing.
 */
function runChaosMonkey() {
  console.log('🐒 Chaos Monkey: Initiating architectural infiltration...');

  const targetFile = 'src/parser/ndjson-parser.ts'; // A core file to break
  if (!fs.existsSync(targetFile)) {
    console.warn(`⚠️ Target ${targetFile} not found. Chaos aborted.`);
    process.exit(0);
  }

  // 1. Create Backup
  const backupPath = `${targetFile}.bak`;
  fs.copyFileSync(targetFile, backupPath);
  console.log('📦 Backup created.');

  // 2. Introduce Sabotage (e.g. breaking a delimiter)
  let content = fs.readFileSync(targetFile, 'utf8');
  const sabotageContent = content.replace(/\\n/g, '\\r\\n'); // Subtle breakage
  fs.writeFileSync(targetFile, sabotageContent);
  console.log('🔥 Sabotage complete. Parser should now fail on standard logs.');

  // 3. Trigger CI/Local Test to verify failure
  try {
    console.log('🧪 Verifying failure (Chaos successful if tests fail)...');
    execSync('npm run test:parser', { stdio: 'inherit' });
    console.log('❌ Error: Sabotage failed to break the build. Chaos Monkey is weak.');
  } catch (err) {
    console.log('✅ Success! Chaos infiltration verified. System is now broken.');
    console.log('🧬 Next: Trigger "agent-doctor" to heal the damage.');
  }
}

runChaosMonkey();

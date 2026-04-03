import * as fs from 'fs';
import * as path from 'path';

/**
 * Agent Orchestrator (The Nervous System)
 * 
 * Provides unified logging and status management for the EchoCoder Agentic AI workforce.
 */
export class AgentOrchestrator {
  private static LOG_DIR = '.kiro/logs';
  private static LOG_FILE = '.kiro/logs/agent_traces.ndjson';

  /**
   * Logs an agent's "Thought" or "Action" to the central registry.
   */
  static log(agentName: string, type: 'THOUGHT' | 'ACTION' | 'ERROR', message: string, metadata: any = {}) {
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }

    const entry = {
      timestamp: new Date().toISOString(),
      agent: agentName,
      type,
      message,
      ...metadata
    };

    fs.appendFileSync(this.LOG_FILE, JSON.stringify(entry) + '\n');
    
    // Also log to console for CI visibility
    const icon = type === 'ERROR' ? '❌' : (type === 'THOUGHT' ? '🧠' : '🛠️');
    console.log(`${icon} [${agentName}] ${message}`);
  }

  /**
   * Sets a shared status flag (e.g. skip_tests)
   */
  static setStatus(key: string, value: any) {
    const statusFile = '.kiro/logs/shared_status.json';
    let status: any = {};
    if (fs.existsSync(statusFile)) {
      status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
    }
    status[key] = value;
    fs.writeFileSync(statusFile, JSON.stringify(status, null, 2));
  }
}

// Support command-line execution for simple logging
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length >= 3) {
    AgentOrchestrator.log(args[0], args[1] as any, args[2], args[3] ? JSON.parse(args[3]) : {});
  }
}

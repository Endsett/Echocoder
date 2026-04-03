import { object, func } from "@dagger.io/dagger"
import { Container, Directory, Client } from "@dagger.io/dagger"

/**
 * EchoCoder Dagger Pipeline
 * 
 * Defines isolated, containerized environments for Agent execution.
 * Eliminates "It works on my machine" and guarantees perfect reproducibility
 * between local agent self-healing loops and GitHub Actions CI.
 */
@object()
export class EchoCoderAgentEnv {
  
  /**
   * Builds the foundational Agent Node.js environment
   */
  @func()
  agentEnv(source: Directory): Container {
    return dag
      .container()
      .from("node:18-alpine")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      // We use clean install to match CI perfectly
      .withExec(["npm", "ci", "--legacy-peer-deps"])
  }

  /**
   * Executes the Agent tests in isolation
   */
  @func()
  async test(source: Directory): Promise<string> {
    return this.agentEnv(source)
      .withExec(["npm", "run", "test"])
      .stdout()
  }

  /**
   * Provisions an agent environment for the Self-Healing Pipeline Doctor
   */
  @func()
  async runDoctor(source: Directory, logsPath: string): Promise<string> {
    return this.agentEnv(source)
      .withEnvVariable("GITHUB_STEP_SUMMARY", "/app/failed_logs.txt")
      // In a real dagger pipeline, we'd mount the logs into the container here
      .withExec(["npx", "ts-node", "scripts/agent-doctor.ts"])
      .stdout()
  }
}

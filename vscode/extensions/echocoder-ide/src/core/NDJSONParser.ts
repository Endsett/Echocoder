/**
 * NDJSONParser — Robust Newline-Delimited JSON Stream Parser
 * 
 * Handles the critical challenge of chunk fragmentation when reading
 * from the OpenClaude child process stdout pipe. OS pipe buffers
 * may split a single JSON object across multiple data events.
 * 
 * This parser accumulates incoming chunks in a persistent buffer,
 * scans for newline delimiters, and only attempts JSON.parse() on
 * complete lines — preventing fatal SyntaxError crashes.
 */

import { AgentEvent } from '../types/agent-events';

export type ParsedEventCallback = (event: AgentEvent) => void;
export type ParseErrorCallback = (line: string, error: Error) => void;

export class NDJSONParser {
  private buffer: string = '';
  private onEvent: ParsedEventCallback;
  private onError: ParseErrorCallback;

  constructor(onEvent: ParsedEventCallback, onError?: ParseErrorCallback) {
    this.onEvent = onEvent;
    this.onError = onError || (() => {});
  }

  /**
   * Feed a raw data chunk from stdout into the parser.
   * This may be a complete JSON line, a fragment, or multiple lines.
   */
  public feed(chunk: string): void {
    this.buffer += chunk;
    this.processBuffer();
  }

  /**
   * Process the buffer, extracting and parsing complete JSON lines.
   * A complete line is demarcated by a newline character (\n).
   */
  private processBuffer(): void {
    let newlineIndex: number;

    // Process all complete lines in the buffer
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (line.length === 0) {
        continue; // Skip empty lines
      }

      this.parseLine(line);
    }
  }

  /**
   * Attempt to parse a single complete line as a JSON AgentEvent.
   * Malformed lines are logged but never crash the parser.
   */
  private parseLine(line: string): void {
    try {
      const parsed = JSON.parse(line);

      // Validate minimum shape: must have 'type' field
      if (typeof parsed === 'object' && parsed !== null && 'type' in parsed) {
        this.onEvent(parsed as AgentEvent);
      } else {
        this.onError(line, new Error('Parsed JSON lacks required "type" field'));
      }
    } catch (err) {
      this.onError(line, err instanceof Error ? err : new Error(String(err)));
    }
  }

  /**
   * Flush any remaining data in the buffer. Called when the
   * child process exits to handle the final incomplete line.
   */
  public flush(): void {
    const remaining = this.buffer.trim();
    if (remaining.length > 0) {
      this.parseLine(remaining);
    }
    this.buffer = '';
  }

  /**
   * Reset the parser state. Used when starting a new session.
   */
  public reset(): void {
    this.buffer = '';
  }
}

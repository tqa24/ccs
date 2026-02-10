/**
 * Process management utilities
 */

import { ChildProcess } from 'child_process';

/**
 * Kill process with SIGTERM, escalating to SIGKILL if it doesn't exit.
 * Uses exitCode === null (not proc.killed) to check if process is still running,
 * since proc.killed only indicates a signal was sent, not that the process exited.
 */
export function killWithEscalation(proc: ChildProcess, gracePeriodMs = 3000): void {
  proc.kill('SIGTERM');
  const timer = setTimeout(() => {
    if (proc.exitCode === null) {
      proc.kill('SIGKILL');
    }
  }, gracePeriodMs);
  timer.unref(); // Don't keep event loop alive just for escalation
  proc.once('exit', () => clearTimeout(timer));
}
